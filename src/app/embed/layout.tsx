/**
 * Embed Layout
 *
 * Minimal layout for embeddable widgets without the main app navigation.
 * Used for iframe embeds on external sites.
 */

import { Metadata } from "next";

export const metadata: Metadata = {
  title: "pNode Pulse Widget",
  description: "Embeddable pNode metrics widget",
  robots: "noindex, nofollow",
};

export default function EmbedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
