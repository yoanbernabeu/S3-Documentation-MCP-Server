/**
 * Service for loading documents from S3
 */

import { S3Client, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';

import { config, logger } from '../config/index.js';
import type { S3Document } from '../types/index.js';

export class S3Loader {
  private client: S3Client;
  private bucketName: string;
  private prefix: string;

  constructor() {
    // S3 configuration (compatible with AWS S3, MinIO, Scaleway, etc.)
    const s3Config: {
      region: string;
      credentials: { accessKeyId: string; secretAccessKey: string };
      endpoint?: string;
      forcePathStyle?: boolean;
    } = {
      region: config.s3.region,
      credentials: {
        accessKeyId: config.s3.accessKeyId,
        secretAccessKey: config.s3.secretAccessKey,
      },
    };

    // Add custom endpoint if provided (for S3-compatible services)
    if (config.s3.endpoint) {
      s3Config.endpoint = config.s3.endpoint;
      logger.info(`🔗 Using custom S3 endpoint: ${config.s3.endpoint}`);
    }

    // Force path style if necessary (MinIO, etc.)
    if (config.s3.forcePathStyle) {
      s3Config.forcePathStyle = true;
      logger.debug(`🔧 ForcePathStyle enabled`);
    }

    this.client = new S3Client(s3Config);
    this.bucketName = config.s3.bucketName;
    this.prefix = config.s3.prefix;
    
    logger.info(`S3Loader initialized for bucket: ${this.bucketName}`);
  }

  /**
   * List all Markdown files in the S3 bucket
   */
  async listMarkdownFiles(): Promise<S3Document[]> {
    const documents: S3Document[] = [];
    let continuationToken: string | undefined;

    try {
      do {
        const command = new ListObjectsV2Command({
          Bucket: this.bucketName,
          Prefix: this.prefix,
          ContinuationToken: continuationToken,
        });

        const response = await this.client.send(command);

        if (response.Contents) {
          for (const object of response.Contents) {
            // Filter only .md files
            if (object.Key?.endsWith('.md')) {
              documents.push({
                key: object.Key,
                etag: object.ETag ?? '',
                lastModified: object.LastModified ?? new Date(),
                size: object.Size ?? 0,
              });
            }
          }
        }

        continuationToken = response.NextContinuationToken;
      } while (continuationToken);

      logger.info(`📄 Found ${documents.length} Markdown files in S3`);
      return documents;
    } catch (error) {
      logger.error(`Error listing S3:`, error);
      throw new Error(`Unable to list S3 files: ${error}`);
    }
  }

  /**
   * Download file content from S3
   */
  async getFileContent(key: string): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const response = await this.client.send(command);
      
      if (!response.Body) {
        throw new Error(`No content for ${key}`);
      }

      // Convert stream to string
      const content = await response.Body.transformToString('utf-8');
      
      logger.debug(`📥 Downloaded: ${key} (${content.length} characters)`);
      return content;
    } catch (error) {
      logger.error(`Error downloading ${key}:`, error);
      throw new Error(`Unable to download ${key}: ${error}`);
    }
  }

  /**
   * Load a document with its content
   */
  async loadDocument(doc: S3Document): Promise<S3Document> {
    const content = await this.getFileContent(doc.key);
    return {
      ...doc,
      content,
    };
  }

  /**
   * Load all documents
   */
  async loadAllDocuments(): Promise<S3Document[]> {
    const files = await this.listMarkdownFiles();
    
    logger.info(`🔄 Loading ${files.length} documents...`);
    
    const documents: S3Document[] = [];
    let loaded = 0;
    
    for (const file of files) {
      try {
        const doc = await this.loadDocument(file);
        documents.push(doc);
        loaded++;
        
        if (loaded % 10 === 0) {
          logger.info(`   Progress: ${loaded}/${files.length}`);
        }
      } catch (error) {
        logger.error(`Failed to load ${file.key}:`, error);
      }
    }
    
    logger.success(`✅ Loaded ${documents.length}/${files.length} documents`);
    return documents;
  }

  /**
   * Get file metadata (without content)
   */
  async getFileMetadata(key: string): Promise<S3Document | null> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const response = await this.client.send(command);
      
      return {
        key,
        etag: response.ETag ?? '',
        lastModified: response.LastModified ?? new Date(),
        size: response.ContentLength ?? 0,
      };
    } catch (error) {
      logger.error(`Error retrieving metadata for ${key}:`, error);
      return null;
    }
  }
}

