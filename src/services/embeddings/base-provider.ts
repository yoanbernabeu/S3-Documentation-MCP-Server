/**
 * Base Embedding Provider
 * Extracts common logging, timing, and error handling logic.
 */

import type { Embeddings } from '@langchain/core/embeddings';
import type { EmbeddingProvider } from '../../types/index.js';
import { logger } from '../../config/index.js';

export abstract class BaseEmbeddingProvider implements EmbeddingProvider {
  protected abstract readonly embeddings: Embeddings;
  protected abstract readonly providerName: string;
  protected abstract readonly modelName: string;

  async embedDocuments(texts: string[]): Promise<number[][]> {
    try {
      logger.debug(`🧮 Embedding ${texts.length} documents with ${this.providerName}...`);
      const startTime = Date.now();

      const result = await this.embeddings.embedDocuments(texts);

      const duration = Date.now() - startTime;
      logger.debug(`✅ Documents embedded in ${duration}ms`);

      return result;
    } catch (error) {
      logger.error(`❌ Error embedding documents with ${this.providerName}:`, error);
      throw new Error(`Failed to embed documents: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async embedQuery(text: string): Promise<number[]> {
    try {
      logger.debug(`🧮 Embedding query with ${this.providerName}...`);
      const startTime = Date.now();

      const result = await this.embeddings.embedQuery(text);

      const duration = Date.now() - startTime;
      logger.debug(`✅ Query embedded in ${duration}ms`);

      return result;
    } catch (error) {
      logger.error(`❌ Error embedding query with ${this.providerName}:`, error);
      throw new Error(`Failed to embed query: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  getProviderName(): string {
    return this.providerName;
  }

  getModelName(): string {
    return this.modelName;
  }

  protected maskApiKey(apiKey: string): string {
    if (apiKey.length <= 8) {
      return '***';
    }
    return `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`;
  }
}
