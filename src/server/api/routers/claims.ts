/**
 * Node Claims Router
 *
 * Allows operators to prove ownership of their nodes.
 * Supports multiple verification methods:
 * - Wallet signature (if node has pubkey matching wallet)
 * - Verification file (place file on node HTTP server)
 * - DNS TXT record (for domain-based verification)
 */

import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import { sign } from "tweetnacl";
import { randomBytes } from "crypto";
import bs58 from "bs58";
import type { Prisma } from "@prisma/client";

// Verification token validity (24 hours)
const VERIFICATION_VALIDITY_MS = 24 * 60 * 60 * 1000;

/**
 * Check if an IP address is private/internal (SSRF protection)
 */
function isPrivateIP(ip: string): boolean {
  // IPv4 private ranges
  const privateRanges = [
    /^127\./, // Loopback
    /^10\./, // Class A private
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./, // Class B private
    /^192\.168\./, // Class C private
    /^169\.254\./, // Link-local
    /^0\./, // Current network
    /^100\.(6[4-9]|[7-9][0-9]|1[0-1][0-9]|12[0-7])\./, // Carrier-grade NAT
  ];

  return privateRanges.some(range => range.test(ip));
}

/**
 * Generate a random verification token
 */
function generateVerificationToken(): string {
  return randomBytes(16).toString("hex");
}

/**
 * Generate verification message for wallet signature
 */
function generateClaimMessage(
  nodeAddress: string,
  walletAddress: string,
  token: string
): string {
  return `Claim node ownership on pNode Pulse

Node: ${nodeAddress}
Wallet: ${walletAddress}
Token: ${token}
Timestamp: ${new Date().toISOString()}

Sign this message to prove you control the node's keypair.`;
}

/**
 * Verify Solana signature
 */
function verifySignature(
  message: string,
  signature: string,
  publicKey: string
): boolean {
  try {
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = bs58.decode(signature);
    const publicKeyBytes = bs58.decode(publicKey);

    return sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
  } catch {
    return false;
  }
}

export const claimsRouter = createTRPCRouter({
  /**
   * Get all claims for the current user
   */
  list: protectedProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ ctx }) => {
      const claims = await ctx.db.nodeClaim.findMany({
        where: { userId: ctx.userId },
        orderBy: { createdAt: "desc" },
      });

      // Get node details for each claim
      const nodeIds = claims.map((c) => c.nodeId);
      const nodes = await ctx.db.node.findMany({
        where: { id: { in: nodeIds } },
        select: { id: true, address: true, pubkey: true, version: true, isActive: true },
      });

      const nodeMap = new Map(nodes.map((n) => [n.id, n]));

      return claims.map((claim) => ({
        ...claim,
        node: nodeMap.get(claim.nodeId) || null,
      }));
    }),

  /**
   * Check if a node is already claimed
   */
  checkNode: publicProcedure
    .input(z.object({ nodeId: z.number() }))
    .query(async ({ ctx, input }) => {
      const claim = await ctx.db.nodeClaim.findUnique({
        where: { nodeId: input.nodeId },
        include: {
          user: {
            select: { id: true, walletAddress: true, displayName: true },
          },
        },
      });

      if (!claim) {
        return { claimed: false, claim: null };
      }

      return {
        claimed: true,
        claim: {
          id: claim.id,
          status: claim.status,
          displayName: claim.displayName,
          claimedAt: claim.claimedAt,
          user: claim.user,
        },
      };
    }),

  /**
   * Initiate a claim for a node
   */
  initiate: protectedProcedure
    .input(
      z.object({
        token: z.string(),
        nodeId: z.number(),
        verificationMethod: z.enum(["WALLET_SIGNATURE", "VERIFICATION_FILE", "DNS_TXT"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check if node exists
      const node = await ctx.db.node.findUnique({
        where: { id: input.nodeId },
      });

      if (!node) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Node not found",
        });
      }

      // Check if already claimed
      const existingClaim = await ctx.db.nodeClaim.findUnique({
        where: { nodeId: input.nodeId },
      });

      if (existingClaim && existingClaim.status === "VERIFIED") {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Node is already claimed by another user",
        });
      }

      // For wallet signature, verify node has a pubkey
      if (input.verificationMethod === "WALLET_SIGNATURE" && !node.pubkey) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Node does not have a registered public key. Use a different verification method.",
        });
      }

      // Generate verification token
      const token = generateVerificationToken();
      const verificationData: Record<string, unknown> = {
        token,
        expiresAt: new Date(Date.now() + VERIFICATION_VALIDITY_MS).toISOString(),
      };

      // Add method-specific data
      if (input.verificationMethod === "WALLET_SIGNATURE") {
        verificationData.message = generateClaimMessage(node.address, ctx.walletAddress!, token);
        verificationData.nodePubkey = node.pubkey;
      } else if (input.verificationMethod === "VERIFICATION_FILE") {
        verificationData.expectedPath = `/.pnode-pulse-verify`;
        verificationData.expectedContent = token;
      } else if (input.verificationMethod === "DNS_TXT") {
        // Extract hostname from address
        const [host] = node.address.split(":");
        verificationData.recordName = `_pnode-pulse.${host}`;
        verificationData.expectedValue = `pnode-pulse-verify=${token}`;
      }

      // Create or update claim
      const claim = await ctx.db.nodeClaim.upsert({
        where: { nodeId: input.nodeId },
        create: {
          userId: ctx.userId,
          nodeId: input.nodeId,
          verificationMethod: input.verificationMethod,
          status: "PENDING",
          verificationData: verificationData as Prisma.InputJsonValue,
        },
        update: {
          userId: ctx.userId,
          verificationMethod: input.verificationMethod,
          status: "PENDING",
          verificationData: verificationData as Prisma.InputJsonValue,
        },
      });

      return {
        claimId: claim.id,
        verificationMethod: input.verificationMethod,
        verificationData,
      };
    }),

  /**
   * Verify a pending claim
   */
  verify: protectedProcedure
    .input(
      z.object({
        token: z.string(),
        claimId: z.string(),
        signature: z.string().optional(), // For WALLET_SIGNATURE method
      })
    )
    .mutation(async ({ ctx, input }) => {
      const claim = await ctx.db.nodeClaim.findUnique({
        where: { id: input.claimId },
      });

      if (!claim) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Claim not found",
        });
      }

      if (claim.userId !== ctx.userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Not your claim",
        });
      }

      if (claim.status === "VERIFIED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Claim already verified",
        });
      }

      const verificationData = claim.verificationData as Record<string, unknown>;
      const expiresAt = new Date(verificationData.expiresAt as string);

      if (expiresAt < new Date()) {
        await ctx.db.nodeClaim.update({
          where: { id: input.claimId },
          data: { status: "EXPIRED" },
        });
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Verification token expired. Please start a new claim.",
        });
      }

      let verified = false;

      switch (claim.verificationMethod) {
        case "WALLET_SIGNATURE": {
          if (!input.signature) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Signature required for wallet verification",
            });
          }

          const message = verificationData.message as string;
          const nodePubkey = verificationData.nodePubkey as string;

          verified = verifySignature(message, input.signature, nodePubkey);
          break;
        }

        case "VERIFICATION_FILE": {
          // Fetch verification file from node
          const node = await ctx.db.node.findUnique({
            where: { id: claim.nodeId },
          });

          if (!node) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Node not found",
            });
          }

          const [host] = node.address.split(":");

          // SSRF protection: reject private/internal IPs
          if (isPrivateIP(host)) {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Cannot verify nodes with private IP addresses. Node must have a public IP.",
            });
          }

          const verifyUrl = `http://${host}/.pnode-pulse-verify`;

          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);

            const response = await fetch(verifyUrl, {
              signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (response.ok) {
              const content = await response.text();
              verified = content.trim() === verificationData.token;
            }
          } catch {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Could not fetch verification file from node. Ensure the file is accessible at /.pnode-pulse-verify",
            });
          }
          break;
        }

        case "DNS_TXT": {
          // DNS verification would require a DNS lookup library
          // For now, return an error suggesting this method isn't fully implemented
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "DNS verification is not yet fully implemented. Please use another method.",
          });
        }
      }

      if (!verified) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Verification failed. Please check your configuration and try again.",
        });
      }

      // Mark claim as verified
      const updatedClaim = await ctx.db.nodeClaim.update({
        where: { id: input.claimId },
        data: {
          status: "VERIFIED",
          claimedAt: new Date(),
        },
      });

      return {
        success: true,
        claim: updatedClaim,
      };
    }),

  /**
   * Update display name for a claimed node
   */
  updateDisplayName: protectedProcedure
    .input(
      z.object({
        token: z.string(),
        claimId: z.string(),
        displayName: z.string().min(1).max(50).nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const claim = await ctx.db.nodeClaim.findFirst({
        where: {
          id: input.claimId,
          userId: ctx.userId,
          status: "VERIFIED",
        },
      });

      if (!claim) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Verified claim not found",
        });
      }

      const updated = await ctx.db.nodeClaim.update({
        where: { id: input.claimId },
        data: { displayName: input.displayName },
      });

      return updated;
    }),

  /**
   * Release a claim (unclaim a node)
   */
  release: protectedProcedure
    .input(
      z.object({
        token: z.string(),
        claimId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const claim = await ctx.db.nodeClaim.findFirst({
        where: {
          id: input.claimId,
          userId: ctx.userId,
        },
      });

      if (!claim) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Claim not found",
        });
      }

      await ctx.db.nodeClaim.delete({
        where: { id: input.claimId },
      });

      return { success: true };
    }),

  /**
   * Get claim by node ID
   */
  getByNode: publicProcedure
    .input(z.object({ nodeId: z.number() }))
    .query(async ({ ctx, input }) => {
      const claim = await ctx.db.nodeClaim.findUnique({
        where: { nodeId: input.nodeId },
        include: {
          user: {
            select: { id: true, walletAddress: true, displayName: true },
          },
        },
      });

      return claim;
    }),
});
