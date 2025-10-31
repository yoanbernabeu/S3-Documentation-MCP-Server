/**
 * Tests for refresh-index tool
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { refreshIndex } from '../../src/tools/refresh-index.js';
import { SyncService } from '../../src/services/sync-service.js';
import type { SyncMetrics } from '../../src/types/index.js';

vi.mock('../../src/services/sync-service.js');

describe('refresh-index tool', () => {
  let mockSyncService: SyncService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSyncService = {} as SyncService;
  });

  describe('refreshIndex', () => {
    it('should perform incremental sync by default', async () => {
      const mockMetrics: SyncMetrics = {
        lastSyncDate: new Date(),
        duration: 1500,
        documentsScanned: 10,
        documentsAdded: 2,
        documentsModified: 1,
        documentsDeleted: 0,
        documentsUnchanged: 7,
        errors: [],
      };

      mockSyncService.performSync = vi.fn().mockResolvedValue(mockMetrics);

      const result = await refreshIndex({ force: false }, mockSyncService);

      expect(mockSyncService.performSync).toHaveBeenCalledWith('incremental');
      expect(result.success).toBe(true);
      expect(result.metrics).toMatchObject({
        duration_seconds: 1.5,
        documents_scanned: 10,
        documents_added: 2,
        documents_modified: 1,
        documents_deleted: 0,
        documents_unchanged: 7,
        errors_count: 0,
      });
      expect(result.message.toLowerCase()).toContain('incremental');
      expect(result.message).toContain('successfully');
    });

    it('should perform full sync when force is true', async () => {
      const mockMetrics: SyncMetrics = {
        lastSyncDate: new Date(),
        duration: 5000,
        documentsScanned: 10,
        documentsAdded: 10,
        documentsModified: 0,
        documentsDeleted: 0,
        documentsUnchanged: 0,
        errors: [],
      };

      mockSyncService.performSync = vi.fn().mockResolvedValue(mockMetrics);

      const result = await refreshIndex({ force: true }, mockSyncService);

      expect(mockSyncService.performSync).toHaveBeenCalledWith('full');
      expect(result.success).toBe(true);
      expect(result.metrics.duration_seconds).toBe(5);
      expect(result.message.toLowerCase()).toContain('full');
      expect(result.message).toContain('successfully');
    });

    it('should handle force: undefined as false', async () => {
      const mockMetrics: SyncMetrics = {
        lastSyncDate: new Date(),
        duration: 1000,
        documentsScanned: 5,
        documentsAdded: 0,
        documentsModified: 0,
        documentsDeleted: 0,
        documentsUnchanged: 5,
        errors: [],
      };

      mockSyncService.performSync = vi.fn().mockResolvedValue(mockMetrics);

      await refreshIndex({}, mockSyncService);

      expect(mockSyncService.performSync).toHaveBeenCalledWith('incremental');
    });

    it('should report errors in sync', async () => {
      const mockMetrics: SyncMetrics = {
        lastSyncDate: new Date(),
        duration: 2000,
        documentsScanned: 5,
        documentsAdded: 2,
        documentsModified: 0,
        documentsDeleted: 0,
        documentsUnchanged: 2,
        errors: [
          { key: 'error1.md', error: 'Failed to load' },
          { key: 'error2.md', error: 'Failed to index' },
        ],
      };

      mockSyncService.performSync = vi.fn().mockResolvedValue(mockMetrics);

      const result = await refreshIndex({ force: false }, mockSyncService);

      expect(result.success).toBe(false);
      expect(result.metrics.errors_count).toBe(2);
      expect(result.message).toContain('2 error(s)');
    });

    it('should handle single error correctly', async () => {
      const mockMetrics: SyncMetrics = {
        lastSyncDate: new Date(),
        duration: 1000,
        documentsScanned: 3,
        documentsAdded: 2,
        documentsModified: 0,
        documentsDeleted: 0,
        documentsUnchanged: 0,
        errors: [{ key: 'error.md', error: 'Failed' }],
      };

      mockSyncService.performSync = vi.fn().mockResolvedValue(mockMetrics);

      const result = await refreshIndex({}, mockSyncService);

      expect(result.success).toBe(false);
      expect(result.metrics.errors_count).toBe(1);
      expect(result.message).toContain('1 error(s)');
    });

    it('should round duration to 2 decimals', async () => {
      const mockMetrics: SyncMetrics = {
        lastSyncDate: new Date(),
        duration: 1234,
        documentsScanned: 5,
        documentsAdded: 0,
        documentsModified: 0,
        documentsDeleted: 0,
        documentsUnchanged: 5,
        errors: [],
      };

      mockSyncService.performSync = vi.fn().mockResolvedValue(mockMetrics);

      const result = await refreshIndex({}, mockSyncService);

      expect(result.metrics.duration_seconds).toBe(1.23);
    });

    it('should handle sync service exceptions', async () => {
      mockSyncService.performSync = vi
        .fn()
        .mockRejectedValue(new Error('Sync failed'));

      const result = await refreshIndex({}, mockSyncService);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Error');
      expect(result.message).toContain('Sync failed');
      expect(result.metrics).toMatchObject({
        duration_seconds: 0,
        documents_scanned: 0,
        documents_added: 0,
        documents_modified: 0,
        documents_deleted: 0,
        documents_unchanged: 0,
        errors_count: 1,
      });
    });

    it('should include all metrics in response', async () => {
      const mockMetrics: SyncMetrics = {
        lastSyncDate: new Date(),
        duration: 3000,
        documentsScanned: 20,
        documentsAdded: 5,
        documentsModified: 3,
        documentsDeleted: 2,
        documentsUnchanged: 10,
        errors: [],
      };

      mockSyncService.performSync = vi.fn().mockResolvedValue(mockMetrics);

      const result = await refreshIndex({ force: false }, mockSyncService);

      expect(result.metrics).toEqual({
        duration_seconds: 3,
        documents_scanned: 20,
        documents_added: 5,
        documents_modified: 3,
        documents_deleted: 2,
        documents_unchanged: 10,
        errors_count: 0,
      });
    });

    it('should differentiate message between full and incremental mode', async () => {
      const mockMetrics: SyncMetrics = {
        lastSyncDate: new Date(),
        duration: 1000,
        documentsScanned: 5,
        documentsAdded: 0,
        documentsModified: 0,
        documentsDeleted: 0,
        documentsUnchanged: 5,
        errors: [],
      };

      mockSyncService.performSync = vi.fn().mockResolvedValue(mockMetrics);

      const incrementalResult = await refreshIndex(
        { force: false },
        mockSyncService
      );
      expect(incrementalResult.message.toLowerCase()).toContain('incremental');

      const fullResult = await refreshIndex({ force: true }, mockSyncService);
      expect(fullResult.message.toLowerCase()).toContain('full');
    });

    it('should include educational note when force is used with documents scanned', async () => {
      const mockMetrics: SyncMetrics = {
        lastSyncDate: new Date(),
        duration: 2000,
        documentsScanned: 15,
        documentsAdded: 15,
        documentsModified: 0,
        documentsDeleted: 0,
        documentsUnchanged: 0,
        errors: [],
      };

      mockSyncService.performSync = vi.fn().mockResolvedValue(mockMetrics);

      const result = await refreshIndex({ force: true }, mockSyncService);

      expect(result.success).toBe(true);
      expect(result.message).toContain('15 files were fully reindexed');
      expect(result.message).toContain('Next time, use incremental sync');
      expect(result.message.toLowerCase()).toContain('note');
    });

    it('should not include educational note for incremental sync', async () => {
      const mockMetrics: SyncMetrics = {
        lastSyncDate: new Date(),
        duration: 1000,
        documentsScanned: 10,
        documentsAdded: 2,
        documentsModified: 1,
        documentsDeleted: 0,
        documentsUnchanged: 7,
        errors: [],
      };

      mockSyncService.performSync = vi.fn().mockResolvedValue(mockMetrics);

      const result = await refreshIndex({ force: false }, mockSyncService);

      expect(result.success).toBe(true);
      expect(result.message).not.toContain('Note:');
      expect(result.message).not.toContain('Next time');
    });
  });
});

