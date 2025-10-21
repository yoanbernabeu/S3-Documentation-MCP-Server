/**
 * Tests for Embedding Provider Factory
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createEmbeddingProvider } from '../../../src/services/embeddings/factory.js';
import type { Config } from '../../../src/types/index.js';

// Mock providers
vi.mock('../../../src/services/embeddings/ollama-provider.js', () => ({
  OllamaEmbeddingProvider: vi.fn().mockImplementation((baseUrl, model) => ({
    embedDocuments: vi.fn(),
    embedQuery: vi.fn(),
    getProviderName: () => 'Ollama',
    getModelName: () => model,
  })),
}));

vi.mock('../../../src/services/embeddings/openai-provider.js', () => ({
  OpenAIEmbeddingProvider: vi.fn().mockImplementation((apiKey, model) => ({
    embedDocuments: vi.fn(),
    embedQuery: vi.fn(),
    getProviderName: () => 'OpenAI',
    getModelName: () => model,
  })),
}));

describe('createEmbeddingProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Ollama provider', () => {
    it('should create Ollama provider when configured', () => {
      const config: Config = {
        embeddings: {
          provider: 'ollama',
          ollama: {
            baseUrl: 'http://localhost:11434',
            model: 'nomic-embed-text',
          },
        },
      } as Config;

      const provider = createEmbeddingProvider(config);

      expect(provider).toBeDefined();
      expect(provider.getProviderName()).toBe('Ollama');
      expect(provider.getModelName()).toBe('nomic-embed-text');
    });

    it('should throw error when Ollama config is missing', () => {
      const config: Config = {
        embeddings: {
          provider: 'ollama',
        },
      } as Config;

      expect(() => createEmbeddingProvider(config)).toThrow('Ollama configuration is missing');
    });
  });

  describe('OpenAI provider', () => {
    it('should create OpenAI provider when configured', () => {
      const config: Config = {
        embeddings: {
          provider: 'openai',
          ollama: {
            baseUrl: 'http://localhost:11434',
            model: 'nomic-embed-text',
          },
          openai: {
            apiKey: 'sk-test-key',
            model: 'text-embedding-3-small',
          },
        },
      } as Config;

      const provider = createEmbeddingProvider(config);

      expect(provider).toBeDefined();
      expect(provider.getProviderName()).toBe('OpenAI');
      expect(provider.getModelName()).toBe('text-embedding-3-small');
    });

    it('should fallback to Ollama when OpenAI config is missing', () => {
      const config: Config = {
        embeddings: {
          provider: 'openai',
          ollama: {
            baseUrl: 'http://localhost:11434',
            model: 'nomic-embed-text',
          },
        },
      } as Config;

      const provider = createEmbeddingProvider(config);

      expect(provider).toBeDefined();
      expect(provider.getProviderName()).toBe('Ollama');
    });

    it('should throw error when both OpenAI and Ollama configs are missing', () => {
      const config: Config = {
        embeddings: {
          provider: 'openai',
        },
      } as Config;

      expect(() => createEmbeddingProvider(config)).toThrow('No valid embedding provider configuration found');
    });
  });

  describe('Invalid provider', () => {
    it('should throw error for unknown provider', () => {
      const config: Config = {
        embeddings: {
          provider: 'unknown' as any,
        },
      } as Config;

      expect(() => createEmbeddingProvider(config)).toThrow('Unknown embedding provider');
    });
  });
});

