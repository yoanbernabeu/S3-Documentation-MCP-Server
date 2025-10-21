/**
 * Embedding Provider Factory
 */

import type { Config, EmbeddingProvider } from '../../types/index.js';
import { logger } from '../../config/index.js';
import { OllamaEmbeddingProvider } from './ollama-provider.js';
import { OpenAIEmbeddingProvider } from './openai-provider.js';

/**
 * Create an embedding provider based on configuration
 */
export function createEmbeddingProvider(config: Config): EmbeddingProvider {
  const provider = config.embeddings.provider;
  
  logger.info(`🔧 Creating embedding provider: ${provider}`);
  
  switch (provider) {
    case 'ollama': {
      if (!config.embeddings.ollama) {
        throw new Error('Ollama configuration is missing');
      }
      
      return new OllamaEmbeddingProvider(
        config.embeddings.ollama.baseUrl,
        config.embeddings.ollama.model
      );
    }
    
    case 'openai': {
      if (!config.embeddings.openai) {
        logger.warn('⚠️  OpenAI configuration is missing, falling back to Ollama');
        
        if (!config.embeddings.ollama) {
          throw new Error('No valid embedding provider configuration found');
        }
        
        return new OllamaEmbeddingProvider(
          config.embeddings.ollama.baseUrl,
          config.embeddings.ollama.model
        );
      }
      
      return new OpenAIEmbeddingProvider(
        config.embeddings.openai.apiKey,
        config.embeddings.openai.model
      );
    }
    
    default: {
      throw new Error(`Unknown embedding provider: ${provider}`);
    }
  }
}

