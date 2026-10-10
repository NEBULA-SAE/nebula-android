// ═══════════════════════════════════════════════════════════════
// NEBULA v2 · CRYPTO
// AES-256-GCM + PBKDF2 через Web Crypto API
// Заменяет python/crypto.py
// ═══════════════════════════════════════════════════════════════

const MAGIC = 'NBLA2:';
const PBKDF2_ITERATIONS = 150_000;
const SALT_LEN = 16;
const IV_LEN = 12;
const KEY_LEN = 256;

// ─── Base64 ↔ Uint8Array ───

function bufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function base64ToBuffer(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

// ─── Ключ из пароля ───

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  // TS строгий к BufferSource из-за SharedArrayBuffer — приводим явно
  const saltBuf: ArrayBuffer = salt.buffer.slice(
    salt.byteOffset,
    salt.byteOffset + salt.byteLength
  ) as ArrayBuffer;
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBuf,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: KEY_LEN },
    false,
    ['encrypt', 'decrypt']
  );
}

// ─── Публичное API ───

/** Проверить, что строка — наш зашифрованный блоб */
export function isEncryptedToken(token: string): boolean {
  if (typeof token !== 'string') return false;
  return token.trim().startsWith(MAGIC);
}

/** Зашифровать объект → base64-строка */
export async function encryptJson(data: any, password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LEN));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LEN));
  const key = await deriveKey(password, salt);
  const plaintext = new TextEncoder().encode(JSON.stringify(data));
  const ivBuf: ArrayBuffer = iv.buffer.slice(iv.byteOffset, iv.byteOffset + iv.byteLength) as ArrayBuffer;
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: ivBuf },
    key,
    plaintext
  );

  // Blob: MAGIC + salt(16) + iv(12) + ciphertext
  const ctBytes = new Uint8Array(ciphertext);
  const blob = new Uint8Array(MAGIC.length + SALT_LEN + IV_LEN + ctBytes.length);
  let offset = 0;
  for (let i = 0; i < MAGIC.length; i++) blob[offset++] = MAGIC.charCodeAt(i);
  blob.set(salt, offset); offset += SALT_LEN;
  blob.set(iv, offset); offset += IV_LEN;
  blob.set(ctBytes, offset);

  return bufferToBase64(blob.buffer);
}

/** Расшифровать base64-блоб → объект. Бросает при неверном пароле */
export async function decryptJson(token: string, password: string): Promise<any> {
  const trimmed = token.trim();
  if (!trimmed.startsWith(MAGIC)) {
    throw new Error('not an encrypted file');
  }
  const buf = base64ToBuffer(trimmed);
  const bytes = new Uint8Array(buf);

  // Пропускаем MAGIC
  let offset = MAGIC.length;
  const salt = bytes.slice(offset, offset + SALT_LEN); offset += SALT_LEN;
  const iv = bytes.slice(offset, offset + IV_LEN); offset += IV_LEN;
  const ciphertext = bytes.slice(offset);

  const key = await deriveKey(password, salt);
  let plaintext: ArrayBuffer;
  try {
        const ivBuf: ArrayBuffer = iv.buffer.slice(iv.byteOffset, iv.byteOffset + iv.byteLength) as ArrayBuffer;
    const ctBuf: ArrayBuffer = ciphertext.buffer.slice(ciphertext.byteOffset, ciphertext.byteOffset + ciphertext.byteLength) as ArrayBuffer;
    plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: ivBuf },
      key,
      ctBuf
    );
  } catch (e) {
    throw new Error('wrong password');
  }
  const text = new TextDecoder().decode(plaintext);
  return JSON.parse(text);
}

/** HMAC-SHA256 в hex (для MEXC API) */
export async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  const bytes = new Uint8Array(sig);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}