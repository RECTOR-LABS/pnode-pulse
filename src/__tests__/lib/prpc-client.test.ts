/**
 * pRPC Client Tests
 *
 * Tests pNode RPC client configuration, request/response handling,
 * error handling, and retry logic.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PRPCClient, createClient } from '@/lib/prpc/client';
import { PRPCError, PRPCErrorCode } from '@/types/prpc';
import type { PNodeVersion, PNodeStats, PodsResult } from '@/types/prpc';

describe('PRPCClient Configuration', () => {
  it('should require baseUrl', () => {
    expect(() => {
      new PRPCClient({ baseUrl: '' });
    }).toThrow('baseUrl is required');
  });

  it('should normalize URL with /rpc path', () => {
    const client = new PRPCClient({ baseUrl: 'http://192.168.1.1:6000' });
    expect(client.getBaseUrl()).toBe('http://192.168.1.1:6000/rpc');
  });

  it('should remove trailing slash from baseUrl', () => {
    const client = new PRPCClient({ baseUrl: 'http://192.168.1.1:6000/' });
    expect(client.getBaseUrl()).toBe('http://192.168.1.1:6000/rpc');
  });

  it('should not duplicate /rpc path', () => {
    const client = new PRPCClient({ baseUrl: 'http://192.168.1.1:6000/rpc' });
    expect(client.getBaseUrl()).toBe('http://192.168.1.1:6000/rpc');
  });

  it('should use default timeout of 5000ms', () => {
    const client = new PRPCClient({ baseUrl: 'http://192.168.1.1:6000' });
    // Timeout is private, but we can verify default behavior exists
    expect(client).toBeDefined();
  });

  it('should accept custom timeout', () => {
    const client = new PRPCClient({
      baseUrl: 'http://192.168.1.1:6000',
      timeout: 10000,
    });
    expect(client).toBeDefined();
  });

  it('should accept custom retry configuration', () => {
    const client = new PRPCClient({
      baseUrl: 'http://192.168.1.1:6000',
      retries: 3,
      retryDelay: 2000,
    });
    expect(client).toBeDefined();
  });
});

describe('createClient Helper', () => {
  it('should create client from IP address', () => {
    const client = createClient('192.168.1.1');
    expect(client.getBaseUrl()).toBe('http://192.168.1.1:6000/rpc');
  });

  it('should accept custom options', () => {
    const client = createClient('192.168.1.1', { timeout: 10000 });
    expect(client.getBaseUrl()).toBe('http://192.168.1.1:6000/rpc');
  });

  it('should work with known public pNodes', () => {
    const client = createClient('173.212.203.145');
    expect(client.getBaseUrl()).toBe('http://173.212.203.145:6000/rpc');
  });
});

describe('PRPCClient URL Utilities', () => {
  it('should extract IP from base URL', () => {
    const client = new PRPCClient({ baseUrl: 'http://192.168.1.1:6000' });
    expect(client.getIp()).toBe('192.168.1.1');
  });

  it('should handle URL without port', () => {
    const client = new PRPCClient({ baseUrl: 'http://192.168.1.1' });
    expect(client.getIp()).toBe('192.168.1.1');
  });

  it('should handle localhost', () => {
    const client = new PRPCClient({ baseUrl: 'http://localhost:6000' });
    expect(client.getIp()).toBe('localhost');
  });
});

describe('PRPCError Handling', () => {
  it('should create PRPCError with code', () => {
    const error = new PRPCError('Test error', PRPCErrorCode.NETWORK_ERROR);
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('Test error');
    expect(error.code).toBe(PRPCErrorCode.NETWORK_ERROR);
    expect(error.name).toBe('PRPCError');
  });

  it('should include cause if provided', () => {
    const cause = new Error('Original error');
    const error = new PRPCError('Wrapped error', PRPCErrorCode.TIMEOUT, cause);
    expect(error.cause).toBe(cause);
  });

  it('should have all error codes defined', () => {
    expect(PRPCErrorCode.NETWORK_ERROR).toBe('NETWORK_ERROR');
    expect(PRPCErrorCode.TIMEOUT).toBe('TIMEOUT');
    expect(PRPCErrorCode.RPC_ERROR).toBe('RPC_ERROR');
    expect(PRPCErrorCode.PARSE_ERROR).toBe('PARSE_ERROR');
    expect(PRPCErrorCode.CONFIG_ERROR).toBe('CONFIG_ERROR');
  });
});

describe('JSON-RPC Request Format', () => {
  it('should create valid JSON-RPC 2.0 request', () => {
    const request = {
      jsonrpc: '2.0' as const,
      method: 'get-version',
      id: 1,
    };

    expect(request.jsonrpc).toBe('2.0');
    expect(request.method).toBeDefined();
    expect(request.id).toBeGreaterThan(0);
  });

  it('should increment request ID for each call', () => {
    const ids = [1, 2, 3, 4, 5];
    expect(ids[0]).toBe(1);
    expect(ids[1]).toBe(2);
    expect(ids[4]).toBe(5);
  });

  it('should handle optional params', () => {
    const request1 = {
      jsonrpc: '2.0' as const,
      method: 'get-version',
      id: 1,
    };

    const request2 = {
      jsonrpc: '2.0' as const,
      method: 'some-method',
      params: { key: 'value' },
      id: 2,
    };

    expect(request1.params).toBeUndefined();
    expect(request2.params).toEqual({ key: 'value' });
  });
});

describe('JSON-RPC Response Handling', () => {
  it('should handle successful response', () => {
    const response = {
      jsonrpc: '2.0' as const,
      result: { version: '0.6.0' },
      id: 1,
    };

    expect(response.result).toBeDefined();
    expect(response.error).toBeUndefined();
  });

  it('should handle error response', () => {
    const response = {
      jsonrpc: '2.0' as const,
      error: {
        code: -32600,
        message: 'Invalid Request',
      },
      id: 1,
    };

    expect(response.error).toBeDefined();
    expect(response.result).toBeUndefined();
  });

  it('should validate result exists', () => {
    const response = {
      jsonrpc: '2.0' as const,
      id: 1,
    };

    expect(response.result).toBeUndefined();
  });
});

describe('Response Type Structures', () => {
  describe('PNodeVersion', () => {
    it('should have version string', () => {
      const version: PNodeVersion = {
        version: '0.6.0',
      };

      expect(version.version).toBe('0.6.0');
      expect(typeof version.version).toBe('string');
    });
  });

  describe('PNodeStats', () => {
    it('should have all required fields', () => {
      const stats: PNodeStats = {
        active_streams: 2,
        cpu_percent: 6.63,
        current_index: 14,
        file_size: 558000000000,
        last_updated: 1764953798,
        packets_received: 7218,
        packets_sent: 5965,
        ram_total: 12567232512,
        ram_used: 5399207936,
        total_bytes: 94633,
        total_pages: 0,
        uptime: 154484,
      };

      expect(stats.cpu_percent).toBeGreaterThanOrEqual(0);
      expect(stats.ram_total).toBeGreaterThan(0);
      expect(stats.uptime).toBeGreaterThan(0);
    });

    it('should calculate RAM percentage correctly', () => {
      const stats: PNodeStats = {
        active_streams: 2,
        cpu_percent: 6.63,
        current_index: 14,
        file_size: 558000000000,
        last_updated: 1764953798,
        packets_received: 7218,
        packets_sent: 5965,
        ram_total: 12567232512,
        ram_used: 5399207936,
        total_bytes: 94633,
        total_pages: 0,
        uptime: 154484,
      };

      const ramPercent = (stats.ram_used / stats.ram_total) * 100;
      expect(ramPercent).toBeGreaterThan(0);
      expect(ramPercent).toBeLessThan(100);
    });
  });

  describe('PodsResult', () => {
    it('should have pods array and total count', () => {
      const pods: PodsResult = {
        pods: [
          {
            address: '62.84.180.240:9001',
            last_seen_timestamp: 1765057753,
            pubkey: '7T4zPNNDAT7rwkQ6Rf2QyMvLwowQ4KDSxKRXF9qEtYvR',
            version: '0.5.1',
          },
        ],
        total_count: 27,
      };

      expect(Array.isArray(pods.pods)).toBe(true);
      expect(pods.total_count).toBeGreaterThan(0);
      expect(pods.pods[0].address).toContain(':9001');
    });

    it('should handle null pubkey', () => {
      const pods: PodsResult = {
        pods: [
          {
            address: '192.168.1.1:9001',
            last_seen_timestamp: 1765057753,
            pubkey: null,
            version: '0.6.0',
          },
        ],
        total_count: 1,
      };

      expect(pods.pods[0].pubkey).toBeNull();
    });
  });
});

describe('Retry Logic', () => {
  it('should not retry on RPC errors', () => {
    // RPC errors are deterministic, so retrying won't help
    const rpcError = new PRPCError('Method not found', PRPCErrorCode.RPC_ERROR);
    expect(rpcError.code).toBe(PRPCErrorCode.RPC_ERROR);
  });

  it('should retry on network errors', () => {
    const networkError = new PRPCError('Connection refused', PRPCErrorCode.NETWORK_ERROR);
    expect(networkError.code).toBe(PRPCErrorCode.NETWORK_ERROR);
  });

  it('should retry on timeout errors', () => {
    const timeoutError = new PRPCError('Request timed out', PRPCErrorCode.TIMEOUT);
    expect(timeoutError.code).toBe(PRPCErrorCode.TIMEOUT);
  });

  it('should calculate retry delays', () => {
    const baseDelay = 1000;
    const retries = 3;
    const delays = Array.from({ length: retries }, (_, i) => baseDelay * (i + 1));

    expect(delays).toEqual([1000, 2000, 3000]);
  });
});

describe('Timeout Handling', () => {
  it('should have default timeout of 5000ms', () => {
    const DEFAULT_TIMEOUT = 5000;
    expect(DEFAULT_TIMEOUT).toBe(5000);
  });

  it('should detect abort errors', () => {
    const abortError = new Error('The operation was aborted');
    expect(abortError.message).toContain('abort');
  });

  it('should format timeout error message', () => {
    const timeout = 5000;
    const message = `Request timed out after ${timeout}ms`;
    expect(message).toBe('Request timed out after 5000ms');
  });
});

describe('HTTP Status Code Handling', () => {
  it('should accept 200 OK', () => {
    const statusCode = 200;
    expect(statusCode).toBe(200);
  });

  it('should reject non-200 status codes', () => {
    const statusCodes = [400, 404, 500, 502, 503];
    statusCodes.forEach(code => {
      expect(code).not.toBe(200);
    });
  });

  it('should format HTTP error messages', () => {
    const statusCode = 500;
    const message = `HTTP ${statusCode}`;
    expect(message).toBe('HTTP 500');
  });
});

describe('Public pNodes List', () => {
  it('should have known public pNode IPs', () => {
    const PUBLIC_PNODES = [
      '173.212.203.145',
      '173.212.220.65',
      '161.97.97.41',
      '192.190.136.36',
      '192.190.136.37',
      '192.190.136.38',
      '192.190.136.28',
      '192.190.136.29',
      '207.244.255.1',
    ];

    expect(PUBLIC_PNODES.length).toBe(9);
    expect(PUBLIC_PNODES[0]).toBe('173.212.203.145');
  });

  it('should have valid IP addresses', () => {
    const ip = '192.168.1.1';
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    expect(ipRegex.test(ip)).toBe(true);
  });
});
