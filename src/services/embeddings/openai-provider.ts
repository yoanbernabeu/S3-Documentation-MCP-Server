/**
 * OpenAI Embedding Provider
 */

import { OpenAIEmbeddings } from '@langchain/openai';
import { logger } from '../../config/index.js';
import { BaseEmbeddingProvider } from './base-provider.js';

export class OpenAIEmbeddingProvider extends BaseEmbeddingProvider {
  protected readonly embeddings: OpenAIEmbeddings;
  protected readonly providerName = 'OpenAI';
  protected readonly modelName: string;

  constructor(apiKey: string, model: string) {
    super();
    this.modelName = model;

    this.embeddings = new OpenAIEmbeddings({
      openAIApiKey: apiKey,
      modelName: this.modelName,
    });

    logger.info(`🤖 OpenAI Embedding Provider initialized`);
    logger.info(`   Model: ${this.modelName}`);
    logger.info(`   API Key: ${this.maskApiKey(apiKey)}`);
  }
}
