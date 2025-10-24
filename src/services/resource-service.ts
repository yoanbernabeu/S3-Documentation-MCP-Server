/**
 * Service for managing MCP Resources
 */

import { logger } from '../config/index.js';

import type { S3Loader } from './s3-loader.js';
import type { SyncService } from './sync-service.js';

export interface ResourceItem {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
  annotations: {
    lastModified: string;
    etag: string;
    chunks: number;
  };
}

export interface ResourceContent {
  uri: string;
  mimeType: string;
  text: string;
}

export class ResourceService {
  private s3Loader: S3Loader;
  private syncService: SyncService;

  constructor(s3Loader: S3Loader, syncService: SyncService) {
    this.s3Loader = s3Loader;
    this.syncService = syncService;
    logger.info('ResourceService initialized');
  }

  /**
   * List all available resources (indexed files)
   */
  async listResources(): Promise<ResourceItem[]> {
    try {
      const files = this.syncService.getIndexedFiles();
      
      logger.info(`📚 Resources list requested - ${files.length} files available`);
      
      return files.map(file => ({
        uri: `s3doc://${file.key}`,
        name: file.key.split('/').pop() ?? file.key,
        description: `Documentation file with ${file.chunkCount} chunks`,
        mimeType: 'text/markdown',
        annotations: {
          lastModified: file.lastModified,
          etag: file.etag,
          chunks: file.chunkCount,
        },
      }));
    } catch (error) {
      logger.error('❌ Error listing resources:', error);
      throw error;
    }
  }

  /**
   * Read a resource content by its URI
   */
  async readResource(uri: string): Promise<ResourceContent> {
    // Extract the S3 key from the URI (remove the s3doc:// prefix)
    const s3Key = uri.replace(/^s3doc:\/\//, '');
    
    try {
      logger.info(`📖 Read resource: "${s3Key}"`);
      
      // Get file content from S3
      const content = await this.s3Loader.getFileContent(s3Key);
      
      logger.info(`✅ Resource read successfully: ${(content.length / 1024).toFixed(2)} KB`);
      
      return {
        uri,
        mimeType: 'text/markdown',
        text: content,
      };
    } catch (error) {
      logger.error(`❌ Error reading resource "${s3Key}":`, error);
      throw error;
    }
  }
}

