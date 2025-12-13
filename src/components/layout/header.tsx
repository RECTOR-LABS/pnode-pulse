"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useFocusTrap } from "@/lib/hooks/use-focus-trap";
import { ThemeToggle } from "@/components/theme-toggle";
import { FavoritesDropdown } from "@/components/ui/favorites-dropdown";
import { ExportDialog } from "@/components/export";
import { ConnectWallet } from "@/components/auth";
import { RealtimeIndicator } from "@/components/ui/realtime-indicator";
import { LanguageSelector } from "@/components/ui/language-selector";

const navigation = [
  { name: "Overview", href: "/" },
  { name: "Nodes", href: "/nodes" },
  { name: "Analytics", href: "/analytics" },
  { name: "Graveyard", href: "/graveyard" },
  { name: "Leaderboard", href: "/leaderboard" },
  { name: "Portfolio", href: "/portfolio" },
  { name: "Map", href: "/map" },
  { name: "Alerts", href: "/alerts" },
  { name: "Reports", href: "/reports" },
];

export function Header() {
  const pathname = usePathname();
  const [showExport, setShowExport] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileMenuRef = useFocusTrap(mobileMenuOpen);

  // Handle Escape key to close mobile menu
  const handleEscape = useCallback((event: KeyboardEvent) => {
    if (event.key === "Escape" && mobileMenuOpen) {
      setMobileMenuOpen(false);
    }
  }, [mobileMenuOpen]);

  useEffect(() => {
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [handleEscape]);

  return (
    <>
      {/* Skip to main content link for keyboard users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-brand-500 focus:text-white focus:rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-400"
      >
        Skip to main content
      </a>

      <ExportDialog isOpen={showExport} onClose={() => setShowExport(false)} />

      {/* Mobile menu overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile menu drawer */}
      <div
        ref={mobileMenuRef}
        id="mobile-menu"
        role="dialog"
        aria-modal="true"
        aria-label="Mobile navigation menu"
        className={`fixed top-0 left-0 h-full w-72 bg-background border-r border-border z-50 transform transition-transform duration-300 ease-in-out motion-reduce:transition-none md:hidden ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-4">
          <div className="flex items-center justify-between mb-6">
            <Link
              href="/"
              className="flex items-center gap-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 rounded-lg"
              onClick={() => setMobileMenuOpen(false)}
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-cyan-500 flex items-center justify-center shadow-sm" aria-hidden="true">
                <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 12h4l3-9 4 18 3-9h4" />
                </svg>
              </div>
              <span className="font-semibold text-lg tracking-tight whitespace-nowrap">pNode Pulse</span>
            </Link>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="p-2 hover:bg-muted rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              aria-label="Close menu"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <nav className="flex flex-col gap-1" aria-label="Mobile navigation">
            {navigation.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  aria-current={isActive ? "page" : undefined}
                  className={`px-4 py-3 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                    isActive
                      ? "bg-brand-500/10 text-brand-600 dark:text-brand-400"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  {item.name}
                </Link>
              );
            })}
          </nav>

          <div className="mt-6 pt-6 border-t border-border space-y-4">
            <div className="flex items-center justify-between px-4 py-2">
              <span className="text-sm text-muted-foreground">Status</span>
              <RealtimeIndicator />
            </div>
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                setShowExport(true);
              }}
              className="flex items-center gap-3 w-full px-4 py-3 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export Data
            </button>
            <div className="px-4">
              <ConnectWallet />
            </div>
          </div>
        </div>
      </div>

      <header role="banner" className="border-b border-border sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-30">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Mobile menu button + Logo */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="p-2 hover:bg-muted rounded-lg md:hidden focus:outline-none focus:ring-2 focus:ring-brand-500"
                aria-label="Open navigation menu"
                aria-expanded={mobileMenuOpen}
                aria-controls="mobile-menu"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>

              <Link href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 rounded-lg" aria-label="pNode Pulse - Home">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-cyan-500 flex items-center justify-center shadow-sm" aria-hidden="true">
                  <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 12h4l3-9 4 18 3-9h4" />
                  </svg>
                </div>
                <span className="font-semibold text-lg tracking-tight hidden sm:inline whitespace-nowrap">pNode Pulse</span>
              </Link>

              {/* Desktop nav */}
              <nav className="hidden lg:flex items-center gap-1 ml-6" aria-label="Main navigation">
                {navigation.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      aria-current={isActive ? "page" : undefined}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                        isActive
                          ? "bg-brand-500/10 text-brand-600 dark:text-brand-400"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      }`}
                    >
                      {item.name}
                    </Link>
                  );
                })}
              </nav>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 sm:gap-2" role="group" aria-label="Quick actions">
              <button
                onClick={() => setShowExport(true)}
                className="p-2 hover:bg-muted rounded-lg transition-colors hidden sm:block focus:outline-none focus:ring-2 focus:ring-brand-500"
                aria-label="Export data"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </button>
              <FavoritesDropdown />
              <RealtimeIndicator />
              <LanguageSelector showLabel={false} />
              <ThemeToggle />
              <div className="hidden lg:block border-l border-border pl-2 ml-1">
                <ConnectWallet />
              </div>
            </div>
          </div>
        </div>
      </header>
    </>
  );
}

