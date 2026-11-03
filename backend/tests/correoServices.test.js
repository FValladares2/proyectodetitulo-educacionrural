/**
 * Cola de correos sin base de datos: elección del transporte según las variables de entorno,
 * remitente, y la espera entre reintentos. La colección y nodemailer se simulan; el envío y el
 * reintento contra un MongoDB real están en notificaciones.integration.test.js.
 */
const mockCorreos = {
  pendientes: [],
  findOneAndUpdate: jest.fn(async () => ({ value: mockCorreos.pendientes.shift() ?? null })),
  updateOne: jest.fn(async () => ({ modifiedCount: 1 })),
}

jest.mock('../config/mongo', () => ({
  isMongoConnected: () => true,
  collections: {
    get correos() {
      return mockCorreos
    },
  },
}))

const mockEnviados = []
jest.mock('nodemailer', () => ({
  createTransport: jest.fn((opciones) => ({
    opciones,
    sendMail: jest.fn(async (mensaje) => {
      mockEnviados.push(mensaje)
      return { messageId: 'id' }
    }),
  })),
}))

const nodemailer = require('nodemailer')
const correoServices = require('../services/correoServices')

const VARIABLES = ['CORREO_TRANSPORTE', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASS', 'CORREO_REMITENTE', 'APP_NOMBRE']
const MINUTO = 60 * 1000

const encolar = (correo = {}) => mockCorreos.pendientes.push({ _id: 'c1', para: 'ana@prueba.cl', asunto: 'Hola', texto: 'hola', intentos: 0, ...correo })

beforeEach(() => {
  for (const variable of VARIABLES) delete process.env[variable]
  correoServices.configurarTransporte(null)
  nodemailer.createTransport.mockClear()
  mockCorreos.findOneAndUpdate.mockClear()
  mockCorreos.updateOne.mockClear()
  mockCorreos.pendientes = []
  mockEnviados.length = 0
})

describe('transporte', () => {
  test('con SMTP_HOST usa SMTP con los datos del entorno', async () => {
    Object.assign(process.env, { SMTP_HOST: 'smtp.test', SMTP_PORT: '465', SMTP_SECURE: 'true', SMTP_USER: 'u', SMTP_PASS: 'p' })
    encolar()
    await correoServices.procesarCola()
    expect(nodemailer.createTransport).toHaveBeenCalledWith({
      host: 'smtp.test',
      port: 465,
      secure: true,
      auth: { user: 'u', pass: 'p' },
    })
  })

  test('SMTP sin usuario no envía credenciales y usa el puerto 587 por defecto', async () => {
    process.env.SMTP_HOST = 'smtp.test'
    encolar()
    await correoServices.procesarCola()
    expect(nodemailer.createTransport.mock.calls[0][0]).toMatchObject({ port: 587, secure: false, auth: undefined })
  })

  test('sin SMTP, o con CORREO_TRANSPORTE=registro, solo muestra el correo en la consola', async () => {
    const consola = jest.spyOn(console, 'log').mockImplementation(() => {})
    Object.assign(process.env, { SMTP_HOST: 'smtp.test', CORREO_TRANSPORTE: 'registro' })
    encolar()
    await correoServices.procesarCola()
    expect(nodemailer.createTransport).toHaveBeenCalledWith({ jsonTransport: true })
    expect(consola.mock.calls.flat().join(' ')).toMatch(/correo de prueba.*ana@prueba\.cl/s)
    consola.mockRestore()
  })

  test('el remitente es CORREO_REMITENTE o el nombre de la plataforma', async () => {
    process.env.SMTP_HOST = 'smtp.test'
    process.env.APP_NOMBRE = 'Aula Rural'
    encolar()
    await correoServices.procesarCola()
    expect(mockEnviados[0].from).toBe('Aula Rural <no-responder@localhost>')

    process.env.CORREO_REMITENTE = 'Escuela <avisos@escuela.cl>'
    encolar({ _id: 'c2' })
    await correoServices.procesarCola()
    expect(mockEnviados[1].from).toBe('Escuela <avisos@escuela.cl>')
  })
})

describe('cola', () => {
  test('un envío exitoso borra el contenido y deja el estado enviado', async () => {
    process.env.SMTP_HOST = 'smtp.test'
    encolar()
    expect(await correoServices.procesarCola()).toEqual({ enviados: 1, fallidos: 0 })
    const [, actualizacion] = mockCorreos.updateOne.mock.calls[0]
    expect(actualizacion.$set.estado).toBe('enviado')
    expect(actualizacion.$unset).toMatchObject({ texto: '', html: '' })
  })

  test('los reintentos esperan 1 min, 5 min, 30 min y 2 h; el quinto fallo es definitivo', async () => {
    const consola = jest.spyOn(console, 'error').mockImplementation(() => {})
    correoServices.configurarTransporte({ sendMail: jest.fn(async () => { throw new Error('caído') }) })

    const esperas = []
    for (let intentos = 0; intentos < correoServices.MAX_INTENTOS - 1; intentos++) {
      encolar({ intentos })
      const antes = Date.now()
      await correoServices.procesarCola()
      const [, { $set }] = mockCorreos.updateOne.mock.calls.at(-1)
      expect($set).toMatchObject({ estado: 'pendiente', intentos: intentos + 1, error: 'caído' })
      esperas.push(Math.round(($set.proximo_intento.getTime() - antes) / MINUTO))
    }
    expect(esperas).toEqual([1, 5, 30, 120])

    encolar({ intentos: correoServices.MAX_INTENTOS - 1 })
    expect(await correoServices.procesarCola()).toEqual({ enviados: 0, fallidos: 1 })
    const [, final] = mockCorreos.updateOne.mock.calls.at(-1)
    expect(final.$set).toMatchObject({ estado: 'fallido', intentos: correoServices.MAX_INTENTOS })
    expect(final.$unset).toMatchObject({ texto: '', html: '' })
    consola.mockRestore()
  })

  test('también retoma correos que quedaron "enviando" más de 10 minutos', async () => {
    await correoServices.procesarCola()
    const [filtro] = mockCorreos.findOneAndUpdate.mock.calls[0]
    const abandonado = filtro.$or.find((condicion) => condicion.estado === 'enviando')
    expect(Date.now() - abandonado.bloqueado_en.$lt.getTime()).toBeGreaterThanOrEqual(10 * MINUTO - 1000)
  })

  test('procesa como máximo el límite indicado por vuelta', async () => {
    process.env.SMTP_HOST = 'smtp.test'
    for (let i = 0; i < 5; i++) encolar({ _id: `c${i}` })
    expect(await correoServices.procesarCola({ limite: 3 })).toEqual({ enviados: 3, fallidos: 0 })
    expect(mockCorreos.pendientes).toHaveLength(2)
  })
})
