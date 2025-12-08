"use client";

import { useState, useCallback, useMemo } from "react";
import {
  type RegionalPreferences,
  type StorageUnit,
  getRegionalPreferences,
  saveRegionalPreferences,
  formatNumber,
  formatCompactNumber,
  formatPercent,
  formatCurrency,
  formatStorage,
  formatStorageCompact,
  formatOrdinal,
  formatList,
  formatRange,
  getFirstDayOfWeek,
  getNumberSeparators,
} from "@/lib/utils/regional";

/**
 * Hook for managing regional preferences and formatting
 *
 * Provides reactive access to regional settings and formatting functions
 * that automatically use the user's preferences.
 */
export function useRegional() {
  // Initialize from localStorage using lazy initializer
  const [preferences, setPreferences] = useState<RegionalPreferences>(
    getRegionalPreferences
  );

  // Update preferences
  const updatePreferences = useCallback(
    (updates: Partial<RegionalPreferences>) => {
      setPreferences((prev) => {
        const updated = { ...prev, ...updates };
        saveRegionalPreferences(updated);
        return updated;
      });
    },
    []
  );

  // Set locale
  const setLocale = useCallback(
    (locale: string) => updatePreferences({ locale }),
    [updatePreferences]
  );

  // Set storage unit preference
  const setStorageUnit = useCallback(
    (unit: StorageUnit) => updatePreferences({ storageUnit: unit }),
    [updatePreferences]
  );

  // Set compact numbers preference
  const setCompactNumbers = useCallback(
    (enabled: boolean) => updatePreferences({ compactNumbers: enabled }),
    [updatePreferences]
  );

  // Set first day of week
  const setFirstDayOfWeek = useCallback(
    (day: 0 | 1 | 6) => updatePreferences({ firstDayOfWeek: day }),
    [updatePreferences]
  );

  // Set currency
  const setCurrency = useCallback(
    (currency: string) => updatePreferences({ currency }),
    [updatePreferences]
  );

  // Memoized formatting functions that use current preferences
  const formatters = useMemo(
    () => ({
      number: (value: number, options?: Parameters<typeof formatNumber>[1]) =>
        formatNumber(value, { locale: preferences.locale, ...options }),

      compact: (value: number, options?: Parameters<typeof formatCompactNumber>[1]) =>
        formatCompactNumber(value, { locale: preferences.locale, ...options }),

      percent: (value: number, options?: Parameters<typeof formatPercent>[1]) =>
        formatPercent(value, { locale: preferences.locale, ...options }),

      currency: (value: number, options?: Parameters<typeof formatCurrency>[1]) =>
        formatCurrency(value, {
          locale: preferences.locale,
          currency: preferences.currency,
          ...options,
        }),

      storage: (bytes: number, options?: Parameters<typeof formatStorage>[1]) =>
        formatStorage(bytes, {
          locale: preferences.locale,
          unit: preferences.storageUnit,
          ...options,
        }),

      storageCompact: (bytes: number, options?: Parameters<typeof formatStorageCompact>[1]) =>
        formatStorageCompact(bytes, {
          locale: preferences.locale,
          unit: preferences.storageUnit,
          ...options,
        }),

      ordinal: (value: number) => formatOrdinal(value, preferences.locale),

      list: (items: string[], options?: Parameters<typeof formatList>[1]) =>
        formatList(items, { locale: preferences.locale, ...options }),

      range: (start: number, end: number) =>
        formatRange(start, end, { locale: preferences.locale }),
    }),
    [preferences.locale, preferences.storageUnit, preferences.currency]
  );

  // Get separators for current locale
  const separators = useMemo(
    () => getNumberSeparators(preferences.locale),
    [preferences.locale]
  );

  // Get first day of week
  const firstDayOfWeek = useMemo(
    () => getFirstDayOfWeek(preferences.locale),
    [preferences.locale]
  );

  return {
    // Current preferences
    preferences,
    locale: preferences.locale,
    storageUnit: preferences.storageUnit,
    compactNumbers: preferences.compactNumbers,
    currencyCode: preferences.currency,

    // Setters
    updatePreferences,
    setLocale,
    setStorageUnit,
    setCompactNumbers,
    setFirstDayOfWeek,
    setCurrency,

    // Formatting functions (number, compact, percent, currency, storage, etc.)
    ...formatters,

    // Utilities
    separators,
    firstDayOfWeek,
  };
}

/**
 * Simple hook to just get formatting functions without state management
 * Useful for components that don't need to modify preferences
 */
export function useFormatters() {
  const { number, compact, percent, currency, storage, storageCompact, ordinal, list, range } =
    useRegional();

  return {
    number,
    compact,
    percent,
    currency,
    storage,
    storageCompact,
    ordinal,
    list,
    range,
  };
}
