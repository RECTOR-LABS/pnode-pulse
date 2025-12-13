"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { useFocusTrap } from "@/lib/hooks/use-focus-trap";
import { FavoritesDropdown } from "@/components/ui/favorites-dropdown";
import { ExportDialog } from "@/components/export";
import { ConnectWallet } from "@/components/auth";
import { RealtimeIndicator } from "@/components/ui/realtime-indicator";
import { LanguageSelector } from "@/components/ui/language-selector";

// Primary navigation - always visible
const primaryNav = [
  { name: "Overview", href: "/" },
  { name: "Nodes", href: "/nodes" },
  { name: "Analytics", href: "/analytics" },
  { name: "Map", href: "/map" },
];

// Secondary navigation - in "More" dropdown
const secondaryNav = [
  { name: "Leaderboard", href: "/leaderboard" },
  { name: "Graveyard", href: "/graveyard" },
  { name: "Portfolio", href: "/portfolio" },
  { name: "Alerts", href: "/alerts" },
  { name: "Reports", href: "/reports" },
];

const allNavigation = [...primaryNav, ...secondaryNav];

export function Header() {
  const pathname = usePathname();
  const [showExport, setShowExport] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const mobileMenuRef = useFocusTrap(mobileMenuOpen);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // Handle Escape key to close menus
  const handleEscape = useCallback((event: KeyboardEvent) => {
    if (event.key === "Escape") {
      if (mobileMenuOpen) setMobileMenuOpen(false);
      if (moreMenuOpen) setMoreMenuOpen(false);
    }
  }, [mobileMenuOpen, moreMenuOpen]);

  // Close more menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setMoreMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [handleEscape]);

  // Check if current path is in secondary nav
  const isSecondaryActive = secondaryNav.some(item => pathname === item.href || pathname.startsWith(item.href + "/"));

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
          className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm"
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
              className="flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 rounded-lg"
              onClick={() => setMobileMenuOpen(false)}
            >
              <div className="w-7 h-7 rounded-md bg-gradient-to-br from-brand-500 to-brand-400 flex items-center justify-center" aria-hidden="true">
                <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 12h4l3-9 4 18 3-9h4" />
                </svg>
              </div>
              <span className="font-semibold text-base tracking-tight">pNode Pulse</span>
            </Link>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="p-1.5 hover:bg-muted rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500"
              aria-label="Close menu"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <nav className="flex flex-col gap-0.5" aria-label="Mobile navigation">
            {allNavigation.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  aria-current={isActive ? "page" : undefined}
                  className={`px-3 py-2.5 rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                    isActive
                      ? "bg-brand-500/15 text-brand-400"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  {item.name}
                </Link>
              );
            })}
          </nav>

          <div className="mt-4 pt-4 border-t border-border space-y-2">
            <div className="flex items-center justify-between px-3 py-2">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Status</span>
              <RealtimeIndicator />
            </div>
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                setShowExport(true);
              }}
              className="flex items-center gap-2 w-full px-3 py-2.5 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export Data
            </button>
            <div className="px-3 pt-2">
              <ConnectWallet />
            </div>
          </div>
        </div>
      </div>

      {/* Gradient accent bar */}
      <div className="h-0.5 bg-gradient-to-r from-brand-500 via-brand-400 to-accent-500" aria-hidden="true" />

      <header role="banner" className="border-b border-border sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 z-30">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-12">
            {/* Mobile menu button + Logo */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="p-1.5 hover:bg-muted rounded-md focus:outline-none focus:ring-2 focus:ring-brand-500 md:hidden"
                aria-label="Open navigation menu"
                aria-expanded={mobileMenuOpen}
                aria-controls="mobile-menu"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>

              <Link href="/" className="flex items-center gap-2 hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 rounded-md" aria-label="pNode Pulse - Home">
                <div className="w-7 h-7 rounded-md bg-gradient-to-br from-brand-500 to-brand-400 flex items-center justify-center" aria-hidden="true">
                  <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 12h4l3-9 4 18 3-9h4" />
                  </svg>
                </div>
                <span className="font-semibold text-sm tracking-tight hidden sm:inline">pNode Pulse</span>
              </Link>

              {/* Desktop nav */}
              <nav className="flex items-center ml-6" style={{ gap: "4px" }} aria-label="Main navigation">
                {primaryNav.map((item) => {
                  const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      aria-current={isActive ? "page" : undefined}
                      style={{ padding: "6px 12px" }}
                      className={`rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                        isActive
                          ? "bg-brand-500/15 text-brand-400"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      }`}
                    >
                      {item.name}
                    </Link>
                  );
                })}

                {/* More dropdown */}
                <div className="relative" ref={moreMenuRef}>
                  <button
                    onClick={() => setMoreMenuOpen(!moreMenuOpen)}
                    aria-expanded={moreMenuOpen}
                    style={{ padding: "6px 12px" }}
                    className={`rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 flex items-center gap-1 ${
                      isSecondaryActive
                        ? "bg-brand-500/15 text-brand-400"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    More
                    <svg className={`w-3.5 h-3.5 transition-transform ${moreMenuOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {moreMenuOpen && (
                    <div className="absolute top-full left-0 mt-1 w-40 bg-card border border-border rounded-lg shadow-lg py-1 z-50">
                      {secondaryNav.map((item) => {
                        const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
                        return (
                          <Link
                            key={item.name}
                            href={item.href}
                            onClick={() => setMoreMenuOpen(false)}
                            className={`block px-3 py-2 text-sm transition-colors ${
                              isActive
                                ? "bg-brand-500/15 text-brand-400"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted"
                            }`}
                          >
                            {item.name}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              </nav>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1" role="group" aria-label="Quick actions">
              <RealtimeIndicator />
              <button
                onClick={() => setShowExport(true)}
                className="p-1.5 hover:bg-muted rounded-md transition-colors hidden sm:flex focus:outline-none focus:ring-2 focus:ring-brand-500"
                aria-label="Export data"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </button>
              <FavoritesDropdown />
              <LanguageSelector showLabel={false} />
              <div className="hidden md:flex items-center border-l border-border pl-2 ml-1">
                <ConnectWallet />
              </div>
            </div>
          </div>
        </div>
      </header>
    </>
  );
}
