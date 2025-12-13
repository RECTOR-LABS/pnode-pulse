import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | pNode Pulse",
  description: "Privacy Policy for pNode Pulse - Xandeum pNode Network Analytics Platform",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="prose prose-invert max-w-none">
        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-muted-foreground mb-8">
          <strong>Effective Date</strong>: December 9, 2025 | <strong>Last Updated</strong>: December 9, 2025
        </p>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-foreground">Introduction</h2>
          <p className="text-muted-foreground">
            Welcome to pNode Pulse (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;). We respect your privacy and are committed to protecting your personal data. This Privacy Policy explains how we collect, use, and safeguard your information when you use our pNode network analytics platform.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-foreground">Information We Collect</h2>

          <h3 className="text-lg font-medium mb-2 text-foreground">1. Information You Provide</h3>
          <ul className="list-disc pl-6 mb-4 text-muted-foreground space-y-2">
            <li><strong>Wallet Address</strong> (Required for Authentication) - Your Solana wallet public key used for wallet-based authentication</li>
            <li><strong>Email Address</strong> (Optional) - Provided voluntarily for alert notifications</li>
            <li><strong>Display Name</strong> (Optional) - Custom username for your operator profile</li>
          </ul>

          <h3 className="text-lg font-medium mb-2 text-foreground">2. Information We Collect Automatically</h3>
          <ul className="list-disc pl-6 mb-4 text-muted-foreground space-y-2">
            <li><strong>Session Data</strong> - IP Address, User Agent, login timestamps</li>
            <li><strong>Usage Data</strong> - Pages visited, features used, API requests</li>
            <li><strong>Performance Data</strong> - Page load times, anonymized error logs</li>
          </ul>

          <h3 className="text-lg font-medium mb-2 text-foreground">3. Information We Do NOT Collect</h3>
          <ul className="list-disc pl-6 text-muted-foreground space-y-2">
            <li>❌ Private keys or seed phrases (never requested or stored)</li>
            <li>❌ Transaction history from your wallet</li>
            <li>❌ Personal identifying information (name, address, phone)</li>
            <li>❌ Financial information (credit cards, bank accounts)</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-foreground">How We Use Your Information</h2>
          <ul className="list-disc pl-6 text-muted-foreground space-y-2">
            <li><strong>Authentication</strong> - Verify wallet ownership via cryptographic signatures</li>
            <li><strong>Service Functionality</strong> - Send alert notifications, generate reports</li>
            <li><strong>Security</strong> - Detect and prevent unauthorized access, enforce rate limits</li>
            <li><strong>Analytics</strong> - Improve user experience and platform performance</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-foreground">Data Retention</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-muted">
                  <th className="text-left py-2 px-4 text-foreground">Data Type</th>
                  <th className="text-left py-2 px-4 text-foreground">Retention Period</th>
                </tr>
              </thead>
              <tbody className="text-muted-foreground">
                <tr className="border-b border-muted/50">
                  <td className="py-2 px-4">User Account</td>
                  <td className="py-2 px-4">Until deletion requested</td>
                </tr>
                <tr className="border-b border-muted/50">
                  <td className="py-2 px-4">Session Data</td>
                  <td className="py-2 px-4">7 days</td>
                </tr>
                <tr className="border-b border-muted/50">
                  <td className="py-2 px-4">Node Metrics</td>
                  <td className="py-2 px-4">90 days rolling window</td>
                </tr>
                <tr className="border-b border-muted/50">
                  <td className="py-2 px-4">Audit Logs</td>
                  <td className="py-2 px-4">180 days</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-foreground">Data Sharing</h2>
          <p className="text-muted-foreground mb-4">
            <strong>We DO NOT sell your data.</strong> We may share data only with:
          </p>
          <ul className="list-disc pl-6 text-muted-foreground space-y-2">
            <li>Service providers (hosting, email delivery) with strict data protection agreements</li>
            <li>Legal requirements (court orders, subpoenas)</li>
            <li>Business transfers (with prior notification)</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-foreground">Your Privacy Rights</h2>

          <h3 className="text-lg font-medium mb-2 text-foreground">Under GDPR (European Users)</h3>
          <p className="text-muted-foreground mb-4">
            Access, rectification, erasure, portability, object, and restrict processing.
          </p>

          <h3 className="text-lg font-medium mb-2 text-foreground">Under CCPA (California Users)</h3>
          <p className="text-muted-foreground mb-4">
            Know, delete, opt-out, and non-discrimination rights.
          </p>

          <p className="text-muted-foreground">
            <strong>Contact:</strong> privacy@rectorspace.com
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-foreground">Data Security</h2>
          <ul className="list-disc pl-6 text-muted-foreground space-y-2">
            <li>Encrypted data transmission (HTTPS/TLS)</li>
            <li>Encrypted data at rest (database encryption)</li>
            <li>Secure authentication (cryptographic signatures)</li>
            <li>Rate limiting and DDoS protection</li>
            <li>Regular security audits</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-foreground">Contact Us</h2>
          <p className="text-muted-foreground">
            For privacy-related questions, requests, or concerns:
          </p>
          <ul className="list-none pl-0 mt-4 text-muted-foreground space-y-2">
            <li><strong>Email:</strong> privacy@rectorspace.com</li>
            <li><strong>GitHub:</strong> <a href="https://github.com/RECTOR-LABS/pnode-pulse/issues" className="text-brand-500 hover:underline" target="_blank" rel="noopener noreferrer">RECTOR-LABS/pnode-pulse/issues</a></li>
          </ul>
        </section>

        <section className="pt-8 border-t border-muted">
          <p className="text-sm text-muted-foreground">
            This Privacy Policy complies with GDPR, CCPA, and PIPEDA. Last Legal Review: December 9, 2025
          </p>
        </section>
      </div>
    </div>
  );
}
