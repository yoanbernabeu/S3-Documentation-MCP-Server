/**
 * MCP server for S3 documentation
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import express from 'express';
import { z } from 'zod';

import { config, logger } from './config/index.js';
import { authMiddleware } from './middleware/auth.js';
import { HNSWVectorStore } from './services/hnswlib-vector-store.js';
import { ResourceService } from './services/resource-service.js';
import { S3Loader } from './services/s3-loader.js';
import { SyncService } from './services/sync-service.js';
import { getFullDocument } from './tools/get-full-document.js';
import { refreshIndex } from './tools/refresh-index.js';
import { searchDocumentation } from './tools/search-documentation.js';

export class S3DocMCPServer {
  private server: McpServer;
  private s3Loader: S3Loader;
  private vectorStore: HNSWVectorStore;
  private syncService: SyncService;
  private resourceService: ResourceService;

  constructor() {
    // Create the MCP server with modern API
    this.server = new McpServer(
      {
        name: 's3-doc-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          resources: {
            listChanged: true,
          },
        },
      }
    );

    // Initialize services
    this.s3Loader = new S3Loader();
    this.vectorStore = new HNSWVectorStore();
    this.syncService = new SyncService(this.s3Loader, this.vectorStore);
    this.resourceService = new ResourceService(this.s3Loader, this.syncService);

    // Register tools
    this.registerTools();
    
    // Register resources
    this.registerResources();

    logger.info('S3 Documentation MCP Server initialized');
  }

  /**
   * Register MCP tools
   */
  private registerTools(): void {
    // Register search_documentation tool
    this.server.registerTool(
      'search_documentation',
      {
        title: 'Search Documentation',
        description: 'Semantic search in documentation stored on S3. Uses local embeddings and a vector store to find the most relevant passages.',
        inputSchema: {
          query: z.string().describe('Question or search query to perform in the documentation'),
          max_results: z.number().optional().describe('Maximum number of results (default: 4)'),
        },
        outputSchema: {
          results: z.array(z.object({
            content: z.string(),
            source: z.string(),
            score: z.number(),
            chunk_info: z.string(),
          })),
          context: z.string(),
          total_results: z.number(),
        },
      },
      async ({ query, max_results }) => {
        try {
          const result = await searchDocumentation(
            { query, max_results },
            this.vectorStore
          );

          // Follow MCP best practices: text content should be JSON stringified version
          // of structured content for clients that don't support structuredContent
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(result, null, 2),
              },
            ],
            structuredContent: result,
          };
        } catch (error) {
          logger.error(`Error in search_documentation:`, error);
          throw error;
        }
      }
    );

    // Register refresh_index tool
    this.server.registerTool(
      'refresh_index',
      {
        title: 'Refresh Index',
        description: 'Refreshes the documentation index by synchronizing with S3. Automatically detects new files, modifications, and deletions. By default, performs INCREMENTAL sync (fast, only processes changes). Use force parameter ONLY when user explicitly requests a complete rebuild.',
        inputSchema: {
          force: z.boolean().optional().describe('Force complete reindexing of ALL files (default: false). ⚠️ IMPORTANT: Only set to true when user EXPLICITLY requests it (e.g., "force reindex", "rebuild from scratch", "reindex everything"). Full reindex is slow and expensive (re-downloads all files, regenerates all embeddings). Normal incremental sync is almost always sufficient.'),
        },
        outputSchema: {
          success: z.boolean(),
          message: z.string(),
          metrics: z.object({
            duration_seconds: z.number(),
            documents_scanned: z.number(),
            documents_added: z.number(),
            documents_modified: z.number(),
            documents_deleted: z.number(),
            documents_unchanged: z.number(),
            errors_count: z.number(),
          }),
        },
      },
      async ({ force }) => {
        try {
          // Log warning if force is used
          if (force) {
            logger.warn('⚠️  FORCE REINDEX requested - this will reindex ALL files');
            logger.warn('   This operation is expensive (time, API calls, embeddings)');
          } else {
            logger.info('ℹ️  Incremental sync requested (default behavior)');
          }

          const result = await refreshIndex(
            { force },
            this.syncService
          );

          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(result, null, 2),
              },
            ],
            structuredContent: result,
            isError: !result.success,
          };
        } catch (error) {
          logger.error(`Error in refresh_index:`, error);
          throw error;
        }
      }
    );

    // Register get_full_document tool
    this.server.registerTool(
      'get_full_document',
      {
        title: 'Get Full Document',
        description: 'Retrieves the complete content of a Markdown file from S3, along with its metadata (size, last modification date, ETag, chunk count).',
        inputSchema: {
          s3_key: z.string().describe('S3 document key (e.g., "docs/authentification_magique_symfony.md")'),
        },
        outputSchema: {
          s3_key: z.string(),
          content: z.string(),
          metadata: z.object({
            size_bytes: z.number(),
            last_modified: z.string(),
            etag: z.string(),
            chunk_count: z.number().optional(),
          }),
        },
      },
      async ({ s3_key }) => {
        try {
          const result = await getFullDocument(
            { s3_key },
            this.s3Loader,
            this.syncService
          );

          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(result, null, 2),
              },
            ],
            structuredContent: result,
          };
        } catch (error) {
          logger.error(`Error in get_full_document:`, error);
          throw error;
        }
      }
    );

    logger.info('MCP tools registered');
  }

  /**
   * Register MCP resources handlers
   */
  private registerResources(): void {
    // Use the underlying Server instance for lower-level request handlers
    const underlyingServer = this.server.server;

    // Handler for resources/list - returns list of indexed files
    underlyingServer.setRequestHandler(
      ListResourcesRequestSchema,
      async () => {
        const resources = await this.resourceService.listResources();
        return { resources };
      }
    );

    // Handler for resources/read - reads file content
    underlyingServer.setRequestHandler(
      ReadResourceRequestSchema,
      async (request) => {
        const content = await this.resourceService.readResource(request.params.uri);
        return { contents: [content] };
      }
    );

    logger.info('MCP resources handlers registered');
  }

  /**
   * Initialize the server (load vector store and perform initial sync)
   */
  async initialize(): Promise<void> {
    try {
      logger.info('🚀 Initializing server...');

      // Initialize vector store
      await this.vectorStore.initialize();

      // Perform synchronization according to configuration
      if (config.sync.mode === 'startup') {
        logger.info('🔄 Startup synchronization enabled...');
        
        // Check if vector store is empty
        const initialStats = await this.vectorStore.getStats();
        if (initialStats.totalChunks === 0) {
          logger.warn('⚠️  Vector store is empty - forcing full synchronization');
          await this.syncService.performSync('full');
        } else {
          logger.info(`📊 Vector store contains ${initialStats.totalChunks} chunks - incremental sync`);
          await this.syncService.performSync('incremental');
        }
        
        // Notify clients that resource list has changed
        this.notifyResourceListChanged();
      }

      // If periodic mode, configure interval
      if (config.sync.mode === 'periodic') {
        const intervalMs = config.sync.intervalMinutes * 60 * 1000;
        logger.info(`⏰ Periodic synchronization enabled (every ${config.sync.intervalMinutes} minutes)`);
        
        setInterval(() => {
          void (async () => {
            logger.info('🔄 Periodic synchronization...');
            await this.syncService.performSync('incremental');
            
            // Notify clients that resource list has changed
            this.notifyResourceListChanged();
          })();
        }, intervalMs);
      }

      // Display statistics
      const stats = await this.vectorStore.getStats();
      logger.success(`✅ Server ready - ${stats.uniqueFiles} files, ${stats.totalChunks} chunks indexed`);
    } catch (error) {
      logger.error('❌ Error during initialization:', error);
      throw error;
    }
  }

  /**
   * Notify clients that the resource list has changed
   */
  private notifyResourceListChanged(): void {
    try {
      this.server.sendResourceListChanged();
      logger.debug('📢 Resource list changed notification sent');
    } catch (error) {
      logger.error('Error sending resource list changed notification:', error);
    }
  }

  /**
   * Start the server with HTTP transport
   */
  async start(): Promise<void> {
    const app = express();
    app.use(express.json());

    // Apply authentication middleware (if enabled)
    app.use(authMiddleware);

    // Health endpoint
    app.get('/health', (req, res) => {
      res.json({ 
        status: 'healthy',
        version: '1.0.0',
        service: 's3-doc-mcp'
      });
    });

    // Main MCP endpoint
    app.post('/mcp', async (req, res) => {
      try {
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: undefined, // Stateless mode
          enableJsonResponse: true,
        });

        res.on('close', () => {
          void transport.close();
        });

        await this.server.connect(transport);
        await transport.handleRequest(req, res, req.body);
      } catch (error) {
        logger.error('Error processing MCP request:', error);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Internal server error' });
        }
      }
    });

    // Start HTTP server
    const port = config.server.port;
    const host = config.server.host;

    return new Promise((resolve) => {
      app.listen(port, host, () => {
        logger.success(`🎧 MCP server listening on http://${host}:${port}`);
        logger.info(`   MCP endpoint: http://${host}:${port}/mcp`);
        logger.info(`   Health check: http://${host}:${port}/health`);
        
        // Display authentication status
        if (config.auth.enabled) {
          logger.info(`   🔐 Authentication: ENABLED`);
        } else {
          logger.info(`   🔓 Authentication: DISABLED (open access)`);
        }
        
        resolve();
      });
    });
  }
}

