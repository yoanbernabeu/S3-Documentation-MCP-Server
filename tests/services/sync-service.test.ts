/**
 * Tests for SyncService
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { SyncService } from '../../src/services/sync-service.js';
import { S3Loader } from '../../src/services/s3-loader.js';
import { HNSWVectorStore } from '../../src/services/hnswlib-vector-store.js';
import type { S3Document, DetectedChanges } from '../../src/types/index.js';
import * as fs from 'fs';

// Mock dependencies
vi.mock('fs');
vi.mock('../../src/services/s3-loader.js');
vi.mock('../../src/services/hnswlib-vector-store.js');

describe('SyncService', () => {
  let syncService: SyncService;
  let mockS3Loader: S3Loader;
  let mockVectorStore: HNSWVectorStore;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock instances
    mockS3Loader = new S3Loader();
    mockVectorStore = new HNSWVectorStore();

    // Mock fs methods
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    vi.spyOn(fs, 'readFileSync').mockReturnValue('{}');
    vi.spyOn(fs, 'writeFileSync').mockImplementation(() => undefined as any);
    vi.spyOn(fs, 'mkdirSync').mockImplementation(() => undefined as any);

    syncService = new SyncService(mockS3Loader, mockVectorStore);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('detectChanges', () => {
    it('should detect new documents', async () => {
      const s3Documents: S3Document[] = [
        {
          key: 'new-doc.md',
          etag: 'etag-new',
          lastModified: new Date('2024-01-01'),
          size: 1000,
        },
      ];

      const changes = await syncService.detectChanges(s3Documents);

      expect(changes.new).toHaveLength(1);
      expect(changes.new[0].key).toBe('new-doc.md');
      expect(changes.modified).toHaveLength(0);
      expect(changes.deleted).toHaveLength(0);
    });

    it('should detect modified documents', async () => {
      // Create service with existing state
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'readFileSync').mockReturnValue(
        JSON.stringify({
          lastSyncDate: '2024-01-01T00:00:00.000Z',
          documents: {
            'existing-doc.md': {
              key: 'existing-doc.md',
              etag: 'old-etag',
              lastModified: '2024-01-01T00:00:00.000Z',
              chunkCount: 2,
              status: 'indexed',
            },
          },
          version: '1.0',
        })
      );

      syncService = new SyncService(mockS3Loader, mockVectorStore);

      const s3Documents: S3Document[] = [
        {
          key: 'existing-doc.md',
          etag: 'new-etag',
          lastModified: new Date('2024-01-02'),
          size: 1000,
        },
      ];

      const changes = await syncService.detectChanges(s3Documents);

      expect(changes.modified).toHaveLength(1);
      expect(changes.modified[0].key).toBe('existing-doc.md');
      expect(changes.new).toHaveLength(0);
      expect(changes.deleted).toHaveLength(0);
    });

    it('should detect deleted documents', async () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'readFileSync').mockReturnValue(
        JSON.stringify({
          lastSyncDate: '2024-01-01T00:00:00.000Z',
          documents: {
            'deleted-doc.md': {
              key: 'deleted-doc.md',
              etag: 'etag',
              lastModified: '2024-01-01T00:00:00.000Z',
              chunkCount: 2,
              status: 'indexed',
            },
          },
          version: '1.0',
        })
      );

      syncService = new SyncService(mockS3Loader, mockVectorStore);

      const s3Documents: S3Document[] = [];

      const changes = await syncService.detectChanges(s3Documents);

      expect(changes.deleted).toHaveLength(1);
      expect(changes.deleted[0]).toBe('deleted-doc.md');
      expect(changes.new).toHaveLength(0);
      expect(changes.modified).toHaveLength(0);
    });

    it('should detect unchanged documents', async () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'readFileSync').mockReturnValue(
        JSON.stringify({
          lastSyncDate: '2024-01-01T00:00:00.000Z',
          documents: {
            'unchanged-doc.md': {
              key: 'unchanged-doc.md',
              etag: 'same-etag',
              lastModified: '2024-01-01T00:00:00.000Z',
              chunkCount: 2,
              status: 'indexed',
            },
          },
          version: '1.0',
        })
      );

      syncService = new SyncService(mockS3Loader, mockVectorStore);

      const s3Documents: S3Document[] = [
        {
          key: 'unchanged-doc.md',
          etag: 'same-etag',
          lastModified: new Date('2024-01-01'),
          size: 1000,
        },
      ];

      const changes = await syncService.detectChanges(s3Documents);

      expect(changes.unchanged).toHaveLength(1);
      expect(changes.unchanged[0].key).toBe('unchanged-doc.md');
      expect(changes.new).toHaveLength(0);
      expect(changes.modified).toHaveLength(0);
      expect(changes.deleted).toHaveLength(0);
    });

    it('should handle mixed changes', async () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'readFileSync').mockReturnValue(
        JSON.stringify({
          lastSyncDate: '2024-01-01T00:00:00.000Z',
          documents: {
            'unchanged.md': {
              key: 'unchanged.md',
              etag: 'etag1',
              lastModified: '2024-01-01T00:00:00.000Z',
              chunkCount: 1,
              status: 'indexed',
            },
            'modified.md': {
              key: 'modified.md',
              etag: 'old-etag',
              lastModified: '2024-01-01T00:00:00.000Z',
              chunkCount: 1,
              status: 'indexed',
            },
            'deleted.md': {
              key: 'deleted.md',
              etag: 'etag3',
              lastModified: '2024-01-01T00:00:00.000Z',
              chunkCount: 1,
              status: 'indexed',
            },
          },
          version: '1.0',
        })
      );

      syncService = new SyncService(mockS3Loader, mockVectorStore);

      const s3Documents: S3Document[] = [
        {
          key: 'unchanged.md',
          etag: 'etag1',
          lastModified: new Date('2024-01-01'),
          size: 1000,
        },
        {
          key: 'modified.md',
          etag: 'new-etag',
          lastModified: new Date('2024-01-02'),
          size: 1000,
        },
        {
          key: 'new.md',
          etag: 'etag4',
          lastModified: new Date('2024-01-01'),
          size: 1000,
        },
      ];

      const changes = await syncService.detectChanges(s3Documents);

      expect(changes.unchanged).toHaveLength(1);
      expect(changes.modified).toHaveLength(1);
      expect(changes.new).toHaveLength(1);
      expect(changes.deleted).toHaveLength(1);
    });
  });

  describe('performSync', () => {
    beforeEach(() => {
      // Mock vector store methods
      vi.spyOn(mockVectorStore, 'splitDocument').mockResolvedValue(['chunk1', 'chunk2']);
      vi.spyOn(mockVectorStore, 'addDocuments').mockResolvedValue(undefined);
      vi.spyOn(mockVectorStore, 'removeByKey').mockResolvedValue(2);
      vi.spyOn(mockVectorStore, 'save').mockResolvedValue(undefined);

      // Mock S3 loader methods
      vi.spyOn(mockS3Loader, 'listMarkdownFiles').mockResolvedValue([]);
      vi.spyOn(mockS3Loader, 'loadDocument').mockResolvedValue({
        key: 'test.md',
        etag: 'etag',
        lastModified: new Date(),
        size: 1000,
        content: '# Test\n\nContent',
      });
    });

    it('should perform incremental sync with no changes', async () => {
      vi.spyOn(mockS3Loader, 'listMarkdownFiles').mockResolvedValue([
        {
          key: 'unchanged.md',
          etag: 'etag1',
          lastModified: new Date('2024-01-01'),
          size: 1000,
        },
      ]);

      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'readFileSync').mockReturnValue(
        JSON.stringify({
          lastSyncDate: '2024-01-01T00:00:00.000Z',
          documents: {
            'unchanged.md': {
              key: 'unchanged.md',
              etag: 'etag1',
              lastModified: '2024-01-01T00:00:00.000Z',
              chunkCount: 2,
              status: 'indexed',
            },
          },
          version: '1.0',
        })
      );

      syncService = new SyncService(mockS3Loader, mockVectorStore);

      const metrics = await syncService.performSync('incremental');

      expect(metrics.documentsScanned).toBe(1);
      expect(metrics.documentsAdded).toBe(0);
      expect(metrics.documentsModified).toBe(0);
      expect(metrics.documentsDeleted).toBe(0);
      expect(metrics.documentsUnchanged).toBe(1);
      expect(metrics.errors).toHaveLength(0);
    });

    it('should perform incremental sync with new documents', async () => {
      vi.spyOn(mockS3Loader, 'listMarkdownFiles').mockResolvedValue([
        {
          key: 'new.md',
          etag: 'etag-new',
          lastModified: new Date('2024-01-01'),
          size: 1000,
        },
      ]);

      const metrics = await syncService.performSync('incremental');

      expect(metrics.documentsAdded).toBe(1);
      expect(mockVectorStore.addDocuments).toHaveBeenCalled();
    });

    it('should perform incremental sync with modified documents', async () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'readFileSync').mockReturnValue(
        JSON.stringify({
          lastSyncDate: '2024-01-01T00:00:00.000Z',
          documents: {
            'modified.md': {
              key: 'modified.md',
              etag: 'old-etag',
              lastModified: '2024-01-01T00:00:00.000Z',
              chunkCount: 2,
              status: 'indexed',
            },
          },
          version: '1.0',
        })
      );

      syncService = new SyncService(mockS3Loader, mockVectorStore);

      vi.spyOn(mockS3Loader, 'listMarkdownFiles').mockResolvedValue([
        {
          key: 'modified.md',
          etag: 'new-etag',
          lastModified: new Date('2024-01-02'),
          size: 1000,
        },
      ]);

      const metrics = await syncService.performSync('incremental');

      expect(metrics.documentsModified).toBe(1);
      expect(mockVectorStore.removeByKey).toHaveBeenCalledWith('modified.md');
      expect(mockVectorStore.addDocuments).toHaveBeenCalled();
    });

    it('should perform incremental sync with deleted documents', async () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'readFileSync').mockReturnValue(
        JSON.stringify({
          lastSyncDate: '2024-01-01T00:00:00.000Z',
          documents: {
            'deleted.md': {
              key: 'deleted.md',
              etag: 'etag',
              lastModified: '2024-01-01T00:00:00.000Z',
              chunkCount: 2,
              status: 'indexed',
            },
          },
          version: '1.0',
        })
      );

      syncService = new SyncService(mockS3Loader, mockVectorStore);

      vi.spyOn(mockS3Loader, 'listMarkdownFiles').mockResolvedValue([]);

      const metrics = await syncService.performSync('incremental');

      expect(metrics.documentsDeleted).toBe(1);
      expect(mockVectorStore.removeByKey).toHaveBeenCalledWith('deleted.md');
    });

    it('should perform full sync and reindex everything', async () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);
      vi.spyOn(fs, 'readFileSync').mockReturnValue(
        JSON.stringify({
          lastSyncDate: '2024-01-01T00:00:00.000Z',
          documents: {
            'old.md': {
              key: 'old.md',
              etag: 'etag',
              lastModified: '2024-01-01T00:00:00.000Z',
              chunkCount: 2,
              status: 'indexed',
            },
          },
          version: '1.0',
        })
      );

      syncService = new SyncService(mockS3Loader, mockVectorStore);

      vi.spyOn(mockS3Loader, 'listMarkdownFiles').mockResolvedValue([
        {
          key: 'new.md',
          etag: 'etag-new',
          lastModified: new Date('2024-01-01'),
          size: 1000,
        },
      ]);

      const metrics = await syncService.performSync('full');

      expect(metrics.documentsScanned).toBe(1);
      expect(metrics.documentsAdded).toBe(1);
      expect(mockVectorStore.removeByKey).toHaveBeenCalledWith('old.md');
    });

    it('should handle errors gracefully', async () => {
      vi.spyOn(mockS3Loader, 'listMarkdownFiles').mockResolvedValue([
        {
          key: 'error.md',
          etag: 'etag',
          lastModified: new Date('2024-01-01'),
          size: 1000,
        },
      ]);

      vi.spyOn(mockS3Loader, 'loadDocument').mockRejectedValue(
        new Error('Load failed')
      );

      const metrics = await syncService.performSync('incremental');

      expect(metrics.errors.length).toBeGreaterThan(0);
      expect(metrics.errors[0].key).toBe('error.md');
    });

    it('should save state after successful sync', async () => {
      vi.spyOn(mockS3Loader, 'listMarkdownFiles').mockResolvedValue([]);

      await syncService.performSync('incremental');

      expect(fs.writeFileSync).toHaveBeenCalled();
      expect(mockVectorStore.save).toHaveBeenCalled();
    });
  });

  describe('getStats', () => {
    it('should return sync statistics', () => {
      const stats = syncService.getStats();

      expect(stats).toHaveProperty('lastSyncDate');
      expect(stats).toHaveProperty('totalDocuments');
      expect(stats).toHaveProperty('indexed');
      expect(stats).toHaveProperty('errors');
    });
  });
});

