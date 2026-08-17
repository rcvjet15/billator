import { google, type gmail_v1 } from "googleapis";

import { getOAuthClient, getRefreshToken } from "@/lib/gmail/oauth";

/** Authenticated Gmail client type. */
export type GmailClient = gmail_v1.Gmail;

/**
 * Build an authenticated Gmail API client using the stored refresh token.
 * Returns null when Gmail isn't configured or not authorized yet.
 */
export async function getGmailClient(): Promise<GmailClient | null> {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) return null;

  const oauth = await getOAuthClient();
  if (!oauth) return null;

  oauth.setCredentials({ refresh_token: refreshToken });
  return google.gmail({ version: "v1", auth: oauth });
}

