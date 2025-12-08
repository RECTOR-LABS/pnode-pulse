/**
 * Session Management
 *
 * Provides anonymous session IDs for users who haven't authenticated.
 * Sessions are stored in localStorage and used to associate:
 * - Alert rules
 * - Notification channels
 * - User preferences
 *
 * When a user authenticates (Phase 3.5), their session data
 * is migrated to their user account.
 */

const SESSION_KEY = "pnode-pulse-session";
const SESSION_EXPIRY_DAYS = 30;

export interface SessionData {
  id: string;
  createdAt: number;
  lastActiveAt: number;
}

/**
 * Generate a unique session ID
 */
function generateSessionId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 15);
  return `sess_${timestamp}_${randomPart}`;
}

/**
 * Get session data from localStorage (client-side only)
 */
export function getSessionData(): SessionData | null {
  if (typeof window === "undefined") return null;

  try {
    const stored = localStorage.getItem(SESSION_KEY);
    if (!stored) return null;

    const session = JSON.parse(stored) as SessionData;

    // Check if session is expired (30 days of inactivity)
    const expiryMs = SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000;
    if (Date.now() - session.lastActiveAt > expiryMs) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

/**
 * Get or create a session ID
 */
export function getSessionId(): string {
  if (typeof window === "undefined") {
    // Server-side: return empty string (will be populated on client)
    return "";
  }

  let session = getSessionData();

  if (!session) {
    session = {
      id: generateSessionId(),
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } else {
    // Update last active time
    session.lastActiveAt = Date.now();
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  }

  return session.id;
}

/**
 * Clear the session (used when user logs in with wallet)
 */
export function clearSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(SESSION_KEY);
}

/**
 * Check if we have an active session
 */
export function hasSession(): boolean {
  return getSessionData() !== null;
}

/**
 * React hook for session ID (to be used in components)
 * This is a simple getter - for reactive updates, wrap in useState/useEffect
 */
export function useSessionId(): string {
  if (typeof window === "undefined") return "";
  return getSessionId();
}
