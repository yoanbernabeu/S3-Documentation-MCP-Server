/**
 * Ollama Embedding Provider
 */

import { OllamaEmbeddings } from '@langchain/community/embeddings/ollama';
import type { EmbeddingProvider } from '../../types/index.js';
import { logger } from '../../config/index.js';

export class OllamaEmbeddingProvider implements EmbeddingProvider {
  private embeddings: OllamaEmbeddings;
  private baseUrl: string;
  private model: string;

  constructor(baseUrl: string, model: string) {
    this.baseUrl = baseUrl;
    this.model = model;
    
    this.embeddings = new OllamaEmbeddings({
      model: this.model,
      baseUrl: this.baseUrl,
    });
    
    logger.info(`🤖 Ollama Embedding Provider initialized`);
    logger.info(`   Model: ${this.model}`);
    logger.info(`   Base URL: ${this.baseUrl}`);
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    try {
      logger.debug(`🧮 Embedding ${texts.length} documents with Ollama...`);
      const startTime = Date.now();
      
      const embeddings = await this.embeddings.embedDocuments(texts);
      
      const duration = Date.now() - startTime;
      logger.debug(`✅ Documents embedded in ${duration}ms`);
      
      return embeddings;
    } catch (error) {
      logger.error(`❌ Error embedding documents with Ollama:`, error);
      throw new Error(`Failed to embed documents: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async embedQuery(text: string): Promise<number[]> {
    try {
      logger.debug(`🧮 Embedding query with Ollama...`);
      const startTime = Date.now();
      
      const embedding = await this.embeddings.embedQuery(text);
      
      const duration = Date.now() - startTime;
      logger.debug(`✅ Query embedded in ${duration}ms`);
      
      return embedding;
    } catch (error) {
      logger.error(`❌ Error embedding query with Ollama:`, error);
      throw new Error(`Failed to embed query: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  getProviderName(): string {
    return 'Ollama';
  }

  getModelName(): string {
    return this.model;
  }
}

