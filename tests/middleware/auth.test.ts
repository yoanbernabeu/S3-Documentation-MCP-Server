/**
 * Tests for API key authentication middleware
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// Mock config before importing the middleware
const mockConfig = {
  auth: {
    enabled: false,
    apiKey: '',
  },
};

vi.mock('../../src/config/index.js', () => ({
  config: mockConfig,
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe('API Key Authentication Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;
  let authMiddleware: (req: Request, res: Response, next: NextFunction) => void;

  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Reset config
    mockConfig.auth.enabled = false;
    mockConfig.auth.apiKey = '';

    // Create mock request, response, and next
    mockReq = {
      headers: {},
      query: {},
      get path() { return '/mcp'; },
    };

    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };

    mockNext = vi.fn();

    // Import middleware after mocking
    const module = await import('../../src/middleware/auth.js');
    authMiddleware = module.authMiddleware;
  });

  describe('when authentication is disabled', () => {
    it('should allow requests without API key', () => {
      mockConfig.auth.enabled = false;
      
      authMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should ignore API key even if provided', () => {
      mockConfig.auth.enabled = false;
      mockReq.headers = { authorization: 'Bearer some-key' };
      
      authMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });
  });

  describe('when authentication is enabled', () => {
    beforeEach(() => {
      mockConfig.auth.enabled = true;
      mockConfig.auth.apiKey = 'test-secret-key';
    });

    describe('with Authorization header', () => {
      it('should allow requests with valid Bearer token', () => {
        mockReq.headers = { authorization: 'Bearer test-secret-key' };
        
        authMiddleware(mockReq as Request, mockRes as Response, mockNext);

        expect(mockNext).toHaveBeenCalled();
        expect(mockRes.status).not.toHaveBeenCalled();
      });

      it('should reject requests with invalid Bearer token', () => {
        mockReq.headers = { authorization: 'Bearer wrong-key' };
        
        authMiddleware(mockReq as Request, mockRes as Response, mockNext);

        expect(mockNext).not.toHaveBeenCalled();
        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockRes.json).toHaveBeenCalledWith({
          error: 'Unauthorized',
          message: 'Invalid API key',
        });
      });

      it('should reject requests with malformed Authorization header', () => {
        mockReq.headers = { authorization: 'InvalidFormat test-secret-key' };
        
        authMiddleware(mockReq as Request, mockRes as Response, mockNext);

        expect(mockNext).not.toHaveBeenCalled();
        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockRes.json).toHaveBeenCalledWith({
          error: 'Unauthorized',
          message: 'Invalid API key',
        });
      });

      it('should be case-insensitive for Bearer keyword', () => {
        mockReq.headers = { authorization: 'bearer test-secret-key' };
        
        authMiddleware(mockReq as Request, mockRes as Response, mockNext);

        expect(mockNext).toHaveBeenCalled();
        expect(mockRes.status).not.toHaveBeenCalled();
      });
    });

    describe('with query parameter', () => {
      it('should allow requests with valid api_key query parameter', () => {
        mockReq.query = { api_key: 'test-secret-key' };
        
        authMiddleware(mockReq as Request, mockRes as Response, mockNext);

        expect(mockNext).toHaveBeenCalled();
        expect(mockRes.status).not.toHaveBeenCalled();
      });

      it('should reject requests with invalid api_key query parameter', () => {
        mockReq.query = { api_key: 'wrong-key' };
        
        authMiddleware(mockReq as Request, mockRes as Response, mockNext);

        expect(mockNext).not.toHaveBeenCalled();
        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockRes.json).toHaveBeenCalledWith({
          error: 'Unauthorized',
          message: 'Invalid API key',
        });
      });
    });

    describe('priority', () => {
      it('should prioritize Authorization header over query parameter', () => {
        mockReq.headers = { authorization: 'Bearer test-secret-key' };
        mockReq.query = { api_key: 'wrong-key' };
        
        authMiddleware(mockReq as Request, mockRes as Response, mockNext);

        expect(mockNext).toHaveBeenCalled();
        expect(mockRes.status).not.toHaveBeenCalled();
      });

      it('should fall back to query parameter if header is invalid', () => {
        mockReq.headers = { authorization: 'Bearer wrong-key' };
        mockReq.query = { api_key: 'test-secret-key' };
        
        authMiddleware(mockReq as Request, mockRes as Response, mockNext);

        expect(mockNext).not.toHaveBeenCalled();
        expect(mockRes.status).toHaveBeenCalledWith(401);
      });
    });

    describe('missing API key', () => {
      it('should reject requests without any API key', () => {
        authMiddleware(mockReq as Request, mockRes as Response, mockNext);

        expect(mockNext).not.toHaveBeenCalled();
        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockRes.json).toHaveBeenCalledWith({
          error: 'Unauthorized',
          message: 'API key required',
        });
      });

      it('should reject requests with empty Authorization header', () => {
        mockReq.headers = { authorization: '' };
        
        authMiddleware(mockReq as Request, mockRes as Response, mockNext);

        expect(mockNext).not.toHaveBeenCalled();
        expect(mockRes.status).toHaveBeenCalledWith(401);
      });

      it('should reject requests with empty query parameter', () => {
        mockReq.query = { api_key: '' };
        
        authMiddleware(mockReq as Request, mockRes as Response, mockNext);

        expect(mockNext).not.toHaveBeenCalled();
        expect(mockRes.status).toHaveBeenCalledWith(401);
      });
    });

    describe('health endpoint exemption', () => {
      it('should always allow access to /health endpoint', () => {
        mockConfig.auth.enabled = true;
        // Override path getter for this test
        const healthReq = {
          ...mockReq,
          get path() { return '/health'; },
        };
        // No API key provided
        
        authMiddleware(healthReq as Request, mockRes as Response, mockNext);

        expect(mockNext).toHaveBeenCalled();
        expect(mockRes.status).not.toHaveBeenCalled();
      });
    });
  });

  describe('edge cases', () => {
    beforeEach(() => {
      mockConfig.auth.enabled = true;
      mockConfig.auth.apiKey = 'test-secret-key';
    });

    it('should handle whitespace in Bearer token', () => {
      mockReq.headers = { authorization: '  Bearer   test-secret-key  ' };
      
      authMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should handle Bearer token with only spaces', () => {
      mockReq.headers = { authorization: 'Bearer    ' };
      
      authMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it('should handle special characters in API key', () => {
      mockConfig.auth.apiKey = 'test-key-with-special-chars!@#$%^&*()';
      mockReq.headers = { authorization: 'Bearer test-key-with-special-chars!@#$%^&*()' };
      
      authMiddleware(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });
  });
});

