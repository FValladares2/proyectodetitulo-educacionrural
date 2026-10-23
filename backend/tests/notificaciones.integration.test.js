/**
 * Prueba de integración de notificaciones, cola de correos, recordatorios e invitaciones contra
 * un MongoDB real. Los correos se capturan con un transporte falso. Se ejecuta solo si
 * MONGO_TEST_URI está definido (ver tests/tareas.integration.test.js).
 */
const MONGO_TEST_URI = process.env.MONGO_TEST_URI
const describeConMongo = MONGO_TEST_URI ? describe : describe.skip

if (MONGO_TEST_URI) {
  process.env.MONGODB_URI = MONGO_TEST_URI
  process.env.MONGODB_DB = `prueba_notificaciones_${Date.now()}`
  process.env.APP_URL = 'https://plataforma.test'
  process.env.CORREO_SECRETO = 'secreto-de-prueba'
}

const express = require('express')
const request = require('supertest')
const { ObjectId: mockObjectId } = require('mongodb')

const mockUsuarios = {
  docente: new mockObjectId(),
  ana: new mockObjectId(),
  beto: new mockObjectId(),
}

// la sesión se simula con "Bearer <usuario>"
jest.mock('../utils/auth', () => {
  const usuarioDe = (req) => mockUsuarios[(req.headers.authorization || '').split(' ')[1] || 'docente']
  return {
    authenticate: (req, res, next) => {
      req.user = { _id: usuarioDe(req) }
      next()
    },
    getUserFromToken: jest.fn(async (token) => ({ _id: mockUsuarios[token] })),
    createToken: jest.fn(() => 'token-de-prueba'),
  }
})

const mongo = require('../config/mongo')
const correoServices = require('../services/correoServices')
const notificacionServices = require('../services/notificacionServices')
const { revisarTareasPorCerrar } = require('../services/recordatorioServices')

const app = express()
app.use(express.json())
app.use(require('../routes/classroom/recursoRoutes'))
app.use(require('../routes/classroom/tareaRoutes'))
app.use(require('../routes/user/orgRoutes'))
app.use(require('../routes/user/authRoutes'))
app.use(require('../routes/user/notificacionRoutes'))

const HORA = 60 * 60 * 1000
let enviados = []
let transporteFalla = false
let ID_ASIGNATURA
let ID_ORGANIZACION

const como = (usuario) => {
  const auth = (r) => r.set('Authorization', `Bearer ${usuario}`)
  return {
    get: (url) => auth(request(app).get(url)),
    post: (url, body) => auth(request(app).post(url)).send(body),
    put: (url, body) => auth(request(app).put(url)).send(body),
    subir: (idTarea, nombre = 'respuesta.pdf') =>
      auth(request(app).post('/api/recurso/upload'))
        .field('id_tarea', String(idTarea))
        .attach('file', Buffer.from('respuesta'), { filename: nombre, contentType: 'application/pdf' }),
  }
}

const crearTarea = (titulo, desdeHoras, hastaHoras) =>
  como('docente').post('/api/tarea', {
    id_asignatura: ID_ASIGNATURA,
    titulo,
    apertura: new Date(Date.now() + desdeHoras * HORA).toISOString(),
    limite: new Date(Date.now() + hastaHoras * HORA).toISOString(),
  })

// las notificaciones y correos se crean sin esperar a la respuesta de la ruta
const esperarSegundoPlano = () => new Promise((resolve) => setTimeout(resolve, 150))

const notificacionesDe = (usuario, tipo) =>
  mongo.collections.notificaciones.find({ id_usuario: mockUsuarios[usuario], ...(tipo && { tipo }) }).toArray()

describeConMongo('notificaciones y correos (MongoDB real)', () => {
  beforeAll(async () => {
    await mongo.connectMongo()
    const { collections } = mongo
    await collections.usuarios.insertMany(
      Object.entries(mockUsuarios).map(([nombre, _id]) => ({ _id, nombre, correo: `${nombre}@prueba.cl` })),
    )
    ID_ASIGNATURA = String(
      (
        await collections.asignaturas.insertOne({
          nombre: 'Ciencias',
          docentes: [mockUsuarios.docente],
          usuarios: [mockUsuarios.docente, mockUsuarios.ana, mockUsuarios.beto],
        })
      ).insertedId,
    )
    ID_ORGANIZACION = String(
      (
        await collections.organizaciones.insertOne({
          nombre: 'Escuela Rural Los Aromos',
          admin: [mockUsuarios.docente],
          profesores: [mockUsuarios.docente],
          usuarios: [mockUsuarios.docente, mockUsuarios.ana],
        })
      ).insertedId,
    )
    correoServices.configurarTransporte({
      sendMail: async (mensaje) => {
        if (transporteFalla) throw new Error('proveedor caído')
        enviados.push(mensaje)
        return { messageId: String(enviados.length) }
      },
    })
  })

  beforeEach(async () => {
    enviados = []
    transporteFalla = false
    await mongo.collections.correos.deleteMany({})
  })

  afterAll(async () => {
    if (mongo.isMongoConnected()) {
      await mongo.client.db(process.env.MONGODB_DB).dropDatabase()
    }
    await mongo.client.close()
  })

  test('una tarea nueva avisa a los estudiantes y respeta las preferencias de correo', async () => {
    await como('beto').put('/api/notificaciones/preferencias', { tarea_creada: false })

    const tarea = (await crearTarea('Guía 1', -1, 48)).body
    await esperarSegundoPlano()

    expect(await notificacionesDe('ana', 'tarea_creada')).toHaveLength(1)
    expect(await notificacionesDe('beto', 'tarea_creada')).toHaveLength(1)
    expect(await notificacionesDe('docente', 'tarea_creada')).toHaveLength(0)

    expect(await correoServices.procesarCola()).toEqual({ enviados: 1, fallidos: 0 })
    expect(enviados.map((m) => m.to)).toEqual(['ana@prueba.cl'])
    expect(enviados[0].subject).toBe('Nueva tarea en Ciencias: Guía 1')
    expect(enviados[0].html).toContain(`https://plataforma.test/#/asignaturas/${ID_ASIGNATURA}?tarea=${tarea._id}`)
    expect(enviados[0].text).toContain('/api/notificaciones/desuscribir?')

    // el contenido se borra de la cola una vez enviado
    const [enCola] = await mongo.collections.correos.find().toArray()
    expect(enCola.estado).toBe('enviado')
    expect(enCola).not.toHaveProperty('html')
    expect(enCola).not.toHaveProperty('texto')
  })

  test('la campana lista, cuenta y marca como leídas solo las propias', async () => {
    const lista = await como('ana').get('/api/notificaciones')
    expect(lista.body.noLeidas).toBe(1)
    expect(lista.body.notificaciones[0].ruta).toMatch(/^\/asignaturas\/.+\?tarea=/)

    const ajena = await como('beto').put(`/api/notificaciones/${lista.body.notificaciones[0]._id}/leida`)
    expect(ajena.status).toBe(404)

    const leida = await como('ana').put(`/api/notificaciones/${lista.body.notificaciones[0]._id}/leida`)
    expect(leida.body.noLeidas).toBe(0)
    expect((await como('ana').get('/api/notificaciones/no-leidas')).body.cantidad).toBe(0)

    await como('beto').put('/api/notificaciones/leidas')
    expect((await como('beto').get('/api/notificaciones/no-leidas')).body.cantidad).toBe(0)
  })

  test('las entregas se agrupan para el docente y la calificación avisa sin incluir la nota', async () => {
    const tarea = (await crearTarea('Guía 2', -1, 48)).body
    for (const estudiante of ['ana', 'beto']) {
      await como(estudiante).subir(tarea._id)
      await como(estudiante).post(`/api/tarea/${tarea._id}/entrega`)
    }
    await esperarSegundoPlano()

    const recibidas = await notificacionesDe('docente', 'entrega_recibida')
    expect(recibidas).toHaveLength(1)
    expect(recibidas[0].datos.cantidad).toBe(2)

    await mongo.collections.correos.deleteMany({})
    await como('docente').put(`/api/tarea/${tarea._id}/entregas/${mockUsuarios.ana}`, {
      calificacion: 6.5,
      comentario: 'Muy bien',
    })
    await esperarSegundoPlano()
    expect(await notificacionesDe('ana', 'entrega_calificada')).toHaveLength(1)

    await correoServices.procesarCola()
    expect(enviados).toHaveLength(1)
    expect(enviados[0].to).toBe('ana@prueba.cl')
    expect(enviados[0].text).not.toMatch(/6[.,]5|Muy bien/)
  })

  test('el recordatorio avisa una vez a quien no ha entregado y se reinicia al cambiar el límite', async () => {
    const tarea = (await crearTarea('Guía 3', -1, 12)).body
    await como('ana').subir(tarea._id)
    await como('ana').post(`/api/tarea/${tarea._id}/entrega`)

    expect(await revisarTareasPorCerrar()).toBeGreaterThanOrEqual(1)
    const recordatoriosBeto = () =>
      mongo.collections.notificaciones.countDocuments({
        id_usuario: mockUsuarios.beto,
        tipo: 'tarea_por_cerrar',
        id_tarea: new mockObjectId(tarea._id),
      })
    expect(await recordatoriosBeto()).toBe(1)
    expect(await notificacionesDe('ana', 'tarea_por_cerrar')).toHaveLength(0)

    await revisarTareasPorCerrar()
    expect(await recordatoriosBeto()).toBe(1)

    await como('docente').put(`/api/tarea/${tarea._id}`, {
      limite: new Date(Date.now() + 20 * HORA).toISOString(),
    })
    await revisarTareasPorCerrar()
    expect(await recordatoriosBeto()).toBe(2)
  })

  test('el enlace firmado desactiva un tipo de aviso; uno alterado no', async () => {
    const enlace = new URL(notificacionServices.enlaceDesuscribir(mockUsuarios.ana, 'entrega_calificada'))
    const ruta = `${enlace.pathname}${enlace.search}`

    const alterado = await request(app).get(ruta.replace('entrega_calificada', 'tarea_creada'))
    expect(alterado.status).toBe(400)

    const valido = await request(app).get(ruta)
    expect(valido.status).toBe(200)
    expect(valido.text).toContain('Ya no recibirás')
    expect((await como('ana').get('/api/notificaciones/preferencias')).body).toMatchObject({
      entrega_calificada: false,
      tarea_creada: true,
    })
  })

  test('un correo que falla se reintenta más tarde y, agotados los intentos, se marca fallido', async () => {
    await correoServices.encolarCorreo({ para: 'x@prueba.cl', asunto: 'Prueba', texto: 'hola' })
    transporteFalla = true

    await correoServices.procesarCola()
    let [correo] = await mongo.collections.correos.find().toArray()
    expect(correo).toMatchObject({ estado: 'pendiente', intentos: 1 })
    expect(correo.proximo_intento.getTime()).toBeGreaterThan(Date.now())

    for (let i = 1; i < correoServices.MAX_INTENTOS; i++) {
      await mongo.collections.correos.updateOne({ _id: correo._id }, { $set: { proximo_intento: new Date(0) } })
      await correoServices.procesarCola()
    }
    ;[correo] = await mongo.collections.correos.find().toArray()
    expect(correo).toMatchObject({ estado: 'fallido', intentos: correoServices.MAX_INTENTOS })
    expect(correo).not.toHaveProperty('texto')
  })

  test('los usuarios nuevos reciben una invitación; los existentes, un aviso', async () => {
    const respuesta = await como('docente').post('/api/org/users/batch', {
      id_organizacion: ID_ORGANIZACION,
      usuarios: [
        { correo: 'nueva@prueba.cl', nombre: 'Carla', rol: 'alumno' },
        { correo: 'beto@prueba.cl', rol: 'alumno' },
        { correo: 'ana@prueba.cl', rol: 'alumno' },
      ],
    })
    expect(respuesta.status).toBe(200)
    await esperarSegundoPlano()

    const carla = await mongo.collections.usuarios.findOne({ correo: 'nueva@prueba.cl' })
    expect(carla.passwordHash).toBeNull()
    expect(carla.invitacion.token_hash).toHaveLength(64)
    // beto se agregó; ana ya era integrante, así que no recibe aviso
    expect(await notificacionesDe('beto', 'agregado_organizacion')).toHaveLength(1)
    expect(await notificacionesDe('ana', 'agregado_organizacion')).toHaveLength(0)

    await correoServices.procesarCola()
    const invitacion = enviados.find((m) => m.to === 'nueva@prueba.cl')
    expect(invitacion.subject).toMatch(/Tu cuenta/)
    const token = /change-password\?token=([\w-]+)/.exec(invitacion.text)[1]
    // el token nunca se guarda tal cual
    expect(JSON.stringify(await mongo.collections.usuarios.findOne({ _id: carla._id }))).not.toContain(token)

    const login = () => request(app).post('/api/auth/login').send({ correo: 'nueva@prueba.cl', contrasena: 'clave-segura-1' })
    expect((await login()).status).toBe(401)

    const corta = await request(app).post('/api/auth/establecer-contrasena').send({ token, contrasena: 'corta' })
    expect(corta.status).toBe(400)
    const falsa = await request(app).post('/api/auth/establecer-contrasena').send({ token: 'otro', contrasena: 'clave-segura-1' })
    expect(falsa.status).toBe(400)

    const definida = await request(app).post('/api/auth/establecer-contrasena').send({ token, contrasena: 'clave-segura-1' })
    expect(definida.status).toBe(200)
    expect((await login()).status).toBe(200)

    const reutilizada = await request(app).post('/api/auth/establecer-contrasena').send({ token, contrasena: 'otra-clave-2' })
    expect(reutilizada.status).toBe(400)
  })

  test('una invitación vencida no sirve', async () => {
    const { invitarUsuario } = require('../services/invitacionServices')
    const carla = await mongo.collections.usuarios.findOne({ correo: 'nueva@prueba.cl' })
    await invitarUsuario(carla, { organizacion: 'Escuela' })
    await correoServices.procesarCola()
    const token = /token=([\w-]+)/.exec(enviados.at(-1).text)[1]

    await mongo.collections.usuarios.updateOne({ _id: carla._id }, { $set: { 'invitacion.expira': new Date(Date.now() - 1000) } })
    const vencida = await request(app).post('/api/auth/establecer-contrasena').send({ token, contrasena: 'clave-segura-3' })
    expect(vencida.status).toBe(400)
  })
})
