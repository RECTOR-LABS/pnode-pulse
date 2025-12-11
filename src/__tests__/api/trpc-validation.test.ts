/**
 * tRPC Input Validation Tests
 *
 * Tests Zod schema validation for tRPC procedures including:
 * - Auth router validation (wallet addresses, signatures)
 * - Nodes router validation (pagination, filtering, ordering)
 * - Edge cases and boundary conditions
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';

/**
 * Auth Router Schemas
 */
const requestChallengeSchema = z.object({
  walletAddress: z.string().min(32).max(44),
});

const verifySignatureSchema = z.object({
  challengeId: z.string(),
  walletAddress: z.string().min(32).max(44),
  signature: z.string(),
});

const meSchema = z.object({
  token: z.string().min(1),
});

const updateProfileSchema = z.object({
  token: z.string(),
  displayName: z.string().min(1).max(50).optional(),
  avatarUrl: z.string().url().optional(),
});

const updatePreferencesSchema = z.object({
  token: z.string(),
  preferences: z.object({
    theme: z.enum(['light', 'dark', 'system']).optional(),
    timezone: z.string().optional(),
    dateFormat: z.enum(['US', 'EU', 'ISO']).optional(),
    defaultDashboard: z.enum(['network', 'portfolio']).optional(),
    refreshInterval: z.number().min(15).max(300).optional(),
    emailNotifications: z.boolean().optional(),
    showInLeaderboard: z.boolean().optional(),
    publicProfile: z.boolean().optional(),
  }),
});

/**
 * Nodes Router Schemas
 */
const nodesListSchema = z.object({
  status: z.enum(['all', 'active', 'inactive']).default('all'),
  version: z.string().optional(),
  search: z.string().optional(),
  limit: z.number().min(1).max(100).default(50),
  offset: z.number().min(0).default(0),
  orderBy: z
    .enum(['lastSeen', 'firstSeen', 'address', 'version', 'isActive'])
    .default('lastSeen'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

describe('Auth Router Validation', () => {
  describe('requestChallenge Input', () => {
    it('should accept valid Solana wallet address (32 chars)', () => {
      const input = { walletAddress: '7T4zPNNDAT7rwkQ6Rf2QyMvLwowQ4KDS' };
      const result = requestChallengeSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should accept valid Solana wallet address (44 chars)', () => {
      const input = {
        walletAddress: '7T4zPNNDAT7rwkQ6Rf2QyMvLwowQ4KDSxKRXF9qEtYvR',
      };
      const result = requestChallengeSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject wallet address too short', () => {
      const input = { walletAddress: '7T4zPNNDAT7rwkQ6' };
      const result = requestChallengeSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject wallet address too long', () => {
      const input = {
        walletAddress:
          '7T4zPNNDAT7rwkQ6Rf2QyMvLwowQ4KDSxKRXF9qEtYvRExtended',
      };
      const result = requestChallengeSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject empty wallet address', () => {
      const input = { walletAddress: '' };
      const result = requestChallengeSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject missing wallet address', () => {
      const input = {};
      const result = requestChallengeSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('verifySignature Input', () => {
    it('should accept valid input', () => {
      const input = {
        challengeId: 'ch_123456',
        walletAddress: '7T4zPNNDAT7rwkQ6Rf2QyMvLwowQ4KDSxKRXF9qEtYvR',
        signature: 'base58signature',
      };
      const result = verifySignatureSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject missing challengeId', () => {
      const input = {
        walletAddress: '7T4zPNNDAT7rwkQ6Rf2QyMvLwowQ4KDSxKRXF9qEtYvR',
        signature: 'base58signature',
      };
      const result = verifySignatureSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject missing signature', () => {
      const input = {
        challengeId: 'ch_123456',
        walletAddress: '7T4zPNNDAT7rwkQ6Rf2QyMvLwowQ4KDSxKRXF9qEtYvR',
      };
      const result = verifySignatureSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject invalid wallet address', () => {
      const input = {
        challengeId: 'ch_123456',
        walletAddress: 'invalid',
        signature: 'base58signature',
      };
      const result = verifySignatureSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('me (Current User) Input', () => {
    it('should accept valid token', () => {
      const input = { token: 'jwt.token.here' };
      const result = meSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject missing token', () => {
      const input = {};
      const result = meSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject empty token', () => {
      const input = { token: '' };
      const result = meSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('updateProfile Input', () => {
    it('should accept valid profile update', () => {
      const input = {
        token: 'jwt.token.here',
        displayName: 'CryptoKnight',
        avatarUrl: 'https://example.com/avatar.jpg',
      };
      const result = updateProfileSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should accept partial update (displayName only)', () => {
      const input = {
        token: 'jwt.token.here',
        displayName: 'CryptoKnight',
      };
      const result = updateProfileSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should accept partial update (avatarUrl only)', () => {
      const input = {
        token: 'jwt.token.here',
        avatarUrl: 'https://example.com/avatar.jpg',
      };
      const result = updateProfileSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject displayName too long', () => {
      const input = {
        token: 'jwt.token.here',
        displayName: 'a'.repeat(51),
      };
      const result = updateProfileSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject displayName empty string', () => {
      const input = {
        token: 'jwt.token.here',
        displayName: '',
      };
      const result = updateProfileSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject invalid avatarUrl format', () => {
      const input = {
        token: 'jwt.token.here',
        avatarUrl: 'not-a-url',
      };
      const result = updateProfileSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject missing token', () => {
      const input = {
        displayName: 'CryptoKnight',
      };
      const result = updateProfileSchema.safeParse(input);
      expect(result.success).toBe(false);
    });
  });

  describe('updatePreferences Input', () => {
    it('should accept valid preferences update', () => {
      const input = {
        token: 'jwt.token.here',
        preferences: {
          theme: 'dark' as const,
          timezone: 'America/New_York',
          dateFormat: 'US' as const,
          defaultDashboard: 'portfolio' as const,
          refreshInterval: 60,
          emailNotifications: true,
          showInLeaderboard: true,
          publicProfile: false,
        },
      };
      const result = updatePreferencesSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should accept partial preferences', () => {
      const input = {
        token: 'jwt.token.here',
        preferences: {
          theme: 'dark' as const,
        },
      };
      const result = updatePreferencesSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject invalid theme value', () => {
      const input = {
        token: 'jwt.token.here',
        preferences: {
          theme: 'blue' as never,
        },
      };
      const result = updatePreferencesSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject invalid dateFormat', () => {
      const input = {
        token: 'jwt.token.here',
        preferences: {
          dateFormat: 'INVALID' as never,
        },
      };
      const result = updatePreferencesSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject refreshInterval below minimum', () => {
      const input = {
        token: 'jwt.token.here',
        preferences: {
          refreshInterval: 10,
        },
      };
      const result = updatePreferencesSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject refreshInterval above maximum', () => {
      const input = {
        token: 'jwt.token.here',
        preferences: {
          refreshInterval: 500,
        },
      };
      const result = updatePreferencesSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should accept refreshInterval at minimum boundary', () => {
      const input = {
        token: 'jwt.token.here',
        preferences: {
          refreshInterval: 15,
        },
      };
      const result = updatePreferencesSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should accept refreshInterval at maximum boundary', () => {
      const input = {
        token: 'jwt.token.here',
        preferences: {
          refreshInterval: 300,
        },
      };
      const result = updatePreferencesSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });
});

describe('Nodes Router Validation', () => {
  describe('list Input', () => {
    it('should accept valid input with all fields', () => {
      const input = {
        status: 'active' as const,
        version: '0.6.0',
        search: '192.168',
        limit: 50,
        offset: 0,
        orderBy: 'lastSeen' as const,
        order: 'desc' as const,
      };
      const result = nodesListSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should apply defaults when fields missing', () => {
      const input = {};
      const result = nodesListSchema.safeParse(input);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('all');
        expect(result.data.limit).toBe(50);
        expect(result.data.offset).toBe(0);
        expect(result.data.orderBy).toBe('lastSeen');
        expect(result.data.order).toBe('desc');
      }
    });

    it('should accept status: active', () => {
      const input = { status: 'active' as const };
      const result = nodesListSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should accept status: inactive', () => {
      const input = { status: 'inactive' as const };
      const result = nodesListSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should accept status: all', () => {
      const input = { status: 'all' as const };
      const result = nodesListSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject invalid status', () => {
      const input = { status: 'online' as never };
      const result = nodesListSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should accept limit at minimum boundary', () => {
      const input = { limit: 1 };
      const result = nodesListSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should accept limit at maximum boundary', () => {
      const input = { limit: 100 };
      const result = nodesListSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject limit below minimum', () => {
      const input = { limit: 0 };
      const result = nodesListSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should reject limit above maximum', () => {
      const input = { limit: 101 };
      const result = nodesListSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should accept offset at minimum', () => {
      const input = { offset: 0 };
      const result = nodesListSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should accept large offset', () => {
      const input = { offset: 1000 };
      const result = nodesListSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject negative offset', () => {
      const input = { offset: -1 };
      const result = nodesListSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should accept orderBy: lastSeen', () => {
      const input = { orderBy: 'lastSeen' as const };
      const result = nodesListSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should accept orderBy: firstSeen', () => {
      const input = { orderBy: 'firstSeen' as const };
      const result = nodesListSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should accept orderBy: address', () => {
      const input = { orderBy: 'address' as const };
      const result = nodesListSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should accept orderBy: version', () => {
      const input = { orderBy: 'version' as const };
      const result = nodesListSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should accept orderBy: isActive', () => {
      const input = { orderBy: 'isActive' as const };
      const result = nodesListSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject invalid orderBy', () => {
      const input = { orderBy: 'cpu' as never };
      const result = nodesListSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should accept order: asc', () => {
      const input = { order: 'asc' as const };
      const result = nodesListSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should accept order: desc', () => {
      const input = { order: 'desc' as const };
      const result = nodesListSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should reject invalid order', () => {
      const input = { order: 'ascending' as never };
      const result = nodesListSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it('should accept optional search string', () => {
      const input = { search: 'pnode-42' };
      const result = nodesListSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('should accept optional version string', () => {
      const input = { version: '0.6.0' };
      const result = nodesListSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });
});

describe('Input Validation Edge Cases', () => {
  it('should reject non-string values for string fields', () => {
    const input = { walletAddress: 12345 };
    const result = requestChallengeSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('should reject non-number values for number fields', () => {
    const input = { limit: '50' };
    const result = nodesListSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('should reject non-boolean values for boolean fields', () => {
    const input = {
      token: 'jwt.token.here',
      preferences: {
        emailNotifications: 'true',
      },
    };
    const result = updatePreferencesSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it('should handle undefined optional fields correctly', () => {
    const input = {
      token: 'jwt.token.here',
      displayName: undefined,
      avatarUrl: undefined,
    };
    const result = updateProfileSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('should handle null values as invalid', () => {
    const input = {
      token: null,
    };
    const result = meSchema.safeParse(input);
    expect(result.success).toBe(false);
  });
});
