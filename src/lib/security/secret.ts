import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Encrypts app secrets (e.g. the Gmail OAuth client secret / refresh token)
 * at rest in the database. Uses AES-256-GCM keyed by GMAIL_ENCRYPTION_KEY.
 *
 * The encryption key itself stays in the environment (or Docker secrets),
 * never in the DB.
 */
export class SecretStore {
  private static _instance: SecretStore | null = null;

  private key?: Buffer;

  private constructor() {
    // Read the key from the environment directly so it reflects runtime env.
    const raw = process.env.GMAIL_ENCRYPTION_KEY || "";
    if (raw && raw.length >= 16) {
      this.key = Buffer.from(raw.slice(0, 32).padEnd(32, "0"));
    }
  }

  static getInstance(): SecretStore {
    if (!SecretStore._instance) {
      SecretStore._instance = new SecretStore();
    }
    return SecretStore._instance;
  }

  static isConfigured(): boolean {
    return SecretStore.getInstance().key !== undefined;
  }

  encrypt(plaintext: string): string {
    if (!this.key) {
      throw new Error(
        "GMAIL_ENCRYPTION_KEY is not configured. Cannot store secrets.",
      );
    }
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    const enc = Buffer.concat([
      cipher.update(plaintext, "utf8"),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return `enc:v1:${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
  }

  decrypt(payload: string): string {
    if (!payload.startsWith("enc:v1:")) return payload;
    const [, , ivB64, tagB64, dataB64] = payload.split(":");
    if (!this.key || !ivB64 || !tagB64 || !dataB64) {
      throw new Error("Cannot decrypt secret (missing key or malformed value).");
    }
    const decipher = createDecipheriv(
      "aes-256-gcm",
      this.key,
      Buffer.from(ivB64, "base64"),
    );
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    const dec = Buffer.concat([
      decipher.update(Buffer.from(dataB64, "base64")),
      decipher.final(),
    ]);
    return dec.toString("utf8");
  }
}
