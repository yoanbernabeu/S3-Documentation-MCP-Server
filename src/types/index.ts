/**
 * Types for S3 Documentation MCP Server
 */

// Configuration
export interface Config {
  // S3 (AWS or compatible)
  s3: {
    endpoint?: string; // Custom endpoint (MinIO, Scaleway, etc.)
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucketName: string;
    prefix: string;
    forcePathStyle?: boolean; // Required for MinIO and some S3-compatible services
  };
  
  // Ollama
  ollama: {
    baseUrl: string;
    embeddingModel: string;
  };
  
  // RAG
  rag: {
    chunkSize: number;
    chunkOverlap: number;
    maxResults: number;
    minSimilarityScore: number; // Minimum similarity threshold (0-1)
  };
  
  // Synchronization
  sync: {
    mode: 'startup' | 'periodic' | 'manual';
    intervalMinutes: number;
    enableEmbeddingsCache: boolean;
  };
  
  // Vector Store
  vectorStore: {
    path: string;
  };
  
  // Server
  server: {
    port: number;
    host: string;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
  };
  
  // Authentication
  auth: {
    enabled: boolean;
    apiKey: string;
  };
}

// S3 Document
export interface S3Document {
  key: string;
  etag: string;
  lastModified: Date;
  size: number;
  content?: string;
}

// Document metadata
export interface DocumentMetadata {
  key: string;
  etag: string;
  source: string;
  chunkIndex: number;
  totalChunks: number;
  indexedAt: string;
}

// Vectorized document
export interface VectorDocument {
  id: string;
  content: string;
  metadata: DocumentMetadata;
}

// Search result
export interface SearchResult {
  document: {
    id: string;
    s3_key: string;
    s3_etag: string;
    content: string;
    chunk_index: number;
    total_chunks: number;
    indexed_at: string;
    source: string;
  };
  score: number;
}

// Synchronization state
export interface SyncState {
  lastSyncDate: string;
  documents: Record<string, {
    key: string;
    etag: string;
    lastModified: string;
    chunkCount: number;
    status: 'indexed' | 'deleted' | 'error';
  }>;
  version: string;
}

// Detected changes
export interface DetectedChanges {
  new: S3Document[];
  modified: S3Document[];
  deleted: string[];
  unchanged: S3Document[];
}

// Synchronization metrics
export interface SyncMetrics {
  lastSyncDate: Date;
  duration: number;
  documentsScanned: number;
  documentsAdded: number;
  documentsModified: number;
  documentsDeleted: number;
  documentsUnchanged: number;
  errors: Array<{ key: string; error: string }>;
}

// Document for indexing
export interface DocumentToIndex {
  content: string;
  metadata: {
    key: string;
    etag: string;
    chunkIndex: number;
    totalChunks: number;
    source: string;
  };
}

