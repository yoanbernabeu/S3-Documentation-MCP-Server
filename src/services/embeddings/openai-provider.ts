/**
 * OpenAI Embedding Provider
 */

import { OpenAIEmbeddings } from '@langchain/openai';
import type { EmbeddingProvider } from '../../types/index.js';
import { logger } from '../../config/index.js';

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  private embeddings: OpenAIEmbeddings;
  private model: string;

  constructor(apiKey: string, model: string) {
    this.model = model;
    
    this.embeddings = new OpenAIEmbeddings({
      openAIApiKey: apiKey,
      modelName: this.model,
    });
    
    logger.info(`🤖 OpenAI Embedding Provider initialized`);
    logger.info(`   Model: ${this.model}`);
    logger.info(`   API Key: ${this.maskApiKey(apiKey)}`);
  }

  private maskApiKey(apiKey: string): string {
    if (apiKey.length <= 8) {
      return '***';
    }
    return `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`;
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    try {
      logger.debug(`🧮 Embedding ${texts.length} documents with OpenAI...`);
      const startTime = Date.now();
      
      const embeddings = await this.embeddings.embedDocuments(texts);
      
      const duration = Date.now() - startTime;
      logger.debug(`✅ Documents embedded in ${duration}ms`);
      
      return embeddings;
    } catch (error) {
      logger.error(`❌ Error embedding documents with OpenAI:`, error);
      throw new Error(`Failed to embed documents: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async embedQuery(text: string): Promise<number[]> {
    try {
      logger.debug(`🧮 Embedding query with OpenAI...`);
      const startTime = Date.now();
      
      const embedding = await this.embeddings.embedQuery(text);
      
      const duration = Date.now() - startTime;
      logger.debug(`✅ Query embedded in ${duration}ms`);
      
      return embedding;
    } catch (error) {
      logger.error(`❌ Error embedding query with OpenAI:`, error);
      throw new Error(`Failed to embed query: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  getProviderName(): string {
    return 'OpenAI';
  }

  getModelName(): string {
    return this.model;
  }
}

