import type { Metadata } from "next";
import { Inter, Geist_Mono } from "next/font/google";
import { TRPCProvider } from "@/lib/trpc";
import { BookmarkProvider } from "@/components/providers/bookmark-provider";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "pNode Pulse - Xandeum Network Explorer",
  description: "Real-time analytics platform for Xandeum's pNode network",
  keywords: ["Xandeum", "pNode", "blockchain", "storage", "analytics", "Solana"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${geistMono.variable} antialiased bg-background text-foreground min-h-screen flex flex-col`}
      >
        <TRPCProvider>
          <BookmarkProvider>
            <Header />
            <div className="flex-1">{children}</div>
            <Footer />
          </BookmarkProvider>
        </TRPCProvider>
      </body>
    </html>
  );
}
