"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { trpc } from "@/lib/trpc/client";
import { useWallet } from "@solana/wallet-adapter-react";
import bs58 from "bs58";

interface ClaimNodeButtonProps {
  nodeId: number;
  nodePubkey?: string | null;
  size?: "sm" | "md" | "lg";
}

type VerificationMethod = "WALLET_SIGNATURE" | "VERIFICATION_FILE" | "DNS_TXT";

interface VerificationData {
  token: string;
  expiresAt: string;
  message?: string;
  nodePubkey?: string;
  expectedPath?: string;
  expectedContent?: string;
  recordName?: string;
  expectedValue?: string;
}

export function ClaimNodeButton({ nodeId, nodePubkey, size = "md" }: ClaimNodeButtonProps) {
  const { user, isAuthenticated } = useAuth();
  const { signMessage } = useWallet();
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<"select" | "verify" | "success">("select");
  const [method, setMethod] = useState<VerificationMethod | null>(null);
  const [claimId, setClaimId] = useState<string | null>(null);
  const [verificationData, setVerificationData] = useState<VerificationData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const { data: claimStatus, refetch: refetchStatus } = trpc.claims.checkNode.useQuery(
    { nodeId },
    { enabled: isOpen }
  );

  const initiateMutation = trpc.claims.initiate.useMutation();
  const verifyMutation = trpc.claims.verify.useMutation();
  const releaseMutation = trpc.claims.release.useMutation();

  const sizeClasses = {
    sm: "text-xs px-2 py-1",
    md: "text-sm px-3 py-1.5",
    lg: "text-base px-4 py-2",
  };

  const handleInitiate = async (selectedMethod: VerificationMethod) => {
    if (!user) return;
    setError(null);
    setMethod(selectedMethod);

    try {
      const result = await initiateMutation.mutateAsync({
        userId: user.id,
        walletAddress: user.walletAddress,
        nodeId,
        verificationMethod: selectedMethod,
      });

      setClaimId(result.claimId);
      setVerificationData(result.verificationData as unknown as VerificationData);
      setStep("verify");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to initiate claim");
    }
  };

  const handleVerify = async () => {
    if (!user || !claimId || !verificationData) return;
    setError(null);
    setIsVerifying(true);

    try {
      let signature: string | undefined;

      if (method === "WALLET_SIGNATURE" && verificationData.message && signMessage) {
        const messageBytes = new TextEncoder().encode(verificationData.message);
        const signatureBytes = await signMessage(messageBytes);
        signature = bs58.encode(signatureBytes);
      }

      await verifyMutation.mutateAsync({
        claimId,
        userId: user.id,
        signature,
      });

      setStep("success");
      refetchStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleRelease = async () => {
    if (!user || !claimStatus?.claim) return;

    if (!confirm("Are you sure you want to release this claim? You will need to verify again to reclaim.")) {
      return;
    }

    try {
      await releaseMutation.mutateAsync({
        claimId: claimStatus.claim.id,
        userId: user.id,
      });
      refetchStatus();
      setIsOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to release claim");
    }
  };

  const resetDialog = () => {
    setStep("select");
    setMethod(null);
    setClaimId(null);
    setVerificationData(null);
    setError(null);
  };

  if (!isAuthenticated) {
    return null;
  }

  // Already claimed by current user
  if (claimStatus?.claimed && claimStatus.claim?.user?.id === user?.id) {
    return (
      <>
        <button
          onClick={() => setIsOpen(true)}
          className={`${sizeClasses[size]} rounded-lg bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-500/20 transition-colors flex items-center gap-1.5`}
          title="You own this node"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          Owned
        </button>

        {isOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-card border border-border rounded-xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Your Node</h3>
                <button onClick={() => setIsOpen(false)} className="text-muted-foreground hover:text-foreground">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="text-center py-6">
                <div className="w-16 h-16 rounded-full bg-green-500/10 mx-auto mb-4 flex items-center justify-center">
                  <svg className="w-8 h-8 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <p className="text-muted-foreground mb-4">
                  You have verified ownership of this node.
                </p>
                <button
                  onClick={handleRelease}
                  className="text-sm text-red-500 hover:underline"
                >
                  Release Claim
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // Already claimed by someone else
  if (claimStatus?.claimed) {
    return (
      <span
        className={`${sizeClasses[size]} rounded-lg bg-muted text-muted-foreground flex items-center gap-1.5`}
        title={`Claimed by ${claimStatus.claim?.displayName || claimStatus.claim?.user?.displayName || "another user"}`}
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        Claimed
      </span>
    );
  }

  return (
    <>
      <button
        onClick={() => { setIsOpen(true); resetDialog(); }}
        className={`${sizeClasses[size]} rounded-lg bg-brand-500 text-white hover:bg-brand-600 transition-colors flex items-center gap-1.5`}
        title="Claim ownership of this node"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
        Claim
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">
                {step === "select" && "Claim This Node"}
                {step === "verify" && "Verify Ownership"}
                {step === "success" && "Claim Successful"}
              </h3>
              <button onClick={() => setIsOpen(false)} className="text-muted-foreground hover:text-foreground">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-600 dark:text-red-400 text-sm">
                {error}
              </div>
            )}

            {step === "select" && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground mb-4">
                  Choose a verification method to prove you operate this node:
                </p>

                {nodePubkey && (
                  <button
                    onClick={() => handleInitiate("WALLET_SIGNATURE")}
                    className="w-full p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors text-left"
                    disabled={initiateMutation.isPending}
                  >
                    <div className="font-medium flex items-center gap-2">
                      <svg className="w-5 h-5 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                      </svg>
                      Wallet Signature
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Sign a message with the node's keypair
                    </p>
                  </button>
                )}

                <button
                  onClick={() => handleInitiate("VERIFICATION_FILE")}
                  className="w-full p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors text-left"
                  disabled={initiateMutation.isPending}
                >
                  <div className="font-medium flex items-center gap-2">
                    <svg className="w-5 h-5 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Verification File
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Place a verification file on your node's HTTP server
                  </p>
                </button>

                <button
                  onClick={() => handleInitiate("DNS_TXT")}
                  className="w-full p-4 border border-border rounded-lg hover:bg-muted/50 transition-colors text-left opacity-50 cursor-not-allowed"
                  disabled
                >
                  <div className="font-medium flex items-center gap-2">
                    <svg className="w-5 h-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                    </svg>
                    DNS TXT Record
                    <span className="text-xs bg-muted px-1.5 py-0.5 rounded">Coming Soon</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Add a TXT record to your domain's DNS
                  </p>
                </button>
              </div>
            )}

            {step === "verify" && verificationData && (
              <div className="space-y-4">
                {method === "WALLET_SIGNATURE" && (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Sign this message with your wallet to prove you control the node's keypair:
                    </p>
                    <pre className="p-3 bg-muted rounded-lg text-xs font-mono overflow-x-auto whitespace-pre-wrap">
                      {verificationData.message}
                    </pre>
                  </>
                )}

                {method === "VERIFICATION_FILE" && (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Create a file at the following path on your node:
                    </p>
                    <div className="p-3 bg-muted rounded-lg">
                      <div className="text-xs text-muted-foreground mb-1">Path:</div>
                      <code className="text-sm font-mono">{verificationData.expectedPath}</code>
                    </div>
                    <div className="p-3 bg-muted rounded-lg">
                      <div className="text-xs text-muted-foreground mb-1">Content:</div>
                      <code className="text-sm font-mono">{verificationData.expectedContent}</code>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      The file must be accessible at http://YOUR_NODE_IP{verificationData.expectedPath}
                    </p>
                  </>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => setStep("select")}
                    className="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-muted transition-colors"
                    disabled={isVerifying}
                  >
                    Back
                  </button>
                  <button
                    onClick={handleVerify}
                    className="flex-1 px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors disabled:opacity-50"
                    disabled={isVerifying}
                  >
                    {isVerifying ? "Verifying..." : "Verify"}
                  </button>
                </div>
              </div>
            )}

            {step === "success" && (
              <div className="text-center py-6">
                <div className="w-16 h-16 rounded-full bg-green-500/10 mx-auto mb-4 flex items-center justify-center">
                  <svg className="w-8 h-8 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <h4 className="text-lg font-medium mb-2">Node Claimed!</h4>
                <p className="text-muted-foreground mb-4">
                  You have successfully verified ownership of this node.
                </p>
                <button
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
