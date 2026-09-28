import * as SecureStore from "expo-secure-store";

/**
 * The ONLY place tokens are read from or written to. Uses the platform's
 * secure credentials manager (iOS Keychain / Android Keystore via
 * expo-secure-store) — never AsyncStorage, never plain component state
 * that could end up in a crash report or dev-tools inspector, never
 * console.log (see docs/security.md: "Mobile: Authorization Code + PKCE,
 * tokens stored via the platform's secure credentials manager").
 */

const ACCESS_TOKEN_KEY = "uptet.auth.accessToken";
const REFRESH_TOKEN_KEY = "uptet.auth.refreshToken";

export interface StoredTokens {
  accessToken: string;
  refreshToken: string | null;
  /** Epoch milliseconds. */
  expiresAt: number;
}

export async function saveTokens(tokens: StoredTokens): Promise<void> {
  await SecureStore.setItemAsync(
    ACCESS_TOKEN_KEY,
    JSON.stringify({ accessToken: tokens.accessToken, expiresAt: tokens.expiresAt }),
  );
  if (tokens.refreshToken) {
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokens.refreshToken);
  }
}

export async function loadAccessToken(): Promise<
  { accessToken: string; expiresAt: number } | null
> {
  const raw = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  if (!raw) return null;
  return JSON.parse(raw);
}

export async function loadRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export async function clearTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}
