import { Auth } from "googleapis";
import crypto from "node:crypto";

import { loadSettings } from "@/lib/settings";
import { SecretStore } from "@/lib/security/secret";
import { StorageService } from "@/lib/storage-service";

type OAuth2Client = InstanceType<typeof Auth.OAuth2Client>;

const SCOPES = ["https://www.googleapis.com/auth/gmail.readonly", "https://www.googleapis.com/auth/gmail.modify"];

/**
 * Resolve the Gmail OAuth2 client from settings. Returns null when Gmail is
 * not configured.
 */
export async function getOAuthClient(): Promise<OAuth2Client | null> {
  const settings = await loadSettings();
  const g = settings.gmail;
  if (!g.clientId) return null;

  let clientSecret = "";
  const storage = StorageService.getInstance();
  const enc = await storage.getSetting("app.gmail.clientSecretEnc");
  if (enc) {
    try {
      clientSecret = SecretStore.getInstance().decrypt(enc);
    } catch {
      clientSecret = "";
    }
  }
  if (!clientSecret) return null;

  return new Auth.OAuth2Client({
    clientId: g.clientId,
    clientSecret,
    redirectUri: g.redirectUri,
  });
}

/** Build the Google consent URL for the user to authorize Gmail access. */
export async function buildAuthUrl(state?: string): Promise<string | null> {
  const client = await getOAuthClient();
  if (!client) return null;
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
    state: state ?? crypto.randomBytes(8).toString("hex"),
  });
}

/** Exchange an authorization code for tokens and persist the refresh token. */
export async function exchangeCode(code: string): Promise<string> {
  const client = await getOAuthClient();
  if (!client) throw new Error("Gmail is not configured.");
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);
  const refreshToken = tokens.refresh_token;
  if (!refreshToken) {
    throw new Error("No refresh token returned. Re-authorize with consent.");
  }
  const storage = StorageService.getInstance();
  await storage.setOAuthState({ refreshToken });
  return refreshToken;
}

/** Load the stored (already-encrypted) refresh token. */
export async function getRefreshToken(): Promise<string | null> {
  const storage = StorageService.getInstance();
  const state = await storage.getOAuthState();
  return state?.refreshToken ?? null;
}

export { SCOPES };
