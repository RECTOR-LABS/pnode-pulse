/**
 * Root Layout
 *
 * Required by Next.js - must have <html> and <body> tags.
 * All actual layout logic is in [locale]/layout.tsx
 */

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <body
        style={{
          backgroundColor: "#0D1421",
          color: "#F8FAFC",
        }}
      >
        {children}
      </body>
    </html>
  );
}
