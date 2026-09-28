import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { authConfig } from "./authConfig";
import { clearTokens, loadAccessToken, loadRefreshToken, saveTokens } from "../storage/secureTokenStore";

WebBrowser.maybeCompleteAuthSession();

/**
 * Authorization Code + PKCE against Auth0, via expo-auth-session (which
 * generates the code verifier/challenge and handles the redirect for us)
 * — see docs/security.md: "Mobile: Authorization Code + PKCE, tokens
 * stored via the platform's secure credentials manager". Every function
 * here writes through secureTokenStore.ts; nothing else in the mobile
 * app is allowed to touch a token directly.
 */

function discoveryDocument(): AuthSession.DiscoveryDocument {
  return {
    authorizationEndpoint: `https://${authConfig.domain}/authorize`,
    tokenEndpoint: `https://${authConfig.domain}/oauth/token`,
    revocationEndpoint: `https://${authConfig.domain}/oauth/revoke`,
  };
}

const redirectUri = AuthSession.makeRedirectUri({ scheme: authConfig.scheme });

export async function signIn(): Promise<void> {
  const request = new AuthSession.AuthRequest({
    clientId: authConfig.clientId,
    scopes: ["openid", "profile", "offline_access"],
    redirectUri,
    responseType: AuthSession.ResponseType.Code,
    extraParams: { audience: authConfig.audience },
    usePKCE: true,
  });

  const discovery = discoveryDocument();
  const result = await request.promptAsync(discovery);
  if (result.type !== "success" || !request.codeVerifier) {
    throw new Error(`Sign-in was not completed (${result.type}).`);
  }

  const tokenResponse = await AuthSession.exchangeCodeAsync(
    {
      clientId: authConfig.clientId,
      code: result.params.code,
      redirectUri,
      extraParams: { code_verifier: request.codeVerifier },
    },
    discovery,
  );

  await saveTokens({
    accessToken: tokenResponse.accessToken,
    refreshToken: tokenResponse.refreshToken ?? null,
    expiresAt: Date.now() + (tokenResponse.expiresIn ?? 3600) * 1000,
  });
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = await loadRefreshToken();
  if (!refreshToken) return null;

  try {
    const tokenResponse = await AuthSession.refreshAsync(
      { clientId: authConfig.clientId, refreshToken },
      discoveryDocument(),
    );
    await saveTokens({
      accessToken: tokenResponse.accessToken,
      refreshToken: tokenResponse.refreshToken ?? refreshToken,
      expiresAt: Date.now() + (tokenResponse.expiresIn ?? 3600) * 1000,
    });
    return tokenResponse.accessToken;
  } catch {
    // Refresh token is invalid/revoked — caller should treat this as
    // signed-out and prompt signIn() again, not silently retry forever.
    await clearTokens();
    return null;
  }
}

/**
 * Returns a currently-valid access token, refreshing it first if it's
 * expired (or close to it). Returns null if the user isn't signed in —
 * callers must treat that as "show the sign-in screen", never as "send
 * the request anyway without a token".
 */
export async function getValidAccessToken(): Promise<string | null> {
  const stored = await loadAccessToken();
  if (!stored) return null;

  const EXPIRY_SAFETY_MARGIN_MS = 60_000;
  if (Date.now() < stored.expiresAt - EXPIRY_SAFETY_MARGIN_MS) {
    return stored.accessToken;
  }
  return refreshAccessToken();
}

export async function signOut(): Promise<void> {
  await clearTokens();
}
