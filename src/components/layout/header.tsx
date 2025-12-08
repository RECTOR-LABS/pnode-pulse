"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { FavoritesDropdown } from "@/components/ui/favorites-dropdown";
import { ExportDialog } from "@/components/export";
import { ConnectWallet } from "@/components/auth";
import { RealtimeIndicator } from "@/components/ui/realtime-indicator";

const navigation = [
  { name: "Overview", href: "/" },
  { name: "Nodes", href: "/nodes" },
  { name: "Analytics", href: "/analytics" },
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

  return (
    <>
      <ExportDialog isOpen={showExport} onClose={() => setShowExport(false)} />

      {/* Mobile menu overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile menu drawer */}
      <div
        className={`fixed top-0 left-0 h-full w-72 bg-background border-r border-border z-50 transform transition-transform duration-300 ease-in-out md:hidden ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-4">
          <div className="flex items-center justify-between mb-6">
            <Link
              href="/"
              className="flex items-center gap-2"
              onClick={() => setMobileMenuOpen(false)}
            >
              <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center">
                <span className="text-white font-bold text-sm">P</span>
              </div>
              <span className="font-semibold text-lg">pNode Pulse</span>
            </Link>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="p-2 hover:bg-muted rounded-lg"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <nav className="flex flex-col gap-1">
            {navigation.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
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

      <header className="border-b border-border sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-30">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Mobile menu button + Logo */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="p-2 hover:bg-muted rounded-lg md:hidden"
                aria-label="Open menu"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>

              <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center">
                  <span className="text-white font-bold text-sm">P</span>
                </div>
                <span className="font-semibold text-lg hidden sm:inline">pNode Pulse</span>
              </Link>

              {/* Desktop nav */}
              <nav className="hidden lg:flex items-center gap-1 ml-6">
                {navigation.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
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
            <div className="flex items-center gap-1 sm:gap-2">
              <button
                onClick={() => setShowExport(true)}
                className="p-2 hover:bg-muted rounded-lg transition-colors hidden sm:block"
                title="Export Data"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </button>
              <FavoritesDropdown />
              <RealtimeIndicator />
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

