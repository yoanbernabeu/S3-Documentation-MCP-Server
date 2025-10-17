/**
 * API Key Authentication Middleware
 */

import type { Request, Response, NextFunction } from 'express';

import { config, logger } from '../config/index.js';

/**
 * Extracts API key from request
 * Priority: Authorization header > query parameter
 * Returns { key: string | null, malformed: boolean }
 */
function extractApiKey(req: Request): { key: string | null; malformed: boolean } {
  // Check Authorization header (Bearer token)
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const trimmedHeader = authHeader.trim();
    if (trimmedHeader) {
      const bearerMatch = trimmedHeader.match(/^bearer\s+(.+)$/i);
      if (bearerMatch) {
        const key = bearerMatch[1].trim();
        return { key: key || null, malformed: !key };
      }
      // Header present but malformed (not Bearer format)
      return { key: null, malformed: true };
    }
  }

  // Check query parameter
  const queryApiKey = req.query.api_key;
  if (queryApiKey && typeof queryApiKey === 'string') {
    const key = queryApiKey.trim();
    return { key: key || null, malformed: false };
  }

  return { key: null, malformed: false };
}

/**
 * API Key Authentication Middleware
 * Validates requests based on configuration
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  // If authentication is disabled, allow all requests
  if (!config.auth.enabled) {
    next();
    return;
  }

  // Always allow access to health endpoint
  if (req.path === '/health') {
    next();
    return;
  }

  // Extract API key from request
  const { key: providedApiKey, malformed } = extractApiKey(req);

  // Check if API key is malformed or missing
  if (!providedApiKey) {
    if (malformed) {
      logger.warn(`Authentication failed: Malformed API key for ${req.path}`);
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid API key',
      });
    } else {
      logger.warn(`Authentication failed: No API key provided for ${req.path}`);
      res.status(401).json({
        error: 'Unauthorized',
        message: 'API key required',
      });
    }
    return;
  }

  // Validate API key
  if (providedApiKey !== config.auth.apiKey) {
    logger.warn(`Authentication failed: Invalid API key for ${req.path}`);
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid API key',
    });
    return;
  }

  // API key is valid, proceed
  next();
}

