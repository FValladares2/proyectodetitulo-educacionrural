/**
 * Formatos de clave aceptados por utils/encryption y errores de cargas mal formadas
 * (complementa encryption.test.js, que cubre el cifrado y descifrado).
 */
const crypto = require('crypto')
const { normalizeKey, encrypt, decrypt } = require('../utils/encryption')

const bytes = crypto.randomBytes(32)

describe('normalizeKey', () => {
  test('acepta un Buffer de 32 bytes, hex de 64 caracteres, base64 y texto de 32 bytes', () => {
    expect(normalizeKey(bytes)).toBe(bytes)
    expect(normalizeKey(bytes.toString('hex')).equals(bytes)).toBe(true)
    expect(normalizeKey(bytes.toString('base64')).equals(bytes)).toBe(true)
    expect(normalizeKey('a'.repeat(32)).equals(Buffer.from('a'.repeat(32)))).toBe(true)
  })

  test('rechaza claves vacías o de otro largo', () => {
    expect(() => normalizeKey('')).toThrow(/empty/)
    expect(() => normalizeKey(null)).toThrow(/empty/)
    expect(() => normalizeKey(Buffer.alloc(16))).toThrow(/32 bytes/)
    expect(() => normalizeKey('corta')).toThrow(/Invalid key format/)
    expect(() => normalizeKey(42)).toThrow(/Invalid key format/)
  })

  test('los tres formatos de la misma clave descifran lo mismo', () => {
    const cifrado = encrypt('hola', bytes)
    expect(decrypt(cifrado, bytes.toString('hex'))).toBe('hola')
    expect(decrypt(cifrado, bytes.toString('base64'))).toBe('hola')
  })
})

describe('decrypt con cargas mal formadas', () => {
  test('rechaza un texto que no tiene el formato v1:iv:tag:datos', () => {
    expect(() => decrypt('v2:a:b:c', bytes)).toThrow(/Invalid string payload/)
    expect(() => decrypt('sin-formato', bytes)).toThrow(/Invalid string payload/)
  })

  test('rechaza objetos incompletos y tipos no admitidos', () => {
    const { ciphertext, iv } = encrypt('hola', bytes)
    expect(() => decrypt({ ciphertext, iv }, bytes)).toThrow(/Incomplete/)
    expect(() => decrypt(42, bytes)).toThrow(/Payload must be/)
  })

  test('un Buffer se cifra tal cual y un objeto vuelve como objeto', () => {
    const binario = Buffer.from([0, 255, 10, 13])
    expect(decrypt(encrypt(binario, bytes), bytes)).toBe(binario.toString('utf8'))
    expect(decrypt(encrypt({ a: [1, 2] }, bytes), bytes)).toEqual({ a: [1, 2] })
  })
})
