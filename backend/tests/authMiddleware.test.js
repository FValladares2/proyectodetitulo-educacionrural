/**
 * Middleware authenticate real (las pruebas de integración lo simulan) y origen del secreto
 * de los tokens. Sin base de datos: userServices se simula.
 */
const { ObjectId: mockObjectId } = require('mongodb')

const mockUsuario = { _id: new mockObjectId(), nombre: 'Ana', correo: 'ana@prueba.cl' }
const mockDesactivado = { _id: new mockObjectId(), nombre: 'Beto', desactivado_en: new Date() }

jest.mock('../services/userServices', () => ({
  findUserById: jest.fn(async (id) =>
    [mockUsuario, mockDesactivado].find((u) => String(u._id) === String(id)) ?? null,
  ),
  registrarConexion: jest.fn(async () => null),
}))

const SECRETOS = ['TOKEN_SECRETO', 'ENCRYPTION_KEY', 'NODE_ENV']
const entornoOriginal = Object.fromEntries(SECRETOS.map((k) => [k, process.env[k]]))
process.env.TOKEN_SECRETO = 'secreto-de-prueba'

const userServices = require('../services/userServices')
const { authenticate, createToken } = require('../utils/auth')

// respuesta mínima de express para observar el estado y el cuerpo
const respuesta = () => {
  const res = {}
  res.status = jest.fn(() => res)
  res.json = jest.fn(() => res)
  return res
}

const ejecutar = async (authorization) => {
  const req = { headers: authorization === undefined ? {} : { authorization } }
  const res = respuesta()
  const next = jest.fn()
  await authenticate(req, res, next)
  return { req, res, next }
}

afterAll(() => {
  for (const [clave, valor] of Object.entries(entornoOriginal)) {
    if (valor === undefined) delete process.env[clave]
    else process.env[clave] = valor
  }
})

describe('authenticate', () => {
  beforeEach(() => jest.clearAllMocks())

  test('sin encabezado de autorización responde 401', async () => {
    const { res, next } = await ejecutar(undefined)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  test('un encabezado que no es Bearer responde 401', async () => {
    const { res, next } = await ejecutar(`Basic ${createToken(mockUsuario)}`)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  test('un token alterado o con otro formato responde 401', async () => {
    const token = createToken(mockUsuario)
    for (const invalido of ['abc', `${token}x`, token.replace(/^v1/, 'v2')]) {
      const { res, next } = await ejecutar(`Bearer ${invalido}`)
      expect(res.status).toHaveBeenCalledWith(401)
      expect(next).not.toHaveBeenCalled()
    }
  })

  test('un token vencido responde 401', async () => {
    jest.useFakeTimers({ now: new Date('2026-01-01T00:00:00Z') })
    const token = createToken(mockUsuario)
    jest.setSystemTime(new Date('2026-01-09T00:00:00Z'))
    const { res, next } = await ejecutar(`Bearer ${token}`)
    jest.useRealTimers()
    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  test('una cuenta desactivada responde 401 aunque el token sea válido', async () => {
    const { res, next } = await ejecutar(`Bearer ${createToken(mockDesactivado)}`)
    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  test('un token válido deja el usuario en req.user y registra la conexión', async () => {
    const { req, res, next } = await ejecutar(`Bearer ${createToken(mockUsuario)}`)
    expect(next).toHaveBeenCalled()
    expect(res.status).not.toHaveBeenCalled()
    expect(req.user).toBe(mockUsuario)
    expect(userServices.registrarConexion).toHaveBeenCalledWith(mockUsuario)
  })

  test('si registrar la conexión falla, la solicitud continúa', async () => {
    const consola = jest.spyOn(console, 'error').mockImplementation(() => {})
    userServices.registrarConexion.mockRejectedValueOnce(new Error('sin base de datos'))
    const { next } = await ejecutar(`Bearer ${createToken(mockUsuario)}`)
    await new Promise((resolve) => setImmediate(resolve))
    expect(next).toHaveBeenCalled()
    expect(consola).toHaveBeenCalled()
    consola.mockRestore()
  })
})

describe('secreto de los tokens', () => {
  // cada caso carga utils/auth de nuevo, porque el secreto se calcula una vez por proceso
  const cargarAuth = (entorno) => {
    let auth
    jest.isolateModules(() => {
      for (const clave of SECRETOS) delete process.env[clave]
      Object.assign(process.env, entorno)
      auth = require('../utils/auth')
    })
    return auth
  }

  afterEach(() => {
    for (const clave of SECRETOS) delete process.env[clave]
    process.env.TOKEN_SECRETO = 'secreto-de-prueba'
  })

  test('sin TOKEN_SECRETO se deriva de ENCRYPTION_KEY', () => {
    const conClave = cargarAuth({ ENCRYPTION_KEY: 'a'.repeat(64) })
    const token = conClave.createToken(mockUsuario)
    expect(conClave.verificarToken(token)?.sub).toBe(String(mockUsuario._id))

    // otra clave de cifrado da otro secreto: el token anterior deja de ser válido
    const otraClave = cargarAuth({ ENCRYPTION_KEY: 'b'.repeat(64) })
    expect(otraClave.verificarToken(token)).toBeNull()
  })

  test('cambiar TOKEN_SECRETO invalida los tokens emitidos', () => {
    const token = cargarAuth({ TOKEN_SECRETO: 'uno' }).createToken(mockUsuario)
    expect(cargarAuth({ TOKEN_SECRETO: 'dos' }).verificarToken(token)).toBeNull()
  })

  test('en producción sin ningún secreto no se emiten tokens', () => {
    const auth = cargarAuth({ NODE_ENV: 'production' })
    expect(() => auth.createToken(mockUsuario)).toThrow(/obligatorio en producción/)
  })
})
