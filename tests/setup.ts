/**
 * Setup file for Vitest tests
 */

import { afterEach, vi } from 'vitest';

// Set environment variables BEFORE any imports
// This must be at module level, not in beforeAll
process.env.S3_REGION = 'us-east-1';
process.env.S3_ACCESS_KEY_ID = 'test-access-key';
process.env.S3_SECRET_ACCESS_KEY = 'test-secret-key';
process.env.S3_BUCKET_NAME = 'test-bucket';
process.env.S3_PREFIX = 'docs/';
process.env.S3_ENDPOINT = 'https://s3.fr-par.scw.cloud';
process.env.S3_FORCE_PATH_STYLE = 'true';
process.env.EMBEDDING_PROVIDER = 'ollama';
process.env.OLLAMA_BASE_URL = 'http://localhost:11434';
process.env.OLLAMA_EMBEDDING_MODEL = 'nomic-embed-text';
process.env.OPENAI_API_KEY = 'sk-test-key-for-tests';
process.env.OPENAI_EMBEDDING_MODEL = 'text-embedding-3-small';
process.env.CHUNK_SIZE = '1000';
process.env.CHUNK_OVERLAP = '200';
process.env.MAX_RESULTS = '4';
process.env.MIN_SIMILARITY_SCORE = '0.5';
process.env.SYNC_MODE = 'manual';
process.env.VECTOR_STORE_PATH = './data/test-hnswlib-store';
process.env.PORT = '3000';
process.env.HOST = '0.0.0.0';
process.env.LOG_LEVEL = 'error'; // Reduce logs during tests

// Clear all mocks after each test
afterEach(() => {
  vi.clearAllMocks();
});

