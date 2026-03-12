/**
 * Ollama Embedding Provider
 */

import { OllamaEmbeddings } from '@langchain/ollama';
import { logger } from '../../config/index.js';
import { BaseEmbeddingProvider } from './base-provider.js';

export class OllamaEmbeddingProvider extends BaseEmbeddingProvider {
  protected readonly embeddings: OllamaEmbeddings;
  protected readonly providerName = 'Ollama';
  protected readonly modelName: string;

  constructor(baseUrl: string, model: string) {
    super();
    this.modelName = model;

    this.embeddings = new OllamaEmbeddings({
      model: this.modelName,
      baseUrl,
    });

    logger.info(`🤖 Ollama Embedding Provider initialized`);
    logger.info(`   Model: ${this.modelName}`);
    logger.info(`   Base URL: ${baseUrl}`);
  }
}
