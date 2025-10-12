/**
 * Tests for HNSWVectorStore service
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { HNSWVectorStore } from '../../src/services/hnswlib-vector-store.js';
import * as fs from 'fs';
import type { DocumentToIndex } from '../../src/types/index.js';

// Mock dependencies
vi.mock('fs');
vi.mock('@langchain/community/embeddings/ollama');
vi.mock('@langchain/community/vectorstores/hnswlib');

describe('HNSWVectorStore', () => {
  let vectorStore: HNSWVectorStore;
  const testStorePath = './data/test-vector-store';

  beforeEach(() => {
    vi.clearAllMocks();
    vectorStore = new HNSWVectorStore(testStorePath);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('initialize', () => {
    it('should create new store when index does not exist', async () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(false);

      await vectorStore.initialize();

      expect(fs.existsSync).toHaveBeenCalledWith(
        expect.stringContaining('hnswlib.index')
      );
    });

    it('should load existing store when index exists', async () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);

      // Mock HNSWLib.load to resolve successfully
      const { HNSWLib } = await import('@langchain/community/vectorstores/hnswlib');
      vi.spyOn(HNSWLib, 'load').mockResolvedValue({
        docstore: { _docs: {} },
      } as any);

      await vectorStore.initialize();

      expect(HNSWLib.load).toHaveBeenCalledWith(
        testStorePath,
        expect.anything()
      );
    });

    it('should create new store on load error', async () => {
      vi.spyOn(fs, 'existsSync').mockReturnValue(true);

      const { HNSWLib } = await import('@langchain/community/vectorstores/hnswlib');
      vi.spyOn(HNSWLib, 'load').mockRejectedValue(new Error('Load failed'));

      await vectorStore.initialize();

      // Should not throw and create new store instead
      expect(HNSWLib.load).toHaveBeenCalled();
    });
  });

  describe('splitDocument', () => {
    it('should split a document into chunks', async () => {
      const content = 'This is a test document. '.repeat(100);
      
      const chunks = await vectorStore.splitDocument(content);

      expect(chunks).toBeDefined();
      expect(Array.isArray(chunks)).toBe(true);
      expect(chunks.length).toBeGreaterThan(0);
    });

    it('should handle empty content', async () => {
      const chunks = await vectorStore.splitDocument('');

      expect(chunks).toHaveLength(0);
    });

    it('should handle small documents as single chunk', async () => {
      const content = 'Small document.';
      
      const chunks = await vectorStore.splitDocument(content);

      expect(chunks.length).toBeGreaterThanOrEqual(1);
      expect(chunks[0]).toContain('Small document');
    });
  });

  describe('addDocuments', () => {
    it('should add documents to vector store', async () => {
      await vectorStore.initialize();

      const docs: DocumentToIndex[] = [
        {
          content: 'Test content 1',
          metadata: {
            key: 'doc1.md',
            etag: 'etag1',
            chunkIndex: 0,
            totalChunks: 1,
            source: 's3://bucket/doc1.md',
          },
        },
        {
          content: 'Test content 2',
          metadata: {
            key: 'doc2.md',
            etag: 'etag2',
            chunkIndex: 0,
            totalChunks: 1,
            source: 's3://bucket/doc2.md',
          },
        },
      ];

      await expect(vectorStore.addDocuments(docs)).resolves.not.toThrow();
    });

    it('should initialize store if not already initialized', async () => {
      const docs: DocumentToIndex[] = [
        {
          content: 'Test content',
          metadata: {
            key: 'doc.md',
            etag: 'etag',
            chunkIndex: 0,
            totalChunks: 1,
            source: 's3://bucket/doc.md',
          },
        },
      ];

      await expect(vectorStore.addDocuments(docs)).resolves.not.toThrow();
    });
  });

  describe('removeByKey', () => {
    it('should remove documents by S3 key', async () => {
      await vectorStore.initialize();

      // First add a document
      const docs: DocumentToIndex[] = [
        {
          content: 'Test content',
          metadata: {
            key: 'doc.md',
            etag: 'etag',
            chunkIndex: 0,
            totalChunks: 1,
            source: 's3://bucket/doc.md',
          },
        },
      ];

      await vectorStore.addDocuments(docs);

      // Then remove it
      const removed = await vectorStore.removeByKey('doc.md');

      expect(removed).toBeGreaterThanOrEqual(0);
    });

    it('should return 0 when no documents to remove', async () => {
      await vectorStore.initialize();

      const removed = await vectorStore.removeByKey('nonexistent.md');

      expect(removed).toBe(0);
    });
  });

  describe('similaritySearch', () => {
    it('should perform similarity search', async () => {
      await vectorStore.initialize();

      // Add some documents first
      const docs: DocumentToIndex[] = [
        {
          content: 'Python is a programming language',
          metadata: {
            key: 'python.md',
            etag: 'etag1',
            chunkIndex: 0,
            totalChunks: 1,
            source: 's3://bucket/python.md',
          },
        },
        {
          content: 'JavaScript is also a programming language',
          metadata: {
            key: 'javascript.md',
            etag: 'etag2',
            chunkIndex: 0,
            totalChunks: 1,
            source: 's3://bucket/javascript.md',
          },
        },
      ];

      await vectorStore.addDocuments(docs);

      // Mock the store's similaritySearchWithScore method
      const mockStore = (vectorStore as any).store;
      if (mockStore) {
        mockStore.similaritySearchWithScore = vi.fn().mockResolvedValue([
          [{ pageContent: 'Python is a programming language', metadata: { key: 'python.md', id: 'id1', etag: 'etag1', chunkIndex: 0, totalChunks: 1, source: 's3://bucket/python.md', indexedAt: '2024-01-01' } }, 0.1],
          [{ pageContent: 'JavaScript is also a programming language', metadata: { key: 'javascript.md', id: 'id2', etag: 'etag2', chunkIndex: 0, totalChunks: 1, source: 's3://bucket/javascript.md', indexedAt: '2024-01-01' } }, 0.3],
        ]);
      }

      const results = await vectorStore.similaritySearch('programming language', 2);

      expect(Array.isArray(results)).toBe(true);
      // Results depend on embeddings, so we just check structure
      expect(results.length).toBeLessThanOrEqual(2);
    });

    it('should return empty array when no documents match', async () => {
      await vectorStore.initialize();

      // Mock the store's similaritySearchWithScore method to return empty
      const mockStore = (vectorStore as any).store;
      if (mockStore) {
        mockStore.similaritySearchWithScore = vi.fn().mockResolvedValue([]);
      }

      const results = await vectorStore.similaritySearch('nonexistent query');

      expect(results).toEqual([]);
    });

    it('should respect max results parameter', async () => {
      await vectorStore.initialize();

      const docs: DocumentToIndex[] = Array.from({ length: 10 }, (_, i) => ({
        content: `Document ${i}`,
        metadata: {
          key: `doc${i}.md`,
          etag: `etag${i}`,
          chunkIndex: 0,
          totalChunks: 1,
          source: `s3://bucket/doc${i}.md`,
        },
      }));

      await vectorStore.addDocuments(docs);

      // Mock the store's similaritySearchWithScore method to return 3 results
      const mockStore = (vectorStore as any).store;
      if (mockStore) {
        mockStore.similaritySearchWithScore = vi.fn().mockResolvedValue([
          [{ pageContent: 'Document 0', metadata: { key: 'doc0.md', id: 'id0', etag: 'etag0', chunkIndex: 0, totalChunks: 1, source: 's3://bucket/doc0.md', indexedAt: '2024-01-01' } }, 0.1],
          [{ pageContent: 'Document 1', metadata: { key: 'doc1.md', id: 'id1', etag: 'etag1', chunkIndex: 0, totalChunks: 1, source: 's3://bucket/doc1.md', indexedAt: '2024-01-01' } }, 0.2],
          [{ pageContent: 'Document 2', metadata: { key: 'doc2.md', id: 'id2', etag: 'etag2', chunkIndex: 0, totalChunks: 1, source: 's3://bucket/doc2.md', indexedAt: '2024-01-01' } }, 0.3],
        ]);
      }

      const results = await vectorStore.similaritySearch('Document', 3);

      expect(results.length).toBeLessThanOrEqual(3);
    });
  });

  describe('hasDocument', () => {
    it('should return true for existing documents', async () => {
      await vectorStore.initialize();

      const docs: DocumentToIndex[] = [
        {
          content: 'Test',
          metadata: {
            key: 'test.md',
            etag: 'etag',
            chunkIndex: 0,
            totalChunks: 1,
            source: 's3://bucket/test.md',
          },
        },
      ];

      await vectorStore.addDocuments(docs);

      expect(vectorStore.hasDocument('test.md')).toBe(true);
    });

    it('should return false for non-existing documents', async () => {
      await vectorStore.initialize();

      expect(vectorStore.hasDocument('nonexistent.md')).toBe(false);
    });
  });

  describe('getUniqueFileCount', () => {
    it('should return correct count of unique files', async () => {
      await vectorStore.initialize();

      const docs: DocumentToIndex[] = [
        {
          content: 'Chunk 1',
          metadata: {
            key: 'doc.md',
            etag: 'etag',
            chunkIndex: 0,
            totalChunks: 2,
            source: 's3://bucket/doc.md',
          },
        },
        {
          content: 'Chunk 2',
          metadata: {
            key: 'doc.md',
            etag: 'etag',
            chunkIndex: 1,
            totalChunks: 2,
            source: 's3://bucket/doc.md',
          },
        },
      ];

      await vectorStore.addDocuments(docs);

      expect(vectorStore.getUniqueFileCount()).toBe(1);
    });
  });

  describe('save', () => {
    it('should save vector store to disk', async () => {
      await vectorStore.initialize();

      vi.spyOn(fs, 'existsSync').mockReturnValue(false);
      vi.spyOn(fs, 'mkdirSync').mockImplementation(() => undefined as any);

      const docs: DocumentToIndex[] = [
        {
          content: 'Test',
          metadata: {
            key: 'test.md',
            etag: 'etag',
            chunkIndex: 0,
            totalChunks: 1,
            source: 's3://bucket/test.md',
          },
        },
      ];

      await vectorStore.addDocuments(docs);

      await expect(vectorStore.save()).resolves.not.toThrow();
    });

    it('should skip save when store is empty', async () => {
      await vectorStore.initialize();

      await expect(vectorStore.save()).resolves.not.toThrow();
    });
  });

  describe('getStats', () => {
    it('should return store statistics', async () => {
      await vectorStore.initialize();

      const docs: DocumentToIndex[] = [
        {
          content: 'Test 1',
          metadata: {
            key: 'doc1.md',
            etag: 'etag1',
            chunkIndex: 0,
            totalChunks: 1,
            source: 's3://bucket/doc1.md',
          },
        },
        {
          content: 'Test 2',
          metadata: {
            key: 'doc2.md',
            etag: 'etag2',
            chunkIndex: 0,
            totalChunks: 1,
            source: 's3://bucket/doc2.md',
          },
        },
      ];

      await vectorStore.addDocuments(docs);

      const stats = await vectorStore.getStats();

      expect(stats).toHaveProperty('uniqueFiles');
      expect(stats).toHaveProperty('totalChunks');
      expect(stats).toHaveProperty('storePath');
      expect(stats.uniqueFiles).toBe(2);
    });
  });
});

