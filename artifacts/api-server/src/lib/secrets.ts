import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

/**
 * Симметричное шифрование чувствительных полей, которые обязаны лежать в БД
 * в читаемом виде только для самого сервера — сейчас это `operators.api_credentials`.
 *
 * Формат хранения: `v1:<iv>:<tag>:<ciphertext>`, все части в base64.
 * Префикс версии нужен, чтобы позже сменить алгоритм и уметь читать старые записи.
 *
 * Ключ берётся из CREDENTIALS_ENCRYPTION_KEY — 32 байта в base64.
 * Сгенерировать:
 *   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // рекомендованный размер nonce для GCM
const PREFIX = "v1";

function key(): Buffer {
  const raw = process.env["CREDENTIALS_ENCRYPTION_KEY"];
  if (!raw) {
    throw new Error(
      "CREDENTIALS_ENCRYPTION_KEY is not set — cannot encrypt or decrypt credentials",
    );
  }
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) {
    throw new Error(
      `CREDENTIALS_ENCRYPTION_KEY must decode to 32 bytes, got ${buf.length}`,
    );
  }
  return buf;
}

/** Зашифрованное значение легко отличить от старого plaintext по префиксу. */
export function isEncrypted(value: string): boolean {
  return value.startsWith(`${PREFIX}:`);
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    PREFIX,
    iv.toString("base64"),
    tag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(":");
}

/**
 * Возвращает расшифрованное значение.
 * Строки без префикса версии считаются оставшимися от прежней plaintext-схемы
 * и возвращаются как есть — иначе после миграции сломались бы уже сохранённые
 * записи. При перезаписи такое поле шифруется.
 */
export function decryptSecret(stored: string): string {
  if (!isEncrypted(stored)) return stored;

  const [, ivB64, tagB64, dataB64] = stored.split(":");
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new Error("Malformed encrypted value");
  }

  const decipher = createDecipheriv(
    ALGORITHM,
    key(),
    Buffer.from(ivB64, "base64"),
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));

  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
