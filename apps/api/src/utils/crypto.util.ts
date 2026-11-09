import crypto from "crypto";
import { env } from "../config/env";

// Ensure a 32-byte key using sha256 of the configured secret
const getEncryptionKey = (): Buffer => {
  const secretKey =
    env.CREDENTIAL_ENCRYPTION_KEY ||
    env.TOKEN_ENCRYPTION_KEY ||
    env.ENCRYPTION_KEY;
  return crypto.createHash("sha256").update(secretKey).digest();
};

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Format: iv:authTag:ciphertext (all in hex)
 */
export function encryptCredential(plainText: string): string {
  if (!plainText) return "";
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  
  let encrypted = cipher.update(plainText, "utf8", "hex");
  encrypted += cipher.final("hex");
  
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

/**
 * Decrypts an AES-256-GCM encrypted string.
 * Expects format: iv:authTag:ciphertext (all in hex)
 */
export function decryptCredential(encryptedData: string): string {
  if (!encryptedData) return "";
  const parts = encryptedData.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted data format. Expected iv:authTag:ciphertext.");
  }

  const [ivHex, authTagHex, cipherTextHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-gcm", getEncryptionKey(), iv);
  
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(cipherTextHex, "hex", "utf8");
  decrypted += decipher.final("utf8");
  
  return decrypted;
}

/**
 * Helper to mask sensitive strings like App Passwords (e.g., "abcd **** **** wxyz")
 */
export function maskSecret(secret: string): string {
  if (!secret || secret.length < 8) return "••••••••••••••••";
  const visibleStart = secret.slice(0, 4);
  const visibleEnd = secret.slice(-4);
  return `${visibleStart} •••• •••• ${visibleEnd}`;
}

