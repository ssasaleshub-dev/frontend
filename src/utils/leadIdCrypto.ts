/**
 * SSA Saleshub - Production Lead ID Encryption & Decryption Utility
 * 
 * Provides two-way obfuscation/encryption for database lead sequence IDs.
 * Prevents URL enumeration, scraping, and competitor data harvesting by ensuring
 * raw sequential database IDs (e.g. 959, 960) are NEVER exposed openly in URLs.
 * 
 * Uses a 128-bit Tiny Encryption Algorithm (TEA) with checksum validation and URL-safe Base64 encoding.
 */

const DELTA = 0x9e3779b9;
// 128-bit private key for SSA Saleshub ID encryption
const CRYPTO_KEY = [0x53534153, 0x616c6573, 0x6875624b, 0x65793236]; // 'SSAS', 'ales', 'hubK', 'ey26'
const SALT_MAGIC = 0x5a3c96e5;
const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function teaEncrypt(v0: number, v1: number, k: number[]): [number, number] {
  let sum = 0;
  for (let i = 0; i < 32; i++) {
    sum = (sum + DELTA) >>> 0;
    v0 = (v0 + (((v1 << 4 >>> 0) + k[0] >>> 0) ^ (v1 + sum >>> 0) ^ ((v1 >>> 5) + k[1] >>> 0))) >>> 0;
    v1 = (v1 + (((v0 << 4 >>> 0) + k[2] >>> 0) ^ (v0 + sum >>> 0) ^ ((v0 >>> 5) + k[3] >>> 0))) >>> 0;
  }
  return [v0, v1];
}

function teaDecrypt(v0: number, v1: number, k: number[]): [number, number] {
  let sum = (DELTA * 32) >>> 0;
  for (let i = 0; i < 32; i++) {
    v1 = (v1 - (((v0 << 4 >>> 0) + k[2] >>> 0) ^ (v0 + sum >>> 0) ^ ((v0 >>> 5) + k[3] >>> 0))) >>> 0;
    v0 = (v0 - (((v1 << 4 >>> 0) + k[0] >>> 0) ^ (v1 + sum >>> 0) ^ ((v1 >>> 5) + k[1] >>> 0))) >>> 0;
    sum = (sum - DELTA) >>> 0;
  }
  return [v0, v1];
}

function encode64(w0: number, w1: number): string {
  const bytes = [
    (w0 >>> 24) & 0xff, (w0 >>> 16) & 0xff, (w0 >>> 8) & 0xff, w0 & 0xff,
    (w1 >>> 24) & 0xff, (w1 >>> 16) & 0xff, (w1 >>> 8) & 0xff, w1 & 0xff,
  ];
  let res = '';
  res += B64_CHARS[bytes[0] >> 2];
  res += B64_CHARS[((bytes[0] & 3) << 4) | (bytes[1] >> 4)];
  res += B64_CHARS[((bytes[1] & 15) << 2) | (bytes[2] >> 6)];
  res += B64_CHARS[bytes[2] & 63];

  res += B64_CHARS[bytes[3] >> 2];
  res += B64_CHARS[((bytes[3] & 3) << 4) | (bytes[4] >> 4)];
  res += B64_CHARS[((bytes[4] & 15) << 2) | (bytes[5] >> 6)];
  res += B64_CHARS[bytes[5] & 63];

  res += B64_CHARS[bytes[6] >> 2];
  res += B64_CHARS[((bytes[6] & 3) << 4) | (bytes[7] >> 4)];
  res += B64_CHARS[(bytes[7] & 15) << 2];
  return res;
}

function decode64(str: string): [number, number] | null {
  if (str.length !== 11) return null;
  const vals: number[] = [];
  for (let i = 0; i < str.length; i++) {
    const idx = B64_CHARS.indexOf(str[i]);
    if (idx === -1) return null;
    vals.push(idx);
  }
  const b0 = (vals[0] << 2) | (vals[1] >> 4);
  const b1 = ((vals[1] & 15) << 4) | (vals[2] >> 2);
  const b2 = ((vals[2] & 3) << 6) | vals[3];

  const b3 = (vals[4] << 2) | (vals[5] >> 4);
  const b4 = ((vals[5] & 15) << 4) | (vals[6] >> 2);
  const b5 = ((vals[6] & 3) << 6) | vals[7];

  const b6 = (vals[8] << 2) | (vals[9] >> 4);
  const b7 = ((vals[9] & 15) << 4) | (vals[10] >> 2);

  const w0 = ((b0 << 24) | (b1 << 16) | (b2 << 8) | b3) >>> 0;
  const w1 = ((b4 << 24) | (b5 << 16) | (b6 << 8) | b7) >>> 0;
  return [w0, w1];
}

/**
 * Encrypt a numeric database lead ID into a secure URL-safe token.
 * E.g.: 959 -> "e_NAkEM2fA7YM"
 */
export function encryptLeadId(id: number | string | undefined | null): string {
  if (id === undefined || id === null) return '';
  const num = Number(id);
  if (isNaN(num) || num <= 0) return String(id);
  const chk = ((num ^ SALT_MAGIC) * 31337 + 7919) >>> 0;
  const [e0, e1] = teaEncrypt(num, chk, CRYPTO_KEY);
  return 'e_' + encode64(e0, e1);
}

/**
 * Decrypt an encrypted lead token back to its numeric database ID.
 * Returns null if the token is invalid or tampered with.
 * If the input is already a numeric string (legacy/direct input), returns that number.
 */
export function decryptLeadId(token: string | undefined | null): number | null {
  if (!token) return null;
  const str = String(token).trim();

  // If already an encrypted token with prefix 'e_'
  if (str.startsWith('e_')) {
    const raw = str.substring(2);
    const decoded = decode64(raw);
    if (!decoded) return null;
    const [d0, d1] = teaDecrypt(decoded[0], decoded[1], CRYPTO_KEY);
    const expectedChk = ((d0 ^ SALT_MAGIC) * 31337 + 7919) >>> 0;
    if (d1 !== expectedChk) return null;
    return d0;
  }

  // Backward compatibility: If direct numeric string entered (e.g. "959"), allow it
  if (/^\d+$/.test(str)) {
    return Number(str);
  }

  return null;
}

/**
 * Formats a lead ID for masked / secure UI display (e.g. in headers).
 */
export function formatMaskedLeadRef(id: number | string | undefined | null): string {
  if (!id) return '';
  const enc = encryptLeadId(id);
  return `SSA-${enc.replace(/^e_/, '')}`;
}

