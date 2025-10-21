/**
 * Tests for OllamaEmbeddingProvider
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OllamaEmbeddingProvider } from '../../../src/services/embeddings/ollama-provider.js';

// Mock OllamaEmbeddings
vi.mock('@langchain/community/embeddings/ollama', () => ({
  OllamaEmbeddings: vi.fn().mockImplementation(() => ({
    embedDocuments: vi.fn().mockResolvedValue([
      [0.1, 0.2, 0.3],
      [0.4, 0.5, 0.6],
    ]),
    embedQuery: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
  })),
}));

describe('OllamaEmbeddingProvider', () => {
  let provider: OllamaEmbeddingProvider;
  const baseUrl = 'http://localhost:11434';
  const model = 'nomic-embed-text';

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new OllamaEmbeddingProvider(baseUrl, model);
  });

  describe('constructor', () => {
    it('should initialize with correct configuration', () => {
      expect(provider.getProviderName()).toBe('Ollama');
      expect(provider.getModelName()).toBe(model);
    });
  });

  describe('embedDocuments', () => {
    it('should embed multiple documents', async () => {
      const texts = ['text 1', 'text 2'];
      
      const embeddings = await provider.embedDocuments(texts);

      expect(embeddings).toBeDefined();
      expect(embeddings).toHaveLength(2);
      expect(embeddings[0]).toHaveLength(3);
      expect(embeddings[1]).toHaveLength(3);
    });

    it('should handle empty array', async () => {
      const embeddings = await provider.embedDocuments([]);

      expect(embeddings).toBeDefined();
      expect(Array.isArray(embeddings)).toBe(true);
    });

    it('should handle errors gracefully', async () => {
      const { OllamaEmbeddings } = await import('@langchain/community/embeddings/ollama');
      vi.mocked(OllamaEmbeddings).mockImplementationOnce(() => ({
        embedDocuments: vi.fn().mockRejectedValue(new Error('Network error')),
        embedQuery: vi.fn(),
      } as any));

      const failingProvider = new OllamaEmbeddingProvider(baseUrl, model);

      await expect(failingProvider.embedDocuments(['test'])).rejects.toThrow('Failed to embed documents');
    });
  });

  describe('embedQuery', () => {
    it('should embed a single query', async () => {
      const text = 'test query';
      
      const embedding = await provider.embedQuery(text);

      expect(embedding).toBeDefined();
      expect(embedding).toHaveLength(3);
      expect(Array.isArray(embedding)).toBe(true);
    });

    it('should handle errors gracefully', async () => {
      const { OllamaEmbeddings } = await import('@langchain/community/embeddings/ollama');
      vi.mocked(OllamaEmbeddings).mockImplementationOnce(() => ({
        embedDocuments: vi.fn(),
        embedQuery: vi.fn().mockRejectedValue(new Error('Network error')),
      } as any));

      const failingProvider = new OllamaEmbeddingProvider(baseUrl, model);

      await expect(failingProvider.embedQuery('test')).rejects.toThrow('Failed to embed query');
    });
  });

  describe('getProviderName', () => {
    it('should return provider name', () => {
      expect(provider.getProviderName()).toBe('Ollama');
    });
  });

  describe('getModelName', () => {
    it('should return model name', () => {
      expect(provider.getModelName()).toBe(model);
    });
  });
});

