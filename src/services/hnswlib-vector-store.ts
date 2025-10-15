/**
 * Vector Store with HNSWLib for optimized vector search
 */

import { randomUUID } from 'crypto';
import * as fs from 'fs';

import { OllamaEmbeddings } from '@langchain/community/embeddings/ollama';
import { HNSWLib } from '@langchain/community/vectorstores/hnswlib';
import { Document } from '@langchain/core/documents';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';


import { config, logger } from '../config/index.js';
import type { SearchResult, DocumentToIndex } from '../types/index.js';

// Internal types for HNSWLib docstore access
interface HNSWLibDocstore {
  _docs?: Record<string, Document>;
}

interface HNSWLibWithDocstore {
  docstore?: HNSWLibDocstore;
}

export class HNSWVectorStore {
  private store?: HNSWLib;
  private embeddings: OllamaEmbeddings;
  private textSplitter: RecursiveCharacterTextSplitter;
  private storePath: string;
  private keyIndex: Map<string, string[]> = new Map(); // S3 key -> doc IDs

  constructor(storePath?: string) {
    this.storePath = storePath ?? config.vectorStore.path;
    
    // Configure Ollama embeddings
    this.embeddings = new OllamaEmbeddings({
      model: config.ollama.embeddingModel,
      baseUrl: config.ollama.baseUrl,
    });
    
    // Configure text splitter
    this.textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: config.rag.chunkSize,
      chunkOverlap: config.rag.chunkOverlap,
      separators: ['\n\n', '\n', '. ', ' ', ''],
    });
    
    logger.info(`HNSWVectorStore configured: ${this.storePath}`);
  }

  /**
   * Initialize vector store (load from disk or create new)
   */
  async initialize(): Promise<void> {
    try {
      const indexPath = `${this.storePath}/hnswlib.index`;
      
      if (fs.existsSync(indexPath)) {
        // Load from disk
        logger.info(`📂 Loading vector store from ${this.storePath}...`);
        this.store = await HNSWLib.load(this.storePath, this.embeddings);
        
        // Rebuild key -> IDs index from metadata
        await this.rebuildKeyIndex();
        
        logger.success(`✅ Vector store loaded: ${this.keyIndex.size} files, ${await this.getDocumentCount()} chunks`);
      } else {
        // Create new store
        logger.info(`🆕 Creating new vector store...`);
        this.store = new HNSWLib(this.embeddings, { space: 'cosine' });
        logger.success(`✅ New vector store created`);
      }
    } catch (error) {
      logger.error(`Error initializing vector store:`, error);
      // In case of error, create a new store
      this.store = new HNSWLib(this.embeddings, { space: 'cosine' });
      logger.warn(`⚠️  New vector store created after error`);
    }
  }

  /**
   * Rebuild key -> IDs index from store metadata
   */
  private async rebuildKeyIndex(): Promise<void> {
    if (!this.store) return;
    
    try {
      // Access docstore directly to retrieve all documents
      // Without needing to perform a vector search
      this.keyIndex.clear();
      
      // HNSWLib stores documents in an internal docstore
      // We can access it via private property (not ideal but necessary)
      const docstore = (this.store as unknown as HNSWLibWithDocstore).docstore;
      
      if (docstore?._docs) {
        // Iterate through all documents in docstore
        for (const [_docId, doc] of Object.entries(docstore._docs)) {
          const key = doc.metadata.key as string | undefined;
          const id = doc.metadata.id as string | undefined;
          
          if (key && id) {
            if (!this.keyIndex.has(key)) {
              this.keyIndex.set(key, []);
            }
            this.keyIndex.get(key)!.push(id);
          }
        }
        
        logger.debug(`🗂️  Index rebuilt: ${this.keyIndex.size} unique files`);
      } else {
        logger.warn(`⚠️  Unable to access docstore to rebuild index`);
      }
    } catch (error) {
      logger.warn(`⚠️  Unable to rebuild index:`, error);
      // Not critical, index will be rebuilt gradually
    }
  }

  /**
   * Split a document into chunks
   */
  async splitDocument(content: string): Promise<string[]> {
    const documents = await this.textSplitter.createDocuments([content]);
    return documents.map(doc => doc.pageContent);
  }

  /**
   * Add documents to vector store
   */
  async addDocuments(docs: DocumentToIndex[]): Promise<void> {
    if (!this.store) await this.initialize();

    logger.info(`📝 Adding ${docs.length} chunks to vector store...`);

    const documents = docs.map(doc => {
      const id = randomUUID();
      
      // Update index
      if (!this.keyIndex.has(doc.metadata.key)) {
        this.keyIndex.set(doc.metadata.key, []);
      }
      this.keyIndex.get(doc.metadata.key)!.push(id);

      return new Document({
        pageContent: doc.content,
        metadata: {
          id,
          key: doc.metadata.key,
          etag: doc.metadata.etag,
          chunkIndex: doc.metadata.chunkIndex,
          totalChunks: doc.metadata.totalChunks,
          source: doc.metadata.source,
          indexedAt: new Date().toISOString(),
        },
      });
    });

    await this.store!.addDocuments(documents);
    await this.save();
    
    logger.success(`✅ ${docs.length} chunks added`);
  }

  /**
   * Clear all documents from the vector store
   */
  async clearAll(): Promise<void> {
    logger.info(`🗑️  Clearing all documents from vector store...`);
    
    // Create a new empty store
    this.store = new HNSWLib(this.embeddings, { space: 'cosine' });
    this.keyIndex.clear();
    
    logger.success(`✅ Vector store cleared`);
  }

  /**
   * Remove all documents for an S3 key
   */
  async removeByKey(s3Key: string): Promise<number> {
    if (!this.store) await this.initialize();

    const idsToRemove = this.keyIndex.get(s3Key) ?? [];
    if (idsToRemove.length === 0) {
      logger.debug(`No documents to remove for ${s3Key}`);
      return 0;
    }

    logger.info(`🗑️  Removing ${idsToRemove.length} chunks for ${s3Key}...`);

    // HNSWLib doesn't support direct deletion
    // Solution: rebuild the store without documents to remove
    
    // Get all documents from docstore
    const docstore = (this.store as unknown as HNSWLibWithDocstore).docstore;
    const keptDocs: Document[] = [];
    
    if (docstore?._docs) {
      for (const [_docId, doc] of Object.entries(docstore._docs)) {
        const id = doc.metadata.id as string | undefined;
        if (id && !idsToRemove.includes(id)) {
          keptDocs.push(doc);
        }
      }
    }

    // Recreate the store
    this.store = new HNSWLib(this.embeddings, { space: 'cosine' });
    if (keptDocs.length > 0) {
      await this.store.addDocuments(keptDocs);
    }

    // Update index
    this.keyIndex.delete(s3Key);

    // Only save if the store is not empty
    // An empty store without any documents added cannot be saved
    if (keptDocs.length > 0) {
      await this.save();
    }
    
    logger.success(`✅ ${idsToRemove.length} chunks removed for ${s3Key}`);
    
    return idsToRemove.length;
  }

  /**
   * Similarity search
   */
  async similaritySearch(query: string, k?: number): Promise<SearchResult[]> {
    if (!this.store) await this.initialize();

    const maxResults = k ?? config.rag.maxResults;
    
    logger.debug(`🔍 Search: "${query.substring(0, 50)}..." (top ${maxResults})`);

    // Vectorize query with Ollama
    logger.debug(`🧮 Vectorizing query via Ollama (${config.ollama.embeddingModel})...`);
    const startEmbedding = Date.now();
    
    const results = await this.store!.similaritySearchWithScore(query, maxResults);
    
    const embeddingTime = Date.now() - startEmbedding;
    logger.debug(`✅ Vectorization + search completed in ${embeddingTime}ms`);

    // Display raw scores for debug
    if (results.length > 0) {
      logger.debug(`📊 Raw HNSWLib scores:`);
      results.slice(0, 3).forEach(([doc, rawScore], index) => {
        const convertedScore = 1 - rawScore;
        logger.debug(`   ${index + 1}. ${doc.metadata.key} - Raw distance: ${rawScore.toFixed(4)} → Similarity: ${convertedScore.toFixed(4)}`);
      });
    }

    // Convert and filter results by similarity threshold
    const allResults: SearchResult[] = results.map(([doc, score]) => ({
      document: {
        id: doc.metadata.id,
        s3_key: doc.metadata.key,
        s3_etag: doc.metadata.etag,
        content: doc.pageContent,
        chunk_index: doc.metadata.chunkIndex,
        total_chunks: doc.metadata.totalChunks,
        indexed_at: doc.metadata.indexedAt,
        source: doc.metadata.source,
      },
      // HNSWLib with cosine already returns a normalized distance
      // The smaller the distance, the more similar
      // We invert to get a similarity score (0 = different, 1 = identical)
      score: 1 - score,
    }));

    // Filter by minimum similarity threshold
    const minScore = config.rag.minSimilarityScore;
    const searchResults = allResults.filter(result => result.score >= minScore);

    if (searchResults.length < allResults.length) {
      logger.debug(`⚠️  ${allResults.length - searchResults.length} results filtered (score < ${minScore})`);
    }

    if (searchResults.length === 0) {
      logger.warn(`❌ No results with sufficient similarity (min: ${minScore})`);
      logger.debug(`   Best score found: ${allResults[0]?.score.toFixed(3) || 'N/A'}`);
    }

    logger.debug(`✅ ${searchResults.length} relevant results found`);
    return searchResults;
  }

  /**
   * Check if a document exists (by S3 key)
   */
  hasDocument(s3Key: string): boolean {
    return this.keyIndex.has(s3Key);
  }

  /**
   * Get the number of unique indexed files
   */
  getUniqueFileCount(): number {
    return this.keyIndex.size;
  }

  /**
   * Get the approximate number of indexed documents (chunks)
   */
  private async getDocumentCount(): Promise<number> {
    if (!this.store) return 0;
    
    try {
      // Access docstore directly instead of doing an empty search
      const docstore = (this.store as unknown as HNSWLibWithDocstore).docstore;
      
      if (docstore?._docs) {
        return Object.keys(docstore._docs).length;
      }
      
      return 0;
    } catch {
      return 0;
    }
  }

  /**
   * Save vector store to disk
   */
  async save(): Promise<void> {
    if (!this.store) return;
    
    // Check if store has documents before saving
    // An empty store without any documents added cannot be saved
    const docCount = await this.getDocumentCount();
    if (docCount === 0) {
      logger.debug(`⏭️  Skipping save: vector store is empty`);
      return;
    }
    
    // Create directory if necessary
    const dir = this.storePath.substring(0, this.storePath.lastIndexOf('/'));
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    await this.store.save(this.storePath);
    logger.debug(`💾 Vector store saved: ${this.storePath}`);
  }

  /**
   * Get vector store statistics
   */
  async getStats() {
    return {
      uniqueFiles: this.keyIndex.size,
      totalChunks: await this.getDocumentCount(),
      storePath: this.storePath,
    };
  }
}

