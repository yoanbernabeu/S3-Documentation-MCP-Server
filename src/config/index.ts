/**
 * Centralized server configuration
 */

import 'dotenv/config';
import type { Config } from '../types/index.js';

// Helper function to get a required environment variable
function getEnvVar(name: string, defaultValue?: string): string {
  const value = process.env[name] ?? defaultValue;
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

// Helper function to get a number
function getEnvNumber(name: string, defaultValue: number): number {
  const value = process.env[name];
  return value ? parseInt(value, 10) : defaultValue;
}

// Global configuration
export const config: Config = {
  s3: {
    endpoint: process.env.S3_ENDPOINT, // Optional: for S3-compatible services (MinIO, Scaleway, etc.)
    region: getEnvVar('S3_REGION', 'us-east-1'),
    accessKeyId: getEnvVar('S3_ACCESS_KEY_ID'),
    secretAccessKey: getEnvVar('S3_SECRET_ACCESS_KEY'),
    bucketName: getEnvVar('S3_BUCKET_NAME'),
    prefix: getEnvVar('S3_PREFIX', ''),
    forcePathStyle: getEnvVar('S3_FORCE_PATH_STYLE', 'false') === 'true',
  },
  
  ollama: {
    baseUrl: getEnvVar('OLLAMA_BASE_URL', 'http://localhost:11434'),
    embeddingModel: getEnvVar('OLLAMA_EMBEDDING_MODEL', 'nomic-embed-text'),
  },
  
  rag: {
    chunkSize: getEnvNumber('CHUNK_SIZE', 1000),
    chunkOverlap: getEnvNumber('CHUNK_OVERLAP', 200),
    maxResults: getEnvNumber('MAX_RESULTS', 4),
    minSimilarityScore: parseFloat(getEnvVar('MIN_SIMILARITY_SCORE', '0.5')), // 0-1, 0.5 = 50%
  },
  
  sync: {
    mode: (getEnvVar('SYNC_MODE', 'startup') as 'startup' | 'periodic' | 'manual'),
    intervalMinutes: getEnvNumber('SYNC_INTERVAL_MINUTES', 5),
    enableEmbeddingsCache: getEnvVar('ENABLE_EMBEDDINGS_CACHE', 'true') === 'true',
  },
  
  vectorStore: {
    path: getEnvVar('VECTOR_STORE_PATH', './data/hnswlib-store'),
  },
  
  server: {
    port: getEnvNumber('PORT', 3000),
    host: getEnvVar('HOST', '0.0.0.0'),
    logLevel: (getEnvVar('LOG_LEVEL', 'info') as 'debug' | 'info' | 'warn' | 'error'),
  },
  
  auth: {
    enabled: getEnvVar('ENABLE_AUTH', 'false') === 'true',
    apiKey: process.env.MCP_API_KEY ?? '',
  },
};

// Simple logger
export class Logger {
  private logLevel: string;
  
  constructor(logLevel: string = config.server.logLevel) {
    this.logLevel = logLevel;
  }
  
  private shouldLog(level: string): boolean {
    const levels = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex >= currentLevelIndex;
  }
  
  debug(message: string, ...args: unknown[]): void {
    if (this.shouldLog('debug')) {
      console.log(`🔍 [DEBUG] ${message}`, ...args);
    }
  }
  
  info(message: string, ...args: unknown[]): void {
    if (this.shouldLog('info')) {
      console.log(`ℹ️  [INFO] ${message}`, ...args);
    }
  }
  
  warn(message: string, ...args: unknown[]): void {
    if (this.shouldLog('warn')) {
      console.warn(`⚠️  [WARN] ${message}`, ...args);
    }
  }
  
  error(message: string, ...args: unknown[]): void {
    if (this.shouldLog('error')) {
      console.error(`❌ [ERROR] ${message}`, ...args);
    }
  }
  
  success(message: string, ...args: unknown[]): void {
    if (this.shouldLog('info')) {
      console.log(`✅ [SUCCESS] ${message}`, ...args);
    }
  }
}

// Instance globale du logger
export const logger = new Logger();

