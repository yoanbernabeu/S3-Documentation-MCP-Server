/**
 * Google Generative AI Embedding Provider
 */

import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { logger } from '../../config/index.js';
import { BaseEmbeddingProvider } from './base-provider.js';

export class GoogleEmbeddingProvider extends BaseEmbeddingProvider {
  protected readonly embeddings: GoogleGenerativeAIEmbeddings;
  protected readonly providerName = 'Google';
  protected readonly modelName: string;

  constructor(apiKey: string, model: string) {
    super();
    this.modelName = model;

    this.embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey,
      model: this.modelName,
    });

    logger.info(`🤖 Google Embedding Provider initialized`);
    logger.info(`   Model: ${this.modelName}`);
    logger.info(`   API Key: ${this.maskApiKey(apiKey)}`);
  }
}
