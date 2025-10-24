/**
 * Synchronization service between S3 and vector store
 */

import * as fs from 'fs';
import * as path from 'path';

import { config, logger } from '../config/index.js';
import type { 
  SyncState, 
  DetectedChanges, 
  SyncMetrics,
  S3Document,
  DocumentToIndex 
} from '../types/index.js';

import { HNSWVectorStore } from './hnswlib-vector-store.js';
import { S3Loader } from './s3-loader.js';

export class SyncService {
  private s3Loader: S3Loader;
  private vectorStore: HNSWVectorStore;
  private syncStatePath: string;
  private syncState: SyncState;

  constructor(s3Loader: S3Loader, vectorStore: HNSWVectorStore) {
    this.s3Loader = s3Loader;
    this.vectorStore = vectorStore;
    this.syncStatePath = './data/.sync-state.json';
    this.syncState = this.loadSyncState();
    
    logger.info(`SyncService initialized`);
  }

  /**
   * Load synchronization state from disk
   */
  private loadSyncState(): SyncState {
    try {
      if (fs.existsSync(this.syncStatePath)) {
        const data = fs.readFileSync(this.syncStatePath, 'utf-8');
        const state = JSON.parse(data) as SyncState;
        logger.debug(`📂 Sync state loaded: ${Object.keys(state.documents).length} documents`);
        return state;
      }
    } catch (error) {
      logger.warn(`⚠️  Unable to load sync state:`, error);
    }

    // Initial state
    return {
      lastSyncDate: new Date().toISOString(),
      documents: {},
      version: '1.0',
    };
  }

  /**
   * Save synchronization state to disk
   */
  private saveSyncState(): void {
    try {
      // Create directory if necessary
      const dir = path.dirname(this.syncStatePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(
        this.syncStatePath,
        JSON.stringify(this.syncState, null, 2),
        'utf-8'
      );
      logger.debug(`💾 Sync state saved`);
    } catch (error) {
      logger.error(`❌ Unable to save sync state:`, error);
    }
  }

  /**
   * Detect changes between S3 and local state
   */
  async detectChanges(s3Documents: S3Document[]): Promise<DetectedChanges> {
    const changes: DetectedChanges = {
      new: [],
      modified: [],
      deleted: [],
      unchanged: [],
    };

    // Create a Set of S3 keys to detect deletions
    const s3Keys = new Set(s3Documents.map(doc => doc.key));

    // Analyze each S3 document
    for (const s3Doc of s3Documents) {
      if (!(s3Doc.key in this.syncState.documents)) {
        // New document
        changes.new.push(s3Doc);
      } else {
        const cached = this.syncState.documents[s3Doc.key];
        if (cached.etag !== s3Doc.etag) {
          // Modified document (different ETag)
          changes.modified.push(s3Doc);
        } else {
          // Unchanged document
          changes.unchanged.push(s3Doc);
        }
      }
    }

    // Detect deleted documents
    for (const key in this.syncState.documents) {
      if (!s3Keys.has(key)) {
        changes.deleted.push(key);
      }
    }

    logger.info(`📊 Changes detected:`);
    logger.info(`   ➕ New: ${changes.new.length}`);
    logger.info(`   ♻️  Modified: ${changes.modified.length}`);
    logger.info(`   ❌ Deleted: ${changes.deleted.length}`);
    logger.info(`   ✅ Unchanged: ${changes.unchanged.length}`);

    return changes;
  }

  /**
   * Index a document in the vector store
   */
  private async indexDocument(s3Doc: S3Document): Promise<number> {
    // Load content if not already loaded
    const doc = s3Doc.content 
      ? s3Doc 
      : await this.s3Loader.loadDocument(s3Doc);

    if (!doc.content) {
      throw new Error(`No content for ${doc.key}`);
    }

    // Split into chunks
    const chunks = await this.vectorStore.splitDocument(doc.content);

    // Create documents to index
    const documentsToIndex: DocumentToIndex[] = chunks.map((chunk, index) => ({
      content: chunk,
      metadata: {
        key: doc.key,
        etag: doc.etag,
        chunkIndex: index,
        totalChunks: chunks.length,
        source: `s3://${config.s3.bucketName}/${doc.key}`,
      },
    }));

    // Add to vector store
    await this.vectorStore.addDocuments(documentsToIndex);

    // Update sync state
    this.syncState.documents[doc.key] = {
      key: doc.key,
      etag: doc.etag,
      lastModified: doc.lastModified.toISOString(),
      chunkCount: chunks.length,
      status: 'indexed',
    };

    return chunks.length;
  }

  /**
   * Perform full synchronization
   */
  async performSync(mode: 'full' | 'incremental' = 'incremental'): Promise<SyncMetrics> {
    const startTime = Date.now();
    
    const metrics: SyncMetrics = {
      lastSyncDate: new Date(),
      duration: 0,
      documentsScanned: 0,
      documentsAdded: 0,
      documentsModified: 0,
      documentsDeleted: 0,
      documentsUnchanged: 0,
      errors: [],
    };

    try {
      logger.info(`🔄 Starting synchronization (mode: ${mode})...`);

      // 1. Scan S3
      const s3Documents = await this.s3Loader.listMarkdownFiles();
      metrics.documentsScanned = s3Documents.length;

      if (mode === 'full') {
        // Full mode: reindex everything
        logger.info(`🔄 FULL mode: complete reindexing...`);
        
        // Clear all documents from vector store
        await this.vectorStore.clearAll();
        this.syncState.documents = {};

        // Reindex all documents
        for (const doc of s3Documents) {
          try {
            const chunkCount = await this.indexDocument(doc);
            metrics.documentsAdded++;
            logger.info(`   ✅ Indexed: ${doc.key} (${chunkCount} chunks)`);
          } catch (error) {
            metrics.errors.push({ key: doc.key, error: String(error) });
            logger.error(`   ❌ Failed: ${doc.key}`, error);
          }
        }
      } else {
        // Incremental mode: only changes
        const changes = await this.detectChanges(s3Documents);

        // Remove deleted documents
        for (const key of changes.deleted) {
          try {
            await this.vectorStore.removeByKey(key);
            delete this.syncState.documents[key];
            metrics.documentsDeleted++;
            logger.info(`   🗑️  Deleted: ${key}`);
          } catch (error) {
            metrics.errors.push({ key, error: String(error) });
            logger.error(`   ❌ Delete failed: ${key}`, error);
          }
        }

        // Reindex modified documents (remove then add)
        for (const doc of changes.modified) {
          try {
            await this.vectorStore.removeByKey(doc.key);
            const chunkCount = await this.indexDocument(doc);
            metrics.documentsModified++;
            logger.info(`   ♻️  Updated: ${doc.key} (${chunkCount} chunks)`);
          } catch (error) {
            metrics.errors.push({ key: doc.key, error: String(error) });
            logger.error(`   ❌ Update failed: ${doc.key}`, error);
          }
        }

        // Add new documents
        for (const doc of changes.new) {
          try {
            const chunkCount = await this.indexDocument(doc);
            metrics.documentsAdded++;
            logger.info(`   ➕ Added: ${doc.key} (${chunkCount} chunks)`);
          } catch (error) {
            metrics.errors.push({ key: doc.key, error: String(error) });
            logger.error(`   ❌ Add failed: ${doc.key}`, error);
          }
        }

        metrics.documentsUnchanged = changes.unchanged.length;
      }

      // Save state
      this.syncState.lastSyncDate = new Date().toISOString();
      this.saveSyncState();

      // Save vector store
      await this.vectorStore.save();

    } catch (error) {
      logger.error(`❌ Error during synchronization:`, error);
      metrics.errors.push({ key: 'sync', error: String(error) });
    }

    metrics.duration = Date.now() - startTime;
    this.logSyncMetrics(metrics);

    return metrics;
  }

  /**
   * Display synchronization metrics
   */
  private logSyncMetrics(metrics: SyncMetrics): void {
    logger.info(`\n📊 Synchronization completed:`);
    logger.info(`   ⏱️  Duration: ${(metrics.duration / 1000).toFixed(2)}s`);
    logger.info(`   📄 Documents scanned: ${metrics.documentsScanned}`);
    logger.info(`   ➕ Added: ${metrics.documentsAdded}`);
    logger.info(`   ♻️  Modified: ${metrics.documentsModified}`);
    logger.info(`   ❌ Deleted: ${metrics.documentsDeleted}`);
    logger.info(`   ✅ Unchanged: ${metrics.documentsUnchanged}`);
    
    if (metrics.errors.length > 0) {
      logger.warn(`   ⚠️  Errors: ${metrics.errors.length}`);
      metrics.errors.forEach(err => {
        logger.warn(`      - ${err.key}: ${err.error}`);
      });
    }
  }

  /**
   * Get synchronization statistics
   */
  getStats() {
    return {
      lastSyncDate: this.syncState.lastSyncDate,
      totalDocuments: Object.keys(this.syncState.documents).length,
      indexed: Object.values(this.syncState.documents).filter(d => d.status === 'indexed').length,
      errors: Object.values(this.syncState.documents).filter(d => d.status === 'error').length,
    };
  }

  /**
   * Get document information from sync state
   */
  getDocumentInfo(key: string): SyncState['documents'][string] | null {
    return this.syncState.documents[key] ?? null;
  }

  /**
   * Get list of indexed files with metadata (for MCP Resources)
   */
  getIndexedFiles(): Array<{
    key: string;
    chunkCount: number;
    lastModified: string;
    etag: string;
    size?: number;
  }> {
    return Object.entries(this.syncState.documents)
      .filter(([_, doc]) => doc.status === 'indexed')
      .map(([key, doc]) => ({
        key,
        chunkCount: doc.chunkCount,
        lastModified: doc.lastModified,
        etag: doc.etag,
        size: 0, // Size info will be added if available from S3
      }));
  }
}

