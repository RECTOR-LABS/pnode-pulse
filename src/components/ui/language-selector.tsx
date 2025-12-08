"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter, usePathname } from "next/navigation";
import { useTransition, useState, useRef, useEffect } from "react";
import { locales, localeNames, localeFlags, type Locale } from "@/i18n/config";

interface LanguageSelectorProps {
  variant?: "dropdown" | "inline";
  showFlag?: boolean;
  showLabel?: boolean;
}

export function LanguageSelector({
  variant = "dropdown",
  showFlag = true,
  showLabel = true,
}: LanguageSelectorProps) {
  const t = useTranslations("settings");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close dropdown on escape key
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, []);

  const handleLocaleChange = (newLocale: Locale) => {
    setIsOpen(false);
    startTransition(() => {
      // Replace the locale segment in the pathname
      const segments = pathname.split("/");
      segments[1] = newLocale;
      router.replace(segments.join("/"));
    });
  };

  if (variant === "inline") {
    return (
      <div className="flex flex-wrap gap-2">
        {locales.map((loc) => (
          <button
            key={loc}
            onClick={() => handleLocaleChange(loc)}
            disabled={isPending || locale === loc}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              locale === loc
                ? "bg-primary text-primary-foreground"
                : "bg-muted hover:bg-muted/80"
            } disabled:opacity-50`}
            aria-current={locale === loc ? "true" : undefined}
          >
            {showFlag && <span className="mr-1">{localeFlags[loc]}</span>}
            {localeNames[loc]}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 text-sm bg-muted rounded-md hover:bg-muted/80 transition-colors"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={t("selectLanguage")}
      >
        {showFlag && <span>{localeFlags[locale]}</span>}
        {showLabel && <span className="hidden sm:inline">{localeNames[locale]}</span>}
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div
          className="absolute right-0 mt-2 w-40 py-1 bg-card border border-border rounded-md shadow-lg z-50"
          role="listbox"
          aria-label={t("selectLanguage")}
        >
          {locales.map((loc) => (
            <button
              key={loc}
              onClick={() => handleLocaleChange(loc)}
              disabled={isPending}
              className={`w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-muted transition-colors ${
                locale === loc ? "bg-muted font-medium" : ""
              } disabled:opacity-50`}
              role="option"
              aria-selected={locale === loc}
            >
              {showFlag && <span>{localeFlags[loc]}</span>}
              <span>{localeNames[loc]}</span>
              {locale === loc && (
                <svg className="w-4 h-4 ml-auto" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}

      {isPending && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-md">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
