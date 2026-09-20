// ============================================================
// CRYPTO STORE — Client-Side Hardware-Accelerated Encryption
// Uses Web Crypto API (AES-GCM 256-bit)
// Gretex Group | File Master | v1.2
// ============================================================

const CryptoStore = (() => {
  let _cryptoKey = null;
  const STORAGE_PREFIX = 'fr_enc_';
  const SALT = new Uint8Array([71, 114, 101, 116, 101, 120, 70, 105, 108, 101, 77, 97, 115, 116, 101, 114]); // 'GretexFileMaster'

  // Convert string to Uint8Array
  function textToBytes(str) {
    return new TextEncoder().encode(str);
  }

  // Convert Uint8Array to string
  function bytesToText(bytes) {
    return new TextDecoder().decode(bytes);
  }

  // Convert buffer to base64
  function bufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  // Convert base64 to Uint8Array
  function base64ToBytes(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  // Check Web Crypto support
  function hasWebCrypto() {
    return !!(window.crypto && window.crypto.subtle);
  }

  // Derive 256-bit AES-GCM Key from user session
  async function init(session) {
    if (!hasWebCrypto()) {
      console.warn('Web Crypto API not available. Using fallback cipher.');
      return false;
    }

    try {
      const username = (session && session.username) || 'guest';
      const userId   = (session && session.userId)   || 'USR-000';
      const secret   = `${username}:${userId}:GretexSecureKey2026`;

      const keyMaterial = await window.crypto.subtle.importKey(
        'raw',
        textToBytes(secret),
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
      );

      _cryptoKey = await window.crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: SALT,
          iterations: 100000,
          hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );

      return true;
    } catch (err) {
      console.error('CryptoStore init error:', err);
      return false;
    }
  }

  // Encrypt JS Object or String -> returns { iv, ct }
  async function encrypt(data) {
    const jsonStr = JSON.stringify(data);

    if (!_cryptoKey || !hasWebCrypto()) {
      // Fallback base64 obfuscation if Web Crypto not initialized
      return { iv: 'plain', ct: btoa(encodeURIComponent(jsonStr)) };
    }

    try {
      const iv = window.crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for AES-GCM
      const encoded = textToBytes(jsonStr);

      const cipherBuffer = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv },
        _cryptoKey,
        encoded
      );

      return {
        iv: bufferToBase64(iv),
        ct: bufferToBase64(cipherBuffer)
      };
    } catch (err) {
      console.error('CryptoStore encrypt error:', err);
      return { iv: 'plain', ct: btoa(encodeURIComponent(jsonStr)) };
    }
  }

  // Decrypt { iv, ct } -> returns JS Object
  async function decrypt(payload) {
    if (!payload || !payload.ct) return null;

    if (payload.iv === 'plain' || !_cryptoKey || !hasWebCrypto()) {
      try {
        const jsonStr = decodeURIComponent(atob(payload.ct));
        return JSON.parse(jsonStr);
      } catch (e) {
        return null;
      }
    }

    try {
      const ivBytes = base64ToBytes(payload.iv);
      const cipherBytes = base64ToBytes(payload.ct);

      const decryptedBuffer = await window.crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: ivBytes },
        _cryptoKey,
        cipherBytes
      );

      const jsonStr = bytesToText(decryptedBuffer);
      return JSON.parse(jsonStr);
    } catch (err) {
      console.warn('CryptoStore decrypt failed (key mismatch or corrupted data):', err);
      return null;
    }
  }

  // Encrypt and save to storage (localStorage by default)
  async function save(key, data, storageType = 'local') {
    try {
      const encrypted = await encrypt(data);
      const fullKey = STORAGE_PREFIX + key;
      const json = JSON.stringify(encrypted);

      if (storageType === 'session') {
        sessionStorage.setItem(fullKey, json);
      } else {
        localStorage.setItem(fullKey, json);
      }
      return true;
    } catch (err) {
      console.error('CryptoStore save error:', err);
      return false;
    }
  }

  // Load and decrypt from storage
  async function load(key, storageType = 'local') {
    try {
      const fullKey = STORAGE_PREFIX + key;
      const raw = (storageType === 'session')
        ? sessionStorage.getItem(fullKey)
        : localStorage.getItem(fullKey);

      if (!raw) return null;
      const payload = JSON.parse(raw);
      return await decrypt(payload);
    } catch (err) {
      console.error('CryptoStore load error:', err);
      return null;
    }
  }

  // Remove single key
  function remove(key, storageType = 'local') {
    const fullKey = STORAGE_PREFIX + key;
    try {
      if (storageType === 'session') sessionStorage.removeItem(fullKey);
      else localStorage.removeItem(fullKey);
    } catch (e) {}
  }

  // Wipe all encrypted items and reset cryptographic key
  function wipeAll() {
    _cryptoKey = null;
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && k.startsWith(STORAGE_PREFIX)) {
          localStorage.removeItem(k);
        }
      }
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const k = sessionStorage.key(i);
        if (k && k.startsWith(STORAGE_PREFIX)) {
          sessionStorage.removeItem(k);
        }
      }
    } catch (e) {}
  }

  return {
    init,
    encrypt,
    decrypt,
    save,
    load,
    remove,
    wipeAll,
    isReady: () => !!_cryptoKey
  };
})();
