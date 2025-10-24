/**
 * Tests for ResourceService
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ResourceService } from '../../src/services/resource-service.js';
import { S3Loader } from '../../src/services/s3-loader.js';
import { SyncService } from '../../src/services/sync-service.js';

// Mock dependencies
vi.mock('../../src/services/s3-loader.js');
vi.mock('../../src/services/sync-service.js');

describe('ResourceService', () => {
  let resourceService: ResourceService;
  let mockS3Loader: S3Loader;
  let mockSyncService: SyncService;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock instances
    mockS3Loader = new S3Loader();
    mockSyncService = new SyncService(mockS3Loader, {} as any);

    resourceService = new ResourceService(mockS3Loader, mockSyncService);
  });

  describe('listResources', () => {
    it('should list all indexed files as resources', async () => {
      // Mock getIndexedFiles
      vi.spyOn(mockSyncService, 'getIndexedFiles').mockReturnValue([
        {
          key: 'docs/guide.md',
          chunkCount: 3,
          lastModified: '2024-01-01T00:00:00.000Z',
          etag: 'etag1',
          size: 1000,
        },
        {
          key: 'docs/api/reference.md',
          chunkCount: 5,
          lastModified: '2024-01-02T00:00:00.000Z',
          etag: 'etag2',
          size: 2000,
        },
      ]);

      const resources = await resourceService.listResources();

      expect(resources).toHaveLength(2);
      expect(resources[0]).toEqual({
        uri: 's3doc://docs/guide.md',
        name: 'guide.md',
        description: 'Documentation file with 3 chunks',
        mimeType: 'text/markdown',
        annotations: {
          lastModified: '2024-01-01T00:00:00.000Z',
          etag: 'etag1',
          chunks: 3,
        },
      });
      expect(resources[1]).toEqual({
        uri: 's3doc://docs/api/reference.md',
        name: 'reference.md',
        description: 'Documentation file with 5 chunks',
        mimeType: 'text/markdown',
        annotations: {
          lastModified: '2024-01-02T00:00:00.000Z',
          etag: 'etag2',
          chunks: 5,
        },
      });
    });

    it('should return empty array when no files are indexed', async () => {
      vi.spyOn(mockSyncService, 'getIndexedFiles').mockReturnValue([]);

      const resources = await resourceService.listResources();

      expect(resources).toEqual([]);
    });

    it('should handle errors gracefully', async () => {
      vi.spyOn(mockSyncService, 'getIndexedFiles').mockImplementation(() => {
        throw new Error('Sync service error');
      });

      await expect(resourceService.listResources()).rejects.toThrow('Sync service error');
    });
  });

  describe('readResource', () => {
    it('should read resource content by URI', async () => {
      const mockContent = '# Documentation\n\nThis is a test file.';
      
      vi.spyOn(mockS3Loader, 'getFileContent').mockResolvedValue(mockContent);

      const result = await resourceService.readResource('s3doc://docs/test.md');

      expect(result).toEqual({
        uri: 's3doc://docs/test.md',
        mimeType: 'text/markdown',
        text: mockContent,
      });
      expect(mockS3Loader.getFileContent).toHaveBeenCalledWith('docs/test.md');
    });

    it('should extract S3 key from URI correctly', async () => {
      const mockContent = '# Test';
      
      vi.spyOn(mockS3Loader, 'getFileContent').mockResolvedValue(mockContent);

      await resourceService.readResource('s3doc://path/to/nested/file.md');

      expect(mockS3Loader.getFileContent).toHaveBeenCalledWith('path/to/nested/file.md');
    });

    it('should handle S3 loader errors', async () => {
      vi.spyOn(mockS3Loader, 'getFileContent').mockRejectedValue(
        new Error('File not found')
      );

      await expect(
        resourceService.readResource('s3doc://docs/nonexistent.md')
      ).rejects.toThrow('File not found');
    });

    it('should handle URIs without s3doc:// prefix', async () => {
      const mockContent = '# Test';
      
      vi.spyOn(mockS3Loader, 'getFileContent').mockResolvedValue(mockContent);

      await resourceService.readResource('docs/test.md');

      expect(mockS3Loader.getFileContent).toHaveBeenCalledWith('docs/test.md');
    });
  });
});

