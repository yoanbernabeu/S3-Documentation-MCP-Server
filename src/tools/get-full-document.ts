/**
 * MCP Tool: Get full document from S3
 */

import { z } from 'zod';

import { logger } from '../config/index.js';
import type { S3Loader } from '../services/s3-loader.js';
import type { SyncService } from '../services/sync-service.js';

// Zod schema for input
export const getFullDocumentInputSchema = z.object({
  s3_key: z.string().describe('S3 document key (e.g., "docs/authentification_magique_symfony.md")'),
});

// Zod schema for output
export const getFullDocumentOutputSchema = z.object({
  s3_key: z.string(),
  content: z.string(),
  metadata: z.object({
    size_bytes: z.number(),
    last_modified: z.string(),
    etag: z.string(),
    chunk_count: z.number().optional(),
  }),
});

export type GetFullDocumentInput = z.infer<typeof getFullDocumentInputSchema>;
export type GetFullDocumentOutput = z.infer<typeof getFullDocumentOutputSchema>;

/**
 * Implementation of get_full_document tool
 */
export async function getFullDocument(
  input: GetFullDocumentInput,
  s3Loader: S3Loader,
  syncService: SyncService
): Promise<GetFullDocumentOutput> {
  const { s3_key } = input;
  
  logger.info(`📄 Fetching full document: "${s3_key}"`);
  
  try {
    // Fetch document content from S3
    const content = await s3Loader.getFileContent(s3_key);
    
    if (!content) {
      throw new Error(`Document "${s3_key}" has no content`);
    }
    
    // Fetch metadata from S3
    const metadata = await s3Loader.getFileMetadata(s3_key);
    
    if (!metadata) {
      throw new Error(`Unable to retrieve metadata for "${s3_key}"`);
    }
    
    // Get chunk count from sync state if available
    const documentInfo = syncService.getDocumentInfo(s3_key);
    const chunkCount = documentInfo !== null ? documentInfo.chunkCount : undefined;
    
    logger.success(`✅ Document retrieved: ${content.length} characters`);
    
    return {
      s3_key,
      content,
      metadata: {
        size_bytes: metadata.size,
        last_modified: metadata.lastModified.toISOString(),
        etag: metadata.etag,
        chunk_count: chunkCount,
      },
    };
  } catch (error) {
    logger.error(`❌ Error fetching document "${s3_key}":`, error);
    logger.debug(`Error type: ${error instanceof Error ? error.constructor.name : typeof error}`);
    logger.debug(`Error message: ${error instanceof Error ? error.message : String(error)}`);
    
    // Check if it's a 404 / not found error
    if (error instanceof Error && (error.message.includes('NoSuchKey') || error.message.includes('404') || error.message.includes('NotFound'))) {
      // Check if document is in sync state (indexed but not in S3)
      const documentInfo = syncService.getDocumentInfo(s3_key);
      
      if (documentInfo) {
        throw new Error(
          `Document "${s3_key}" was found in the index (last indexed: ${documentInfo.lastModified}) but is no longer available in S3. ` +
          `This may indicate the file was deleted. Please run 'refresh_index' to synchronize the index with S3.`
        );
      }
      
      throw new Error(
        `Document "${s3_key}" not found in S3. Please verify the key is correct. ` +
        `If you found this key via search, the file may have been deleted from S3. Run 'refresh_index' to update the index.`
      );
    }
    
    throw new Error(`Error fetching document: ${error}`);
  }
}

