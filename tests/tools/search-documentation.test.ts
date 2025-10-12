/**
 * Tests for search-documentation tool
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { searchDocumentation } from '../../src/tools/search-documentation.js';
import { HNSWVectorStore } from '../../src/services/hnswlib-vector-store.js';
import type { SearchResult } from '../../src/types/index.js';

vi.mock('../../src/services/hnswlib-vector-store.js');

describe('search-documentation tool', () => {
  let mockVectorStore: HNSWVectorStore;

  beforeEach(() => {
    vi.clearAllMocks();
    mockVectorStore = new HNSWVectorStore();
  });

  describe('searchDocumentation', () => {
    it('should return search results with formatted context', async () => {
      const mockResults: SearchResult[] = [
        {
          document: {
            id: 'id1',
            s3_key: 'doc1.md',
            s3_etag: 'etag1',
            content: 'This is the first result content',
            chunk_index: 0,
            total_chunks: 2,
            indexed_at: '2024-01-01T00:00:00.000Z',
            source: 's3://bucket/doc1.md',
          },
          score: 0.85,
        },
        {
          document: {
            id: 'id2',
            s3_key: 'doc2.md',
            s3_etag: 'etag2',
            content: 'This is the second result content',
            chunk_index: 1,
            total_chunks: 3,
            indexed_at: '2024-01-01T00:00:00.000Z',
            source: 's3://bucket/doc2.md',
          },
          score: 0.72,
        },
      ];

      vi.spyOn(mockVectorStore, 'similaritySearch').mockResolvedValue(mockResults);

      const result = await searchDocumentation(
        { query: 'test query' },
        mockVectorStore
      );

      expect(result.results).toHaveLength(2);
      expect(result.total_results).toBe(2);
      expect(result.results[0]).toMatchObject({
        content: 'This is the first result content',
        source: 'doc1.md',
        score: 0.85,
        chunk_info: 'Chunk 1/2',
      });
      expect(result.results[1]).toMatchObject({
        content: 'This is the second result content',
        source: 'doc2.md',
        score: 0.72,
        chunk_info: 'Chunk 2/3',
      });
      expect(result.context).toContain('doc1.md');
      expect(result.context).toContain('doc2.md');
      expect(result.context).toContain('85%');
      expect(result.context).toContain('72%');
    });

    it('should respect max_results parameter', async () => {
      const mockResults: SearchResult[] = [
        {
          document: {
            id: 'id1',
            s3_key: 'doc1.md',
            s3_etag: 'etag1',
            content: 'Content 1',
            chunk_index: 0,
            total_chunks: 1,
            indexed_at: '2024-01-01T00:00:00.000Z',
            source: 's3://bucket/doc1.md',
          },
          score: 0.9,
        },
      ];

      vi.spyOn(mockVectorStore, 'similaritySearch').mockResolvedValue(mockResults);

      await searchDocumentation(
        { query: 'test query', max_results: 2 },
        mockVectorStore
      );

      expect(mockVectorStore.similaritySearch).toHaveBeenCalledWith('test query', 2);
    });

    it('should use default max_results when not provided', async () => {
      vi.spyOn(mockVectorStore, 'similaritySearch').mockResolvedValue([]);

      await searchDocumentation({ query: 'test query' }, mockVectorStore);

      expect(mockVectorStore.similaritySearch).toHaveBeenCalledWith(
        'test query',
        undefined
      );
    });

    it('should return helpful message when no results found', async () => {
      vi.spyOn(mockVectorStore, 'similaritySearch').mockResolvedValue([]);

      const result = await searchDocumentation(
        { query: 'nonexistent query' },
        mockVectorStore
      );

      expect(result.results).toHaveLength(0);
      expect(result.total_results).toBe(0);
      expect(result.context).toContain('No match found');
      expect(result.context).toContain('nonexistent query');
    });

    it('should provide keyword search tip for isolated keywords', async () => {
      vi.spyOn(mockVectorStore, 'similaritySearch').mockResolvedValue([]);

      const result = await searchDocumentation(
        { query: 'Python' },
        mockVectorStore
      );

      expect(result.context).toContain('Tip');
      expect(result.context).toContain('What is Python?');
      expect(result.context).toContain('How does Python work?');
    });

    it('should not show keyword tip for complete questions', async () => {
      vi.spyOn(mockVectorStore, 'similaritySearch').mockResolvedValue([]);

      const result = await searchDocumentation(
        { query: 'How does Python work?' },
        mockVectorStore
      );

      expect(result.context).not.toContain('Tip');
      expect(result.context).not.toContain('isolated keywords');
    });

    it('should round scores to 2 decimals', async () => {
      const mockResults: SearchResult[] = [
        {
          document: {
            id: 'id1',
            s3_key: 'doc1.md',
            s3_etag: 'etag1',
            content: 'Content',
            chunk_index: 0,
            total_chunks: 1,
            indexed_at: '2024-01-01T00:00:00.000Z',
            source: 's3://bucket/doc1.md',
          },
          score: 0.856789,
        },
      ];

      vi.spyOn(mockVectorStore, 'similaritySearch').mockResolvedValue(mockResults);

      const result = await searchDocumentation(
        { query: 'test' },
        mockVectorStore
      );

      expect(result.results[0].score).toBe(0.86);
    });

    it('should format context with multiple sources correctly', async () => {
      const mockResults: SearchResult[] = [
        {
          document: {
            id: 'id1',
            s3_key: 'python.md',
            s3_etag: 'etag1',
            content: 'Python is a programming language',
            chunk_index: 0,
            total_chunks: 1,
            indexed_at: '2024-01-01T00:00:00.000Z',
            source: 's3://bucket/python.md',
          },
          score: 0.9,
        },
        {
          document: {
            id: 'id2',
            s3_key: 'javascript.md',
            s3_etag: 'etag2',
            content: 'JavaScript is also a programming language',
            chunk_index: 0,
            total_chunks: 1,
            indexed_at: '2024-01-01T00:00:00.000Z',
            source: 's3://bucket/javascript.md',
          },
          score: 0.8,
        },
      ];

      vi.spyOn(mockVectorStore, 'similaritySearch').mockResolvedValue(mockResults);

      const result = await searchDocumentation(
        { query: 'programming languages' },
        mockVectorStore
      );

      expect(result.context).toContain('Source 1: python.md');
      expect(result.context).toContain('Source 2: javascript.md');
      expect(result.context).toContain('similarity: 90%');
      expect(result.context).toContain('similarity: 80%');
      expect(result.context).toContain('---'); // Separator between results
    });

    it('should handle errors from vector store', async () => {
      vi.spyOn(mockVectorStore, 'similaritySearch').mockRejectedValue(
        new Error('Vector store error')
      );

      await expect(
        searchDocumentation({ query: 'test' }, mockVectorStore)
      ).rejects.toThrow('Error during search');
    });
  });
});

