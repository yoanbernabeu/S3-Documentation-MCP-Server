/**
 * Tests for get-full-document tool
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getFullDocument } from '../../src/tools/get-full-document.js';
import { S3Loader } from '../../src/services/s3-loader.js';
import { SyncService } from '../../src/services/sync-service.js';
import type { S3Document } from '../../src/types/index.js';

vi.mock('../../src/services/s3-loader.js');
vi.mock('../../src/services/sync-service.js');

describe('get-full-document tool', () => {
  let mockS3Loader: S3Loader;
  let mockSyncService: SyncService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockS3Loader = new S3Loader();
    mockSyncService = new SyncService(mockS3Loader, {} as any);
  });

  describe('getFullDocument', () => {
    it('should return full document with metadata', async () => {
      const mockContent = '# Test Document\n\nThis is a test markdown document.';
      const mockMetadata: S3Document = {
        key: 'docs/test.md',
        etag: 'test-etag-123',
        lastModified: new Date('2024-01-01T00:00:00.000Z'),
        size: 45,
      };
      const mockDocumentInfo = {
        key: 'docs/test.md',
        etag: 'test-etag-123',
        lastModified: '2024-01-01T00:00:00.000Z',
        chunkCount: 3,
        status: 'indexed' as const,
      };

      vi.spyOn(mockS3Loader, 'getFileContent').mockResolvedValue(mockContent);
      vi.spyOn(mockS3Loader, 'getFileMetadata').mockResolvedValue(mockMetadata);
      vi.spyOn(mockSyncService, 'getDocumentInfo').mockReturnValue(mockDocumentInfo);

      const result = await getFullDocument(
        { s3_key: 'docs/test.md' },
        mockS3Loader,
        mockSyncService
      );

      expect(result.s3_key).toBe('docs/test.md');
      expect(result.content).toBe(mockContent);
      expect(result.metadata).toMatchObject({
        size_bytes: 45,
        last_modified: '2024-01-01T00:00:00.000Z',
        etag: 'test-etag-123',
        chunk_count: 3,
      });

      expect(mockS3Loader.getFileContent).toHaveBeenCalledWith('docs/test.md');
      expect(mockS3Loader.getFileMetadata).toHaveBeenCalledWith('docs/test.md');
      expect(mockSyncService.getDocumentInfo).toHaveBeenCalledWith('docs/test.md');
    });

    it('should handle document without chunk count (not yet indexed)', async () => {
      const mockContent = '# New Document';
      const mockMetadata: S3Document = {
        key: 'docs/new.md',
        etag: 'new-etag',
        lastModified: new Date('2024-02-01T00:00:00.000Z'),
        size: 15,
      };

      vi.spyOn(mockS3Loader, 'getFileContent').mockResolvedValue(mockContent);
      vi.spyOn(mockS3Loader, 'getFileMetadata').mockResolvedValue(mockMetadata);
      vi.spyOn(mockSyncService, 'getDocumentInfo').mockReturnValue(null);

      const result = await getFullDocument(
        { s3_key: 'docs/new.md' },
        mockS3Loader,
        mockSyncService
      );

      expect(result.s3_key).toBe('docs/new.md');
      expect(result.content).toBe(mockContent);
      expect(result.metadata.chunk_count).toBeUndefined();
    });

    it('should throw error when content is empty', async () => {
      const mockMetadata: S3Document = {
        key: 'docs/empty.md',
        etag: 'empty-etag',
        lastModified: new Date('2024-01-01T00:00:00.000Z'),
        size: 0,
      };

      vi.spyOn(mockS3Loader, 'getFileContent').mockResolvedValue('');
      vi.spyOn(mockS3Loader, 'getFileMetadata').mockResolvedValue(mockMetadata);

      await expect(
        getFullDocument({ s3_key: 'docs/empty.md' }, mockS3Loader, mockSyncService)
      ).rejects.toThrow('has no content');
    });

    it('should throw error when metadata cannot be retrieved', async () => {
      const mockContent = '# Test';

      vi.spyOn(mockS3Loader, 'getFileContent').mockResolvedValue(mockContent);
      vi.spyOn(mockS3Loader, 'getFileMetadata').mockResolvedValue(null);

      await expect(
        getFullDocument({ s3_key: 'docs/test.md' }, mockS3Loader, mockSyncService)
      ).rejects.toThrow('Unable to retrieve metadata');
    });

    it('should throw user-friendly error for non-existent document', async () => {
      const error = new Error('NoSuchKey: The specified key does not exist');

      vi.spyOn(mockS3Loader, 'getFileContent').mockRejectedValue(error);
      vi.spyOn(mockSyncService, 'getDocumentInfo').mockReturnValue(null);

      await expect(
        getFullDocument({ s3_key: 'docs/nonexistent.md' }, mockS3Loader, mockSyncService)
      ).rejects.toThrow('not found in S3');
    });

    it('should provide helpful message when document is indexed but not in S3', async () => {
      const error = new Error('NoSuchKey: The specified key does not exist');
      const mockDocumentInfo = {
        key: 'docs/deleted.md',
        etag: 'old-etag',
        lastModified: '2024-01-01T00:00:00.000Z',
        chunkCount: 5,
        status: 'indexed' as const,
      };

      vi.spyOn(mockS3Loader, 'getFileContent').mockRejectedValue(error);
      vi.spyOn(mockSyncService, 'getDocumentInfo').mockReturnValue(mockDocumentInfo);

      await expect(
        getFullDocument({ s3_key: 'docs/deleted.md' }, mockS3Loader, mockSyncService)
      ).rejects.toThrow(/was found in the index.*no longer available in S3.*refresh_index/);
    });

    it('should handle generic S3 errors', async () => {
      const error = new Error('S3 connection timeout');

      vi.spyOn(mockS3Loader, 'getFileContent').mockRejectedValue(error);

      await expect(
        getFullDocument({ s3_key: 'docs/test.md' }, mockS3Loader, mockSyncService)
      ).rejects.toThrow('Error fetching document');
    });

    it('should handle large documents', async () => {
      const largeContent = 'A'.repeat(1000000); // 1MB of content
      const mockMetadata: S3Document = {
        key: 'docs/large.md',
        etag: 'large-etag',
        lastModified: new Date('2024-01-01T00:00:00.000Z'),
        size: 1000000,
      };
      const mockDocumentInfo = {
        key: 'docs/large.md',
        etag: 'large-etag',
        lastModified: '2024-01-01T00:00:00.000Z',
        chunkCount: 50,
        status: 'indexed' as const,
      };

      vi.spyOn(mockS3Loader, 'getFileContent').mockResolvedValue(largeContent);
      vi.spyOn(mockS3Loader, 'getFileMetadata').mockResolvedValue(mockMetadata);
      vi.spyOn(mockSyncService, 'getDocumentInfo').mockReturnValue(mockDocumentInfo);

      const result = await getFullDocument(
        { s3_key: 'docs/large.md' },
        mockS3Loader,
        mockSyncService
      );

      expect(result.content.length).toBe(1000000);
      expect(result.metadata.size_bytes).toBe(1000000);
      expect(result.metadata.chunk_count).toBe(50);
    });

    it('should correctly format ISO date in metadata', async () => {
      const mockContent = '# Test';
      const testDate = new Date('2024-06-15T14:30:00.000Z');
      const mockMetadata: S3Document = {
        key: 'docs/test.md',
        etag: 'test-etag',
        lastModified: testDate,
        size: 10,
      };

      vi.spyOn(mockS3Loader, 'getFileContent').mockResolvedValue(mockContent);
      vi.spyOn(mockS3Loader, 'getFileMetadata').mockResolvedValue(mockMetadata);
      vi.spyOn(mockSyncService, 'getDocumentInfo').mockReturnValue(null);

      const result = await getFullDocument(
        { s3_key: 'docs/test.md' },
        mockS3Loader,
        mockSyncService
      );

      expect(result.metadata.last_modified).toBe('2024-06-15T14:30:00.000Z');
    });
  });
});

