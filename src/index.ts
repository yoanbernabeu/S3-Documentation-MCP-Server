#!/usr/bin/env node

/**
 * Entry point for S3 Documentation MCP Server
 */

import { S3DocMCPServer } from './server.js';
import { logger } from './config/index.js';

async function main() {
  try {
    logger.info('══════════════════════════════════════════════════');
    logger.info('   S3 Documentation MCP Server');
    logger.info('══════════════════════════════════════════════════\n');

    // Create and initialize server
    const server = new S3DocMCPServer();
    await server.initialize();

    // Start server
    await server.start();

    // Handle signals for graceful shutdown
    process.on('SIGINT', () => {
      logger.info('\n🛑 Stopping server...');
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      logger.info('\n🛑 Stopping server...');
      process.exit(0);
    });
  } catch (error) {
    logger.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

main();

