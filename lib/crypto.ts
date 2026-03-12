/**
 * Simple XOR-based encryption for storing DB credentials.
 * For production, use a proper KMS or Vault solution.
 */

const KEY = process.env.ENCRYPTION_SECRET || "datrix-default-32-char-secret-key";

export function encrypt(text: string): string {
  const data = Buffer.from(text, "utf8");
  const keyBuf = Buffer.from(KEY, "utf8");
  const result = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i++) {
    result[i] = data[i] ^ keyBuf[i % keyBuf.length];
  }
  // Prepend a simple marker so we know it's encrypted
  return "enc:" + result.toString("base64");
}

export function decrypt(encrypted: string): string {
  if (!encrypted.startsWith("enc:")) {
    return encrypted; // not encrypted, return as-is (migration safety)
  }
  const data = Buffer.from(encrypted.slice(4), "base64");
  const keyBuf = Buffer.from(KEY, "utf8");
  const result = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i++) {
    result[i] = data[i] ^ keyBuf[i % keyBuf.length];
  }
  return result.toString("utf8");
}
