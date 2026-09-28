/**
 * Public, non-secret Auth0 app config — safe to bundle into the client.
 * The actual client secret is never used here: PKCE is specifically the
 * OAuth flow designed for public clients (mobile/SPA) that cannot keep a
 * secret. Set these via EXPO_PUBLIC_* env vars, which — same rule as
 * NEXT_PUBLIC_* on the web side (docs/security.md) — are bundled into the
 * client and must never hold anything actually secret.
 */
export const authConfig = {
  domain: process.env.EXPO_PUBLIC_AUTH0_DOMAIN ?? "",
  clientId: process.env.EXPO_PUBLIC_AUTH0_CLIENT_ID ?? "",
  audience: process.env.EXPO_PUBLIC_AUTH0_AUDIENCE ?? "",
  scheme: "uptetprep",
};
