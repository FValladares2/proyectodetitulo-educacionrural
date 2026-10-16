require('dotenv').config()
const encryption = require('../utils/encryption')
const recursoServices = require('../services/recursoServices')

describe('Encryption Utility (AES-256-GCM)', () => {
  const sampleKey = encryption.generateKey()

  test('generateKey creates a 64-character hex string (32 bytes)', () => {
    const key = encryption.generateKey()
    expect(typeof key).toBe('string')
    expect(key).toHaveLength(64)
    expect(Buffer.from(key, 'hex')).toHaveLength(32)
  })

  test('encrypt and decrypt a plain string successfully', () => {
    const originalText = 'Documento confidencial con contenido sensible de clase rural'
    const encrypted = encryption.encrypt(originalText, sampleKey)

    expect(encrypted).toHaveProperty('ciphertext')
    expect(encrypted).toHaveProperty('iv')
    expect(encrypted).toHaveProperty('authTag')
    expect(encrypted.ciphertext).not.toEqual(originalText)

    const decrypted = encryption.decrypt(encrypted, sampleKey)
    expect(decrypted).toEqual(originalText)
  })

  test('encrypt and decrypt a JSON object maintaining types', () => {
    const originalData = {
      filename: 'guia_matematicas.pdf',
      grade: 4,
      tags: ['rural', 'multi-grado'],
      metadata: { author: 'Profesor Juan' },
    }

    const encrypted = encryption.encrypt(originalData, sampleKey)
    expect(encrypted.isJson).toBe(true)

    const decrypted = encryption.decrypt(encrypted, sampleKey)
    expect(decrypted).toEqual(originalData)
  })

  test('different encryptions of the same plaintext produce different ciphertexts (fresh IV)', () => {
    const text = 'Mismo texto cifrado dos veces'
    const encrypted1 = encryption.encrypt(text, sampleKey)
    const encrypted2 = encryption.encrypt(text, sampleKey)

    expect(encrypted1.iv).not.toEqual(encrypted2.iv)
    expect(encrypted1.ciphertext).not.toEqual(encrypted2.ciphertext)
  })

  test('fails decryption when ciphertext is tampered with', () => {
    const text = 'Texto a proteger'
    const encrypted = encryption.encrypt(text, sampleKey)

    // Ensure the character is genuinely altered
    const replacement = encrypted.ciphertext[0] === 'A' ? 'B' : 'A'
    const tamperedCipher = replacement + encrypted.ciphertext.slice(1)
    const tamperedPayload = { ...encrypted, ciphertext: tamperedCipher }

    expect(() => {
      encryption.decrypt(tamperedPayload, sampleKey)
    }).toThrow(/Decryption failed/i)
  })

  test('fails decryption when authTag is incorrect', () => {
    const text = 'Texto a proteger'
    const encrypted = encryption.encrypt(text, sampleKey)

    const corruptedTag = '0'.repeat(32)
    const corruptedPayload = { ...encrypted, authTag: corruptedTag }

    expect(() => {
      encryption.decrypt(corruptedPayload, sampleKey)
    }).toThrow(/Decryption failed/i)
  })

  test('fails decryption when wrong key is provided', () => {
    const text = 'Texto con clave incorrecta'
    const encrypted = encryption.encrypt(text, sampleKey)
    const wrongKey = encryption.generateKey()

    expect(() => {
      encryption.decrypt(encrypted, wrongKey)
    }).toThrow(/Decryption failed/i)
  })

  test('formatToString and string decryption support', () => {
    const text = 'Compact string payload test'
    const encrypted = encryption.encrypt(text, sampleKey)
    const formattedString = encryption.formatToString(encrypted)

    expect(formattedString.startsWith('v1:')).toBe(true)

    const decrypted = encryption.decrypt(formattedString, sampleKey)
    expect(decrypted).toEqual(text)
  })

  test('deriveKey derives reproducible context-bound keys with HKDF', () => {
    const masterKey = encryption.generateKey()
    const userAKey1 = encryption.deriveKey(masterKey, 'recurso-encryption', 'user-123')
    const userAKey2 = encryption.deriveKey(masterKey, 'recurso-encryption', 'user-123')
    const userBKey = encryption.deriveKey(masterKey, 'recurso-encryption', 'user-456')

    expect(userAKey1).toEqual(userAKey2)
    expect(userAKey1).not.toEqual(userBKey)
    expect(userAKey1).toHaveLength(32)
  })
})

describe('Recurso Services (Key Management & Service Layer)', () => {
  test('cifrarRecurso and descifrarRecurso round-trip with user context', async () => {
    const userId = '64e8b3b78297a7a28e932b10'
    const originalContent = 'Contenido del archivo o tarea de prueba'

    const encrypted = await recursoServices.cifrarRecurso(originalContent, userId)
    expect(encrypted).toHaveProperty('ciphertext')
    expect(encrypted).toHaveProperty('iv')
    expect(encrypted).toHaveProperty('authTag')

    const decrypted = await recursoServices.descifrarRecurso(encrypted, userId)
    expect(decrypted).toEqual(originalContent)
  })

  test('descifrarRecurso fails with mismatched user context (different derived key)', async () => {
    const authorId = '64e8b3b78297a7a28e932b10'
    const anotherUser = '64e8b3b78297a7a28e932b99'
    const content = 'Contenido protegido del autor'

    const encrypted = await recursoServices.cifrarRecurso(content, authorId)

    await expect(recursoServices.descifrarRecurso(encrypted, anotherUser)).rejects.toThrow(/Decryption failed/i)
  })
})
