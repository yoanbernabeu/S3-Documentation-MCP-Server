/**
 * Tests for S3Loader service
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { S3Client, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';
import { mockClient } from 'aws-sdk-client-mock';
import { Readable } from 'stream';
import { S3Loader } from '../../src/services/s3-loader.js';

// Create mock for S3Client
const s3Mock = mockClient(S3Client);

describe('S3Loader', () => {
  let s3Loader: S3Loader;

  beforeEach(() => {
    // Reset mocks before each test
    s3Mock.reset();
    s3Loader = new S3Loader();
  });

  describe('listMarkdownFiles', () => {
    it('should list all markdown files from S3', async () => {
      // Mock S3 response
      s3Mock.on(ListObjectsV2Command).resolves({
        Contents: [
          {
            Key: 'docs/file1.md',
            ETag: '"etag1"',
            LastModified: new Date('2024-01-01'),
            Size: 1000,
          },
          {
            Key: 'docs/file2.md',
            ETag: '"etag2"',
            LastModified: new Date('2024-01-02'),
            Size: 2000,
          },
          {
            Key: 'docs/file3.txt', // Non-markdown file
            ETag: '"etag3"',
            LastModified: new Date('2024-01-03'),
            Size: 500,
          },
        ],
      });

      const documents = await s3Loader.listMarkdownFiles();

      expect(documents).toHaveLength(2);
      expect(documents[0]).toMatchObject({
        key: 'docs/file1.md',
        etag: '"etag1"',
        size: 1000,
      });
      expect(documents[1]).toMatchObject({
        key: 'docs/file2.md',
        etag: '"etag2"',
        size: 2000,
      });
    });

    it('should handle pagination correctly', async () => {
      // Reset mock to allow multiple responses
      s3Mock.reset();
      
      // First page
      s3Mock.on(ListObjectsV2Command).resolvesOnce({
        Contents: [
          {
            Key: 'docs/file1.md',
            ETag: '"etag1"',
            LastModified: new Date('2024-01-01'),
            Size: 1000,
          },
        ],
        NextContinuationToken: 'token123',
      }).resolvesOnce({
        // Second page
        Contents: [
          {
            Key: 'docs/file2.md',
            ETag: '"etag2"',
            LastModified: new Date('2024-01-02'),
            Size: 2000,
          },
        ],
      });

      const documents = await s3Loader.listMarkdownFiles();

      expect(documents).toHaveLength(2);
      expect(s3Mock.calls()).toHaveLength(2);
    });

    it('should return empty array when no files found', async () => {
      s3Mock.on(ListObjectsV2Command).resolves({
        Contents: [],
      });

      const documents = await s3Loader.listMarkdownFiles();

      expect(documents).toHaveLength(0);
    });

    it('should throw error on S3 failure', async () => {
      s3Mock.on(ListObjectsV2Command).rejects(new Error('S3 Error'));

      await expect(s3Loader.listMarkdownFiles()).rejects.toThrow('Unable to list S3 files');
    });
  });

  describe('getFileContent', () => {
    it('should download and return file content', async () => {
      const mockContent = '# Test Markdown\n\nThis is test content.';
      const stream = Readable.from([mockContent]);
      
      // Add transformToString method to the stream
      (stream as any).transformToString = async () => mockContent;

      s3Mock.on(GetObjectCommand).resolves({
        Body: stream as any,
      });

      const content = await s3Loader.getFileContent('docs/test.md');

      expect(content).toBe(mockContent);
    });

    it('should throw error when file has no content', async () => {
      s3Mock.on(GetObjectCommand).resolves({
        Body: undefined,
      });

      await expect(s3Loader.getFileContent('docs/empty.md')).rejects.toThrow(
        'No content for docs/empty.md'
      );
    });

    it('should throw error on download failure', async () => {
      s3Mock.on(GetObjectCommand).rejects(new Error('Download failed'));

      await expect(s3Loader.getFileContent('docs/test.md')).rejects.toThrow(
        'Unable to download'
      );
    });
  });

  describe('loadDocument', () => {
    it('should load document with its content', async () => {
      const mockContent = '# Test Document\n\nContent here.';
      const stream = Readable.from([mockContent]);
      (stream as any).transformToString = async () => mockContent;

      s3Mock.on(GetObjectCommand).resolves({
        Body: stream as any,
      });

      const doc = {
        key: 'docs/test.md',
        etag: '"etag123"',
        lastModified: new Date('2024-01-01'),
        size: 1000,
      };

      const loadedDoc = await s3Loader.loadDocument(doc);

      expect(loadedDoc).toMatchObject({
        ...doc,
        content: mockContent,
      });
    });
  });

  describe('loadAllDocuments', () => {
    it('should load all documents with their content', async () => {
      s3Mock.reset();
      
      // Mock listMarkdownFiles
      s3Mock.on(ListObjectsV2Command).resolves({
        Contents: [
          {
            Key: 'docs/file1.md',
            ETag: '"etag1"',
            LastModified: new Date('2024-01-01'),
            Size: 1000,
          },
          {
            Key: 'docs/file2.md',
            ETag: '"etag2"',
            LastModified: new Date('2024-01-02'),
            Size: 2000,
          },
        ],
      });

      // Mock getFileContent calls
      const stream1 = Readable.from(['# File 1']);
      (stream1 as any).transformToString = async () => '# File 1';
      
      const stream2 = Readable.from(['# File 2']);
      (stream2 as any).transformToString = async () => '# File 2';

      s3Mock.on(GetObjectCommand).callsFake((input) => {
        if (input.Key === 'docs/file1.md') {
          return { Body: stream1 as any };
        } else if (input.Key === 'docs/file2.md') {
          return { Body: stream2 as any };
        }
        return { Body: undefined };
      });

      const documents = await s3Loader.loadAllDocuments();

      expect(documents).toHaveLength(2);
      expect(documents[0].content).toBe('# File 1');
      expect(documents[1].content).toBe('# File 2');
    });

    it('should continue loading even if one document fails', async () => {
      s3Mock.reset();
      
      s3Mock.on(ListObjectsV2Command).resolves({
        Contents: [
          {
            Key: 'docs/file1.md',
            ETag: '"etag1"',
            LastModified: new Date('2024-01-01'),
            Size: 1000,
          },
          {
            Key: 'docs/file2.md',
            ETag: '"etag2"',
            LastModified: new Date('2024-01-02'),
            Size: 2000,
          },
        ],
      });

      const stream1 = Readable.from(['# File 1']);
      (stream1 as any).transformToString = async () => '# File 1';

      s3Mock.on(GetObjectCommand).callsFake((input) => {
        if (input.Key === 'docs/file1.md') {
          return { Body: stream1 as any };
        } else if (input.Key === 'docs/file2.md') {
          throw new Error('Failed to download');
        }
        return { Body: undefined };
      });

      const documents = await s3Loader.loadAllDocuments();

      expect(documents).toHaveLength(1);
      expect(documents[0].content).toBe('# File 1');
    });
  });

  describe('getFileMetadata', () => {
    it('should retrieve file metadata without content', async () => {
      s3Mock.on(GetObjectCommand).resolves({
        ETag: '"etag123"',
        LastModified: new Date('2024-01-01'),
        ContentLength: 1500,
      });

      const metadata = await s3Loader.getFileMetadata('docs/test.md');

      expect(metadata).toMatchObject({
        key: 'docs/test.md',
        etag: '"etag123"',
        size: 1500,
      });
      expect(metadata?.content).toBeUndefined();
    });

    it('should return null on error', async () => {
      s3Mock.on(GetObjectCommand).rejects(new Error('File not found'));

      const metadata = await s3Loader.getFileMetadata('docs/nonexistent.md');

      expect(metadata).toBeNull();
    });
  });
});

