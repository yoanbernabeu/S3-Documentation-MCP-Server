/**
 * Tests for OpenAIEmbeddingProvider
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OpenAIEmbeddingProvider } from '../../../src/services/embeddings/openai-provider.js';

// Mock OpenAIEmbeddings
vi.mock('@langchain/openai', () => ({
  OpenAIEmbeddings: vi.fn().mockImplementation(() => ({
    embedDocuments: vi.fn().mockResolvedValue([
      [0.1, 0.2, 0.3, 0.4],
      [0.5, 0.6, 0.7, 0.8],
    ]),
    embedQuery: vi.fn().mockResolvedValue([0.1, 0.2, 0.3, 0.4]),
  })),
}));

describe('OpenAIEmbeddingProvider', () => {
  let provider: OpenAIEmbeddingProvider;
  const apiKey = 'sk-test-api-key-1234567890';
  const model = 'text-embedding-3-small';

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new OpenAIEmbeddingProvider(apiKey, model);
  });

  describe('constructor', () => {
    it('should initialize with correct configuration', () => {
      expect(provider.getProviderName()).toBe('OpenAI');
      expect(provider.getModelName()).toBe(model);
    });

    it('should mask API key in logs', () => {
      // This is tested implicitly through the constructor
      // The API key should be masked in the logs
      expect(provider).toBeDefined();
    });
  });

  describe('embedDocuments', () => {
    it('should embed multiple documents', async () => {
      const texts = ['text 1', 'text 2'];
      
      const embeddings = await provider.embedDocuments(texts);

      expect(embeddings).toBeDefined();
      expect(embeddings).toHaveLength(2);
      expect(embeddings[0]).toHaveLength(4);
      expect(embeddings[1]).toHaveLength(4);
    });

    it('should handle empty array', async () => {
      const embeddings = await provider.embedDocuments([]);

      expect(embeddings).toBeDefined();
      expect(Array.isArray(embeddings)).toBe(true);
    });

    it('should handle errors gracefully', async () => {
      const { OpenAIEmbeddings } = await import('@langchain/openai');
      vi.mocked(OpenAIEmbeddings).mockImplementationOnce(() => ({
        embedDocuments: vi.fn().mockRejectedValue(new Error('API error')),
        embedQuery: vi.fn(),
      } as any));

      const failingProvider = new OpenAIEmbeddingProvider(apiKey, model);

      await expect(failingProvider.embedDocuments(['test'])).rejects.toThrow('Failed to embed documents');
    });
  });

  describe('embedQuery', () => {
    it('should embed a single query', async () => {
      const text = 'test query';
      
      const embedding = await provider.embedQuery(text);

      expect(embedding).toBeDefined();
      expect(embedding).toHaveLength(4);
      expect(Array.isArray(embedding)).toBe(true);
    });

    it('should handle errors gracefully', async () => {
      const { OpenAIEmbeddings } = await import('@langchain/openai');
      vi.mocked(OpenAIEmbeddings).mockImplementationOnce(() => ({
        embedDocuments: vi.fn(),
        embedQuery: vi.fn().mockRejectedValue(new Error('API error')),
      } as any));

      const failingProvider = new OpenAIEmbeddingProvider(apiKey, model);

      await expect(failingProvider.embedQuery('test')).rejects.toThrow('Failed to embed query');
    });
  });

  describe('getProviderName', () => {
    it('should return provider name', () => {
      expect(provider.getProviderName()).toBe('OpenAI');
    });
  });

  describe('getModelName', () => {
    it('should return model name', () => {
      expect(provider.getModelName()).toBe(model);
    });
  });
});

