// ═══════════════════════════════════════════════════════════════
// NEBULA v2 · CRYPTO
// AES-256-GCM + PBKDF2 через Web Crypto API + Ключи Groq
// ═══════════════════════════════════════════════════════════════

import { getAuthPassword } from './auth';

const MAGIC = 'NBLA2:';
const PBKDF2_ITERATIONS = 150_000;
const SALT_LEN = 16;
const IV_LEN = 12;
const KEY_LEN = 256;
const GROQ_STORAGE = 'nebulaGroqKey';

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

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  const saltBuf: ArrayBuffer = salt.buffer.slice(salt.byteOffset, salt.byteOffset + salt.byteLength) as ArrayBuffer;
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

export function isEncryptedToken(token: string): boolean {
  if (typeof token !== 'string') return false;
  const t = token.trim();
  if (t.startsWith(MAGIC)) return true;
  try {
    const decoded = atob(t);
    return decoded.startsWith(MAGIC);
  } catch {
    return false;
  }
}

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

  const ctBytes = new Uint8Array(ciphertext);
  const blob = new Uint8Array(MAGIC.length + SALT_LEN + IV_LEN + ctBytes.length);
  let offset = 0;
  for (let i = 0; i < MAGIC.length; i++) blob[offset++] = MAGIC.charCodeAt(i);
  blob.set(salt, offset); offset += SALT_LEN;
  blob.set(iv, offset); offset += IV_LEN;
  blob.set(ctBytes, offset);

  return bufferToBase64(blob.buffer);
}

export async function decryptJson(token: string, password: string): Promise<any> {
  const trimmed = token.replace(/\s+/g, '');
  let bytes: Uint8Array;

  if (trimmed.startsWith(MAGIC)) {
    bytes = new Uint8Array(trimmed.length);
    for (let i = 0; i < trimmed.length; i++) bytes[i] = trimmed.charCodeAt(i);
  } else {
    try {
      const buf = base64ToBuffer(trimmed);
      bytes = new Uint8Array(buf);
    } catch (e) {
      throw new Error('not an encrypted file');
    }
  }

  let isMagicMatch = true;
  for (let i = 0; i < MAGIC.length; i++) {
    if (bytes[i] !== MAGIC.charCodeAt(i)) {
      isMagicMatch = false;
      break;
    }
  }

  if (!isMagicMatch) throw new Error('not an encrypted file');

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

// ─── GROQ КЛЮЧ ───

export async function saveGroqKey(key: string): Promise<boolean> {
  const pass = getAuthPassword();
  if (!pass) {
    console.warn('[saveGroq] no password in memory');
    return false;
  }
  try {
    // ⚡️ ИСПРАВЛЕНО: передаем объект, а не JSON-строку
    const payload = { key };
    const encrypted = await encryptJson(payload, pass);
    localStorage.setItem(GROQ_STORAGE, encrypted);
    return true;
  } catch (e) {
    console.warn('[saveGroq] FAILED:', e);
    return false;
  }
}

export async function loadGroqKey(): Promise<string> {
  const raw = localStorage.getItem(GROQ_STORAGE) || '';
  if (!raw) return '';
  
  const pass = getAuthPassword();
  if (!pass) {
    console.warn('[loadGroq] no password in memory');
    return '';
  }

  try {
    if (isEncryptedToken(raw)) {
      const d = await decryptJson(raw, pass);
      // На случай, если ключ был сохранен как строка (двойной JSON)
      if (typeof d === 'string') {
        try {
          return JSON.parse(d).key || '';
        } catch {
          return d;
        }
      }
      return d.key || '';
    }
    return JSON.parse(raw).key || '';
  } catch (e) {
    console.warn('[loadGroq] decrypt failed', e);
    return '';
  }
}

export function deleteGroqKey(): boolean {
  try { localStorage.removeItem(GROQ_STORAGE); return true; } catch { return false; }
}