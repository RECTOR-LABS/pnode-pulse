"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { FavoritesDropdown } from "@/components/ui/favorites-dropdown";
import { ExportDialog } from "@/components/export";
import { ConnectWallet } from "@/components/auth";

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

  return (
    <>
      <ExportDialog isOpen={showExport} onClose={() => setShowExport(false)} />
    <header className="border-b border-border sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-50">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Logo and nav */}
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <div className="w-8 h-8 rounded-lg bg-brand-500 flex items-center justify-center">
                <span className="text-white font-bold text-sm">P</span>
              </div>
              <span className="font-semibold text-lg">pNode Pulse</span>
            </Link>

            <nav className="hidden md:flex items-center gap-1">
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
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowExport(true)}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
              title="Export Data"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </button>
            <FavoritesDropdown />
            <LiveIndicator />
            <ThemeToggle />
            <div className="hidden md:block border-l border-border pl-2 ml-1">
              <ConnectWallet />
            </div>
          </div>
        </div>
      </div>
    </header>
    </>
  );
}

function LiveIndicator() {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-status-active opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-status-active" />
      </span>
      <span className="text-muted-foreground hidden sm:inline">Live</span>
    </div>
  );
}
