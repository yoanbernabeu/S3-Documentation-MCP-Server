/**
 * MCP Tool: Refresh documentation index
 */

import { z } from 'zod';

import { logger } from '../config/index.js';
import type { SyncService } from '../services/sync-service.js';

// Zod schema for input
export const refreshIndexInputSchema = z.object({
  force: z.boolean().optional().describe('Force a complete reindexing (default: false)'),
});

// Zod schema for output
export const refreshIndexOutputSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  metrics: z.object({
    duration_seconds: z.number(),
    documents_scanned: z.number(),
    documents_added: z.number(),
    documents_modified: z.number(),
    documents_deleted: z.number(),
    documents_unchanged: z.number(),
    errors_count: z.number(),
  }),
});

export type RefreshIndexInput = z.infer<typeof refreshIndexInputSchema>;
export type RefreshIndexOutput = z.infer<typeof refreshIndexOutputSchema>;

/**
 * Implementation of refresh_index tool
 */
export async function refreshIndex(
  input: RefreshIndexInput,
  syncService: SyncService
): Promise<RefreshIndexOutput> {
  const { force = false } = input;
  
  const mode = force ? 'full' : 'incremental';
  logger.info(`🔄 Refreshing index (mode: ${mode})...`);
  
  try {
    const metrics = await syncService.performSync(mode);
    
    const hasErrors = metrics.errors.length > 0;
    const message = hasErrors
      ? `${mode} synchronization completed with ${metrics.errors.length} error(s)`
      : `${mode} synchronization completed successfully`;
    
    return {
      success: !hasErrors,
      message,
      metrics: {
        duration_seconds: Math.round(metrics.duration / 1000 * 100) / 100,
        documents_scanned: metrics.documentsScanned,
        documents_added: metrics.documentsAdded,
        documents_modified: metrics.documentsModified,
        documents_deleted: metrics.documentsDeleted,
        documents_unchanged: metrics.documentsUnchanged,
        errors_count: metrics.errors.length,
      },
    };
  } catch (error) {
    logger.error(`❌ Error during refresh:`, error);
    return {
      success: false,
      message: `Error: ${error}`,
      metrics: {
        duration_seconds: 0,
        documents_scanned: 0,
        documents_added: 0,
        documents_modified: 0,
        documents_deleted: 0,
        documents_unchanged: 0,
        errors_count: 1,
      },
    };
  }
}

