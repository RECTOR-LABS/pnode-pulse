/**
 * JWT Authentication Tests
 *
 * Tests JWT token generation, verification, and security properties.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SignJWT, jwtVerify } from 'jose';
import { JWT_SECRET, JWT_ISSUER, JWT_AUDIENCE, JWT_VALIDITY_MS } from '@/lib/auth/jwt-config';

describe('JWT Configuration', () => {
  it('should have JWT_SECRET defined', () => {
    expect(JWT_SECRET).toBeDefined();
    expect(JWT_SECRET).toBeInstanceOf(Uint8Array);
  });

  it('should have valid JWT constants', () => {
    expect(JWT_ISSUER).toBe('pnode-pulse');
    expect(JWT_AUDIENCE).toBe('pnode-pulse-app');
    expect(JWT_VALIDITY_MS).toBe(7 * 24 * 60 * 60 * 1000); // 7 days
  });
});

describe('JWT Token Generation', () => {
  const userId = 'test-user-id';
  const walletAddress = 'test-wallet-address';

  it('should generate a valid JWT token', async () => {
    const token = await new SignJWT({
      sub: userId,
      wallet: walletAddress,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setIssuer(JWT_ISSUER)
      .setAudience(JWT_AUDIENCE)
      .setExpirationTime(Math.floor((Date.now() + JWT_VALIDITY_MS) / 1000))
      .sign(JWT_SECRET);

    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
  });

  it('should include correct payload in token', async () => {
    const token = await new SignJWT({
      sub: userId,
      wallet: walletAddress,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setIssuer(JWT_ISSUER)
      .setAudience(JWT_AUDIENCE)
      .setExpirationTime(Math.floor((Date.now() + JWT_VALIDITY_MS) / 1000))
      .sign(JWT_SECRET);

    const { payload } = await jwtVerify(token, JWT_SECRET);

    expect(payload.sub).toBe(userId);
    expect(payload.wallet).toBe(walletAddress);
    expect(payload.iss).toBe(JWT_ISSUER);
    expect(payload.aud).toBe(JWT_AUDIENCE);
  });

  it('should set correct expiration time', async () => {
    const beforeTime = Math.floor(Date.now() / 1000);

    const token = await new SignJWT({
      sub: userId,
      wallet: walletAddress,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setIssuer(JWT_ISSUER)
      .setAudience(JWT_AUDIENCE)
      .setExpirationTime(Math.floor((Date.now() + JWT_VALIDITY_MS) / 1000))
      .sign(JWT_SECRET);

    const { payload } = await jwtVerify(token, JWT_SECRET);

    const expectedExpiry = beforeTime + Math.floor(JWT_VALIDITY_MS / 1000);
    expect(payload.exp).toBeGreaterThanOrEqual(expectedExpiry - 1);
    expect(payload.exp).toBeLessThanOrEqual(expectedExpiry + 1);
  });
});

describe('JWT Token Verification', () => {
  const userId = 'test-user-id';
  const walletAddress = 'test-wallet-address';

  it('should verify a valid token', async () => {
    const token = await new SignJWT({
      sub: userId,
      wallet: walletAddress,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setIssuer(JWT_ISSUER)
      .setAudience(JWT_AUDIENCE)
      .setExpirationTime(Math.floor((Date.now() + JWT_VALIDITY_MS) / 1000))
      .sign(JWT_SECRET);

    const result = await jwtVerify(token, JWT_SECRET, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });

    expect(result.payload.sub).toBe(userId);
    expect(result.payload.wallet).toBe(walletAddress);
  });

  it('should reject token with wrong secret', async () => {
    const wrongSecret = new TextEncoder().encode('wrong-secret');

    const token = await new SignJWT({
      sub: userId,
      wallet: walletAddress,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setIssuer(JWT_ISSUER)
      .setAudience(JWT_AUDIENCE)
      .setExpirationTime(Math.floor((Date.now() + JWT_VALIDITY_MS) / 1000))
      .sign(JWT_SECRET);

    await expect(
      jwtVerify(token, wrongSecret, {
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
      })
    ).rejects.toThrow();
  });

  it('should reject expired token', async () => {
    const token = await new SignJWT({
      sub: userId,
      wallet: walletAddress,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setIssuer(JWT_ISSUER)
      .setAudience(JWT_AUDIENCE)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 1) // Already expired
      .sign(JWT_SECRET);

    await expect(
      jwtVerify(token, JWT_SECRET, {
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
      })
    ).rejects.toThrow();
  });

  it('should reject token with wrong issuer', async () => {
    const token = await new SignJWT({
      sub: userId,
      wallet: walletAddress,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setIssuer('wrong-issuer')
      .setAudience(JWT_AUDIENCE)
      .setExpirationTime(Math.floor((Date.now() + JWT_VALIDITY_MS) / 1000))
      .sign(JWT_SECRET);

    await expect(
      jwtVerify(token, JWT_SECRET, {
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
      })
    ).rejects.toThrow();
  });

  it('should reject token with wrong audience', async () => {
    const token = await new SignJWT({
      sub: userId,
      wallet: walletAddress,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setIssuer(JWT_ISSUER)
      .setAudience('wrong-audience')
      .setExpirationTime(Math.floor((Date.now() + JWT_VALIDITY_MS) / 1000))
      .sign(JWT_SECRET);

    await expect(
      jwtVerify(token, JWT_SECRET, {
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
      })
    ).rejects.toThrow();
  });

  it('should reject malformed token', async () => {
    const malformedToken = 'not.a.valid.jwt.token';

    await expect(
      jwtVerify(malformedToken, JWT_SECRET, {
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
      })
    ).rejects.toThrow();
  });

  it('should reject empty token', async () => {
    await expect(
      jwtVerify('', JWT_SECRET, {
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
      })
    ).rejects.toThrow();
  });
});

describe('JWT Security Properties', () => {
  it('should generate different tokens with different timestamps', async () => {
    const userId = 'test-user-id';
    const walletAddress = 'test-wallet-address';

    const token1 = await new SignJWT({
      sub: userId,
      wallet: walletAddress,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt(Math.floor(Date.now() / 1000))
      .setIssuer(JWT_ISSUER)
      .setAudience(JWT_AUDIENCE)
      .setExpirationTime(Math.floor((Date.now() + JWT_VALIDITY_MS) / 1000))
      .sign(JWT_SECRET);

    const token2 = await new SignJWT({
      sub: userId,
      wallet: walletAddress,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt(Math.floor(Date.now() / 1000) + 10) // Different timestamp
      .setIssuer(JWT_ISSUER)
      .setAudience(JWT_AUDIENCE)
      .setExpirationTime(Math.floor((Date.now() + JWT_VALIDITY_MS) / 1000))
      .sign(JWT_SECRET);

    expect(token1).not.toBe(token2);
  });

  it('should not allow token tampering', async () => {
    const userId = 'test-user-id';
    const walletAddress = 'test-wallet-address';

    const token = await new SignJWT({
      sub: userId,
      wallet: walletAddress,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setIssuer(JWT_ISSUER)
      .setAudience(JWT_AUDIENCE)
      .setExpirationTime(Math.floor((Date.now() + JWT_VALIDITY_MS) / 1000))
      .sign(JWT_SECRET);

    // Tamper with the token by modifying a character
    const tamperedToken = token.slice(0, -5) + 'XXXXX';

    await expect(
      jwtVerify(tamperedToken, JWT_SECRET, {
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
      })
    ).rejects.toThrow();
  });
});
