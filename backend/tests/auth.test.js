const { ObjectId: mockObjectId } = require('mongodb')

const mockUsuario = { _id: new mockObjectId(), nombre: 'Ana', correo: 'ana@prueba.cl' }

jest.mock('../services/userServices', () => ({
  findUserById: jest.fn(async (id) => (String(id) === String(mockUsuario._id) ? mockUsuario : null)),
}))

process.env.TOKEN_SECRETO = 'secreto-de-prueba'
const { createToken, verificarToken, getUserFromToken } = require('../utils/auth')

// arma un token con el formato correcto pero firmado con otro secreto
const firmarCon = (secreto, contenido) => {
  const crypto = require('crypto')
  const datos = Buffer.from(JSON.stringify(contenido)).toString('base64url')
  const firma = crypto.createHmac('sha256', secreto).update(`v1.${datos}`).digest('base64url')
  return `v1.${datos}.${firma}`
}

describe('tokens de sesión', () => {
  afterEach(() => jest.useRealTimers())

  test('un token recién creado identifica al usuario', async () => {
    const token = createToken(mockUsuario)
    expect(token).toMatch(/^v1\.[\w-]+\.[\w-]+$/)
    expect(await getUserFromToken(token)).toBe(mockUsuario)
  })

  test('el token no incluye datos privados, solo el id y las fechas', () => {
    const [, datos] = createToken(mockUsuario).split('.')
    const contenido = JSON.parse(Buffer.from(datos, 'base64url').toString('utf8'))
    expect(Object.keys(contenido).sort()).toEqual(['exp', 'iat', 'sub'])
    expect(contenido.exp - contenido.iat).toBe(7 * 24 * 60 * 60)
  })

  test('cambiar el id del token invalida la firma', async () => {
    const [version, , firma] = createToken(mockUsuario).split('.')
    const otroId = Buffer.from(
      JSON.stringify({ sub: String(new mockObjectId()), iat: 1, exp: 9999999999 }),
    ).toString('base64url')
    expect(await getUserFromToken(`${version}.${otroId}.${firma}`)).toBeNull()
  })

  test('un token firmado con otro secreto no sirve', async () => {
    const falso = firmarCon('otro-secreto', { sub: String(mockUsuario._id), iat: 1, exp: 9999999999 })
    expect(await getUserFromToken(falso)).toBeNull()
  })

  test('los tokens antiguos sin firma (base64 de "id:nombre:fecha") ya no sirven', async () => {
    const antiguo = Buffer.from(`${mockUsuario._id}:${mockUsuario.nombre}:${Date.now()}`).toString('base64')
    expect(await getUserFromToken(antiguo)).toBeNull()
  })

  test('un token vencido no sirve', async () => {
    const token = createToken(mockUsuario)
    jest.useFakeTimers({ now: Date.now() + 8 * 24 * 60 * 60 * 1000 })
    expect(verificarToken(token)).toBeNull()
    expect(await getUserFromToken(token)).toBeNull()
  })

  test('valores mal formados se rechazan sin lanzar errores', async () => {
    for (const valor of [undefined, null, '', 'abc', 'v1..', 'v2.a.b', 'v1.no-json.firma', 42]) {
      expect(await getUserFromToken(valor)).toBeNull()
    }
  })

  test('un token válido de un usuario eliminado no sirve', async () => {
    expect(await getUserFromToken(createToken({ _id: new mockObjectId() }))).toBeNull()
  })
})
