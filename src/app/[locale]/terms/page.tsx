import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service | pNode Pulse",
  description: "Terms of Service for pNode Pulse - Xandeum pNode Network Analytics Platform",
};

export default function TermsOfServicePage() {
  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="prose prose-invert max-w-none">
        <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
        <p className="text-muted-foreground mb-8">
          <strong>Effective Date</strong>: December 9, 2025 | <strong>Last Updated</strong>: December 13, 2025
        </p>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-foreground">1. Acceptance of Terms</h2>
          <p className="text-muted-foreground">
            By accessing or using pNode Pulse (&quot;Service&quot;), you agree to be bound by these Terms of Service (&quot;Terms&quot;). If you disagree with any part of these terms, you may not access the Service.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-foreground">2. Description of Service</h2>
          <p className="text-muted-foreground mb-4">
            pNode Pulse is a real-time analytics and monitoring platform for the Xandeum pNode network. The Service provides:
          </p>
          <ul className="list-disc pl-6 text-muted-foreground space-y-2">
            <li>Network status monitoring and visualization</li>
            <li>Node performance metrics and analytics</li>
            <li>Historical data tracking and trend analysis</li>
            <li>Alert notifications and reporting tools</li>
            <li>Public API for data access</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-foreground">3. User Accounts</h2>

          <h3 className="text-lg font-medium mb-2 text-foreground">3.1 Account Creation</h3>
          <p className="text-muted-foreground mb-4">
            You may create an account using your Solana wallet address. You are responsible for maintaining the security of your wallet and any activities under your account.
          </p>

          <h3 className="text-lg font-medium mb-2 text-foreground">3.2 Account Responsibilities</h3>
          <ul className="list-disc pl-6 text-muted-foreground space-y-2">
            <li>Keep your wallet credentials secure</li>
            <li>Provide accurate information</li>
            <li>Notify us of any unauthorized use</li>
            <li>You are responsible for all activity under your account</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-foreground">4. Acceptable Use</h2>
          <p className="text-muted-foreground mb-4">You agree NOT to:</p>
          <ul className="list-disc pl-6 text-muted-foreground space-y-2">
            <li>Use the Service for any illegal purpose</li>
            <li>Attempt to gain unauthorized access to the Service</li>
            <li>Interfere with or disrupt the Service</li>
            <li>Abuse the API through excessive requests or scraping</li>
            <li>Impersonate others or misrepresent your affiliation</li>
            <li>Upload malicious code or attempt to exploit vulnerabilities</li>
            <li>Use the Service to harass, abuse, or harm others</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-foreground">5. API Usage</h2>

          <h3 className="text-lg font-medium mb-2 text-foreground">5.1 Rate Limits</h3>
          <p className="text-muted-foreground mb-4">
            API access is subject to rate limits. Exceeding these limits may result in temporary or permanent suspension of your access.
          </p>

          <h3 className="text-lg font-medium mb-2 text-foreground">5.2 Attribution</h3>
          <p className="text-muted-foreground">
            If you use our API data in your application or website, we request (but do not require) attribution to pNode Pulse.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-foreground">6. Intellectual Property</h2>

          <h3 className="text-lg font-medium mb-2 text-foreground">6.1 Our Content</h3>
          <p className="text-muted-foreground mb-4">
            The Service, including its original content, features, and functionality, is owned by RECTOR-LABS and is protected by copyright, trademark, and other intellectual property laws.
          </p>

          <h3 className="text-lg font-medium mb-2 text-foreground">6.2 Open Source</h3>
          <p className="text-muted-foreground">
            The pNode Pulse codebase is available under the MIT License. See our <a href="https://github.com/RECTOR-LABS/pnode-pulse" className="text-brand-500 hover:underline" target="_blank" rel="noopener noreferrer">GitHub repository</a> for details.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-foreground">7. Data and Privacy</h2>
          <p className="text-muted-foreground">
            Your use of the Service is also governed by our <Link href="/privacy" className="text-brand-500 hover:underline">Privacy Policy</Link>, which describes how we collect, use, and protect your data.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-foreground">8. Disclaimers</h2>

          <h3 className="text-lg font-medium mb-2 text-foreground">8.1 Service &quot;As Is&quot;</h3>
          <p className="text-muted-foreground mb-4">
            The Service is provided &quot;AS IS&quot; and &quot;AS AVAILABLE&quot; without warranties of any kind, either express or implied, including but not limited to implied warranties of merchantability, fitness for a particular purpose, and non-infringement.
          </p>

          <h3 className="text-lg font-medium mb-2 text-foreground">8.2 Data Accuracy</h3>
          <p className="text-muted-foreground mb-4">
            We strive to provide accurate data, but we do not guarantee the accuracy, completeness, or timeliness of any information displayed on the Service. Node data is sourced from the Xandeum pRPC network and may not reflect real-time conditions.
          </p>

          <h3 className="text-lg font-medium mb-2 text-foreground">8.3 No Financial Advice</h3>
          <p className="text-muted-foreground">
            Nothing on this Service constitutes financial, investment, or legal advice. Always do your own research before making decisions related to blockchain networks or cryptocurrency.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-foreground">9. Limitation of Liability</h2>
          <p className="text-muted-foreground">
            To the maximum extent permitted by law, RECTOR-LABS and its affiliates shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits, data, or other intangible losses, resulting from:
          </p>
          <ul className="list-disc pl-6 text-muted-foreground space-y-2 mt-4">
            <li>Your use or inability to use the Service</li>
            <li>Any unauthorized access to your account</li>
            <li>Any interruption or cessation of the Service</li>
            <li>Any bugs, viruses, or other harmful code</li>
            <li>Errors or omissions in any content</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-foreground">10. Indemnification</h2>
          <p className="text-muted-foreground">
            You agree to indemnify and hold harmless RECTOR-LABS and its affiliates from any claims, damages, losses, or expenses arising from your use of the Service or violation of these Terms.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-foreground">11. Termination</h2>
          <p className="text-muted-foreground mb-4">
            We may terminate or suspend your access to the Service immediately, without prior notice, for:
          </p>
          <ul className="list-disc pl-6 text-muted-foreground space-y-2">
            <li>Breach of these Terms</li>
            <li>Conduct that we believe is harmful to other users or the Service</li>
            <li>Any other reason at our sole discretion</li>
          </ul>
          <p className="text-muted-foreground mt-4">
            Upon termination, your right to use the Service will immediately cease.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-foreground">12. Changes to Terms</h2>
          <p className="text-muted-foreground">
            We reserve the right to modify these Terms at any time. Changes will be posted on this page with an updated &quot;Last Updated&quot; date. Your continued use of the Service after changes constitutes acceptance of the modified Terms.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-foreground">13. Governing Law</h2>
          <p className="text-muted-foreground">
            These Terms shall be governed by and construed in accordance with applicable laws, without regard to conflict of law principles.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4 text-foreground">14. Contact Us</h2>
          <p className="text-muted-foreground">
            If you have any questions about these Terms, please contact us:
          </p>
          <ul className="list-none pl-0 mt-4 text-muted-foreground space-y-2">
            <li><strong>Email:</strong> legal@rectorspace.com</li>
            <li><strong>GitHub:</strong> <a href="https://github.com/RECTOR-LABS/pnode-pulse/issues" className="text-brand-500 hover:underline" target="_blank" rel="noopener noreferrer">RECTOR-LABS/pnode-pulse/issues</a></li>
          </ul>
        </section>

        <section className="pt-8 border-t border-muted">
          <p className="text-sm text-muted-foreground">
            By using pNode Pulse, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.
          </p>
        </section>
      </div>
    </div>
  );
}
