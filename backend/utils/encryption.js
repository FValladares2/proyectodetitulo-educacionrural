const crypto = require('crypto')

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH_BYTES = 12 // 96 bits recommended for AES-GCM
const AUTH_TAG_LENGTH_BYTES = 16 // 128 bits
const KEY_LENGTH_BYTES = 32 // 256 bits

/**
 * Normalizes any valid key input (32-byte Buffer, 64-char hex string, base64 string) to a 32-byte Buffer.
 * @param {Buffer|string} key
 * @returns {Buffer}
 */
const normalizeKey = (key) => {
  if (!key) {
    throw new Error('Encryption key must not be empty.')
  }

  if (Buffer.isBuffer(key)) {
    if (key.length !== KEY_LENGTH_BYTES) {
      throw new Error(`Key buffer must be exactly ${KEY_LENGTH_BYTES} bytes. Received ${key.length} bytes.`)
    }
    return key
  }

  if (typeof key === 'string') {
    // 64-character hex string
    if (/^[0-9a-fA-F]{64}$/.test(key)) {
      return Buffer.from(key, 'hex')
    }
    // Base64 string of 32 bytes (44 chars with padding)
    const base64Buffer = Buffer.from(key, 'base64')
    if (base64Buffer.length === KEY_LENGTH_BYTES) {
      return base64Buffer
    }
    // Fallback: UTF-8 string of 32 bytes
    const utf8Buffer = Buffer.from(key, 'utf8')
    if (utf8Buffer.length === KEY_LENGTH_BYTES) {
      return utf8Buffer
    }
  }

  throw new Error(`Invalid key format. Expected 32-byte Buffer, 64-hex string, or 32-byte Base64 string.`)
}

/**
 * Generates a cryptographically secure random 256-bit key formatted as a hex string.
 * @returns {string} 64-character hex string
 */
const generateKey = () => {
  return crypto.randomBytes(KEY_LENGTH_BYTES).toString('hex')
}

/**
 * Derives a 256-bit subkey from a master key using HKDF (RFC 5869) with SHA-256.
 * @param {Buffer|string} masterKey
 * @param {string} [info='recurso-encryption'] - Contextual info string
 * @param {string|Buffer} [salt=''] - Optional salt (e.g. userId)
 * @returns {Buffer} 32-byte Buffer derived key
 */
const deriveKey = (masterKey, info = 'recurso-encryption', salt = '') => {
  const normKey = normalizeKey(masterKey)
  const saltBuf = Buffer.isBuffer(salt) ? salt : Buffer.from(String(salt || ''), 'utf8')
  const infoBuf = Buffer.isBuffer(info) ? info : Buffer.from(String(info || ''), 'utf8')

  return Buffer.from(crypto.hkdfSync('sha256', normKey, saltBuf, infoBuf, KEY_LENGTH_BYTES))
}

/**
 * Encrypts data using AES-256-GCM.
 * @param {string|Buffer|object} data - Data to encrypt
 * @param {Buffer|string} key - 32-byte encryption key
 * @returns {{ ciphertext: string, iv: string, authTag: string, version: number }}
 */
const encrypt = (data, key) => {
  const normKey = normalizeKey(key)

  let plainBuffer
  let isJson = false

  if (Buffer.isBuffer(data)) {
    plainBuffer = data
  } else if (typeof data === 'object' && data !== null) {
    plainBuffer = Buffer.from(JSON.stringify(data), 'utf8')
    isJson = true
  } else {
    plainBuffer = Buffer.from(String(data), 'utf8')
  }

  const iv = crypto.randomBytes(IV_LENGTH_BYTES)
  const cipher = crypto.createCipheriv(ALGORITHM, normKey, iv, {
    authTagLength: AUTH_TAG_LENGTH_BYTES,
  })

  const encrypted = Buffer.concat([cipher.update(plainBuffer), cipher.final()])
  const authTag = cipher.getAuthTag()

  return {
    ciphertext: encrypted.toString('base64'),
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    isJson,
    version: 1,
  }
}

/**
 * Decrypts a payload previously encrypted with AES-256-GCM.
 * @param {{ ciphertext: string, iv: string, authTag: string, isJson?: boolean } | string} payload
 * @param {Buffer|string} key - 32-byte encryption key
 * @returns {string|object} Decrypted string or parsed object if isJson was true
 */
const decrypt = (payload, key) => {
  const normKey = normalizeKey(key)

  let ciphertext
  let iv
  let authTag
  let isJson = false

  if (typeof payload === 'string') {
    // Support compact string format: "v1:<iv>:<authTag>:<ciphertext>"
    const parts = payload.split(':')
    if (parts.length === 4 && parts[0] === 'v1') {
      iv = parts[1]
      authTag = parts[2]
      ciphertext = parts[3]
    } else {
      throw new Error('Invalid string payload format for decryption. Expected "v1:<iv>:<authTag>:<ciphertext>".')
    }
  } else if (typeof payload === 'object' && payload !== null) {
    ciphertext = payload.ciphertext
    iv = payload.iv
    authTag = payload.authTag
    isJson = Boolean(payload.isJson)
  } else {
    throw new Error('Payload must be an object { ciphertext, iv, authTag } or formatted string.')
  }

  if (!ciphertext || !iv || !authTag) {
    throw new Error('Incomplete encryption payload: ciphertext, iv, and authTag are required.')
  }

  const ivBuffer = Buffer.from(iv, 'hex')
  const authTagBuffer = Buffer.from(authTag, 'hex')
  const cipherBuffer = Buffer.from(ciphertext, 'base64')

  const decipher = crypto.createDecipheriv(ALGORITHM, normKey, ivBuffer, {
    authTagLength: AUTH_TAG_LENGTH_BYTES,
  })
  decipher.setAuthTag(authTagBuffer)

  try {
    const decrypted = Buffer.concat([decipher.update(cipherBuffer), decipher.final()])
    const decryptedText = decrypted.toString('utf8')

    if (isJson) {
      try {
        return JSON.parse(decryptedText)
      } catch {
        return decryptedText
      }
    }

    return decryptedText
  } catch (error) {
    throw new Error(`Decryption failed: corrupted data, tampered tag, or incorrect key (${error.message})`)
  }
}

/**
 * Formats an encryption result object to a single compact string: "v1:iv:authTag:ciphertext".
 * @param {{ iv: string, authTag: string, ciphertext: string }} payload
 * @returns {string}
 */
const formatToString = (payload) => {
  return `v1:${payload.iv}:${payload.authTag}:${payload.ciphertext}`
}

module.exports = {
  ALGORITHM,
  KEY_LENGTH_BYTES,
  IV_LENGTH_BYTES,
  AUTH_TAG_LENGTH_BYTES,
  normalizeKey,
  generateKey,
  deriveKey,
  encrypt,
  decrypt,
  formatToString,
}
