import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { notFound } from "next/navigation";
import { Inter, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { locales, type Locale, isRtlLocale } from "@/i18n/config";
import { TRPCProvider } from "@/lib/trpc";
import { BookmarkProvider } from "@/components/providers/bookmark-provider";
import { WalletContextProvider, AuthProvider } from "@/lib/auth";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import "../globals.css";

export const viewport: Viewport = {
  themeColor: "#0066FF",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

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
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "pNode Pulse",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: "website",
    siteName: "pNode Pulse",
    title: "pNode Pulse - Xandeum Network Explorer",
    description: "Real-time analytics platform for Xandeum's pNode network",
  },
  twitter: {
    card: "summary_large_image",
    title: "pNode Pulse - Xandeum Network Explorer",
    description: "Real-time analytics platform for Xandeum's pNode network",
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icons/icon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/icons/icon-192x192.svg", sizes: "192x192", type: "image/svg+xml" }],
  },
};

interface LocaleLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { locale } = await params;

  // Validate locale
  if (!locales.includes(locale as Locale)) {
    notFound();
  }

  // Get messages for this locale
  const messages = await getMessages();

  return (
    <div className={`${inter.variable} ${geistMono.variable} antialiased bg-background text-foreground min-h-screen flex flex-col`}>
      <NextIntlClientProvider messages={messages}>
        <TRPCProvider>
          <WalletContextProvider>
            <AuthProvider>
              <BookmarkProvider>
                <Header />
                <main id="main-content" className="flex-1" role="main">
                  {children}
                </main>
                <Footer />
              </BookmarkProvider>
            </AuthProvider>
          </WalletContextProvider>
        </TRPCProvider>
      </NextIntlClientProvider>
      <Script
        src="/register-sw.js"
        strategy="afterInteractive"
      />
    </div>
  );
}
