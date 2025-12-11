/**
 * Root Layout
 *
 * This is a minimal wrapper - all actual layout logic is in [locale]/layout.tsx
 * This file exists to support non-localized routes (api, embed, etc.)
 */

// Required for Next.js App Router - children are passed from the routing layer
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
