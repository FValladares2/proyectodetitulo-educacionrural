/**
 * Funciones de userServices que no dependen de consultas reales: validación del nombre y el
 * límite de escrituras de ultima_conexion. La colección de usuarios se simula.
 */
const mockUpdateOne = jest.fn(async () => ({ modifiedCount: 1 }))

jest.mock('../config/mongo', () => ({
  SALT_ROUNDS: 4,
  isMongoConnected: () => true,
  collections: { usuarios: { updateOne: (...args) => mockUpdateOne(...args) } },
  ObjectId: require('mongodb').ObjectId,
}))

const { validarNombre, registrarConexion } = require('../services/userServices')

const MINUTO = 60 * 1000

describe('validarNombre', () => {
  test('quita espacios sobrantes y une los repetidos', () => {
    expect(validarNombre('  Ana   María  Pérez ')).toBe('Ana María Pérez')
  })

  test('rechaza vacíos, solo espacios, más de 100 caracteres y valores que no son texto', () => {
    for (const invalido of ['', '   ', 'a'.repeat(101), null, undefined, 42, ['Ana']]) {
      expect(validarNombre(invalido)).toBeNull()
    }
    expect(validarNombre('a'.repeat(100))).toBe('a'.repeat(100))
  })
})

describe('registrarConexion', () => {
  beforeEach(() => mockUpdateOne.mockClear())

  test('sin conexión previa la registra', async () => {
    await registrarConexion({ _id: 'u1' })
    expect(mockUpdateOne).toHaveBeenCalledTimes(1)
    expect(mockUpdateOne.mock.calls[0][1].$set.ultima_conexion).toBeInstanceOf(Date)
  })

  test('no vuelve a escribir antes de 5 minutos', async () => {
    await registrarConexion({ _id: 'u1', ultima_conexion: new Date(Date.now() - 4 * MINUTO) })
    expect(mockUpdateOne).not.toHaveBeenCalled()
  })

  test('pasados 5 minutos la actualiza', async () => {
    await registrarConexion({ _id: 'u1', ultima_conexion: new Date(Date.now() - 6 * MINUTO) })
    expect(mockUpdateOne).toHaveBeenCalledTimes(1)
  })
})
