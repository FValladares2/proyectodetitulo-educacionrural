/**
 * Prueba de integración de tareas y entregas contra un MongoDB real (rutas y servicios reales,
 * solo la autenticación simulada). Se ejecuta solo si MONGO_TEST_URI está definido, por ejemplo:
 *
 *   docker run --rm -d --name mongo-pruebas -p 127.0.0.1:27099:27017 mongo:latest
 *   MONGO_TEST_URI=mongodb://127.0.0.1:27099/ npx jest tests/tareas.integration.test.js
 *
 * Usa una base de datos temporal que se elimina al terminar.
 */
const MONGO_TEST_URI = process.env.MONGO_TEST_URI
const describeConMongo = MONGO_TEST_URI ? describe : describe.skip

if (MONGO_TEST_URI) {
  process.env.MONGODB_URI = MONGO_TEST_URI
  process.env.MONGODB_DB = `prueba_tareas_${Date.now()}`
}

const express = require('express')
const request = require('supertest')
const { ObjectId: mockObjectId } = require('mongodb')

const mockUsuarios = {
  docente: new mockObjectId(),
  ana: new mockObjectId(),
  beto: new mockObjectId(),
  externo: new mockObjectId(),
}

jest.mock('../utils/auth', () => ({
  authenticate: (req, res, next) => {
    req.user = { _id: mockUsuarios[req.headers['x-test-user'] || 'docente'] }
    next()
  },
  getUserFromToken: jest.fn(),
}))

const mongo = require('../config/mongo')
const recursoServices = require('../services/recursoServices')
const recursoRoutes = require('../routes/classroom/recursoRoutes')
const tareaRoutes = require('../routes/classroom/tareaRoutes')

const app = express()
app.use(express.json())
app.use(recursoRoutes)
app.use(tareaRoutes)

const HORA = 60 * 60 * 1000
const archivo = Buffer.from('respuesta del estudiante')
let ID_ASIGNATURA

const como = (usuario) => ({
  get: (url) => request(app).get(url).set('x-test-user', usuario),
  post: (url, body) => request(app).post(url).set('x-test-user', usuario).send(body),
  put: (url, body) => request(app).put(url).set('x-test-user', usuario).send(body),
  delete: (url) => request(app).delete(url).set('x-test-user', usuario),
  subir: (idTarea, nombre = 'respuesta.pdf') =>
    request(app)
      .post('/api/recurso/upload')
      .set('x-test-user', usuario)
      .field('id_tarea', String(idTarea))
      .attach('file', archivo, { filename: nombre, contentType: 'application/pdf' }),
})

const crearTarea = (desdeHoras, hastaHoras, titulo = 'Guía 1') =>
  como('docente').post('/api/tarea', {
    id_asignatura: ID_ASIGNATURA,
    titulo,
    descripcion: 'Responder las preguntas de la guía.',
    apertura: new Date(Date.now() + desdeHoras * HORA).toISOString(),
    limite: new Date(Date.now() + hastaHoras * HORA).toISOString(),
  })

describeConMongo('tareas y entregas (MongoDB real)', () => {
  let abierta

  beforeAll(async () => {
    await mongo.connectMongo()
    const { collections } = mongo
    await collections.usuarios.insertMany(
      Object.entries(mockUsuarios).map(([nombre, _id]) => ({ _id, nombre, correo: `${nombre}@prueba.cl` })),
    )
    const { insertedId } = await collections.asignaturas.insertOne({
      nombre: 'Ciencias',
      docentes: [mockUsuarios.docente],
      usuarios: [mockUsuarios.docente, mockUsuarios.ana, mockUsuarios.beto],
    })
    ID_ASIGNATURA = String(insertedId)
    abierta = (await crearTarea(-1, 24)).body
  })

  afterAll(async () => {
    if (mongo.isMongoConnected()) {
      await mongo.client.db(process.env.MONGODB_DB).dropDatabase()
    }
    await mongo.client.close()
  })

  test('solo los docentes crean tareas y las fechas se validan', async () => {
    expect(abierta.estado).toBe('abierta')
    expect((await crearTarea(-1, 24)).status).toBe(201)

    const alumno = await como('ana').post('/api/tarea', { id_asignatura: ID_ASIGNATURA, titulo: 'x' })
    expect(alumno.status).toBe(403)

    const invertida = await crearTarea(24, -1)
    expect(invertida.status).toBe(400)
  })

  test('los archivos de una entrega son privados y no aparecen en la asignatura', async () => {
    const subida = await como('ana').subir(abierta._id)
    expect(subida.status).toBe(201)
    const idArchivo = subida.body._id

    const listaAsignatura = await como('ana').get(`/api/recurso/asignatura/${ID_ASIGNATURA}`)
    expect(listaAsignatura.body.map((r) => String(r._id))).not.toContain(idArchivo)

    expect((await como('ana').get(`/api/recurso/${idArchivo}/descarga`)).status).toBe(200)
    expect((await como('docente').get(`/api/recurso/${idArchivo}/descarga`)).status).toBe(200)
    expect((await como('beto').get(`/api/recurso/${idArchivo}/descarga`)).status).toBe(403)

    // el mismo nombre en otro estudiante no choca ni revela que existe
    expect((await como('beto').subir(abierta._id)).status).toBe(201)

    // un archivo de entrega no puede usarse como banner de la asignatura
    const banner = await recursoServices.validarImagenBanner(`recurso:${idArchivo}`, { id_asignatura: ID_ASIGNATURA })
    expect(banner.status).toBe(404)
  })

  test('enviar bloquea los archivos; retirar los libera y reenviar crea una entrega nueva', async () => {
    const sinArchivos = await crearTarea(-1, 24, 'Vacía')
    expect((await como('ana').post(`/api/tarea/${sinArchivos.body._id}/entrega`)).status).toBe(400)

    const enviada = await como('ana').post(`/api/tarea/${abierta._id}/entrega`)
    expect(enviada.status).toBe(201)
    expect(enviada.body.archivos).toHaveLength(1)

    const archivoAna = enviada.body.archivos[0]._id
    expect((await como('ana').subir(abierta._id, 'extra.pdf')).status).toBe(409)
    expect((await como('ana').delete(`/api/recurso/${archivoAna}`)).status).toBe(409)
    expect((await como('docente').delete(`/api/recurso/${archivoAna}`)).status).toBe(403)

    expect((await como('ana').delete(`/api/tarea/${abierta._id}/entrega`)).status).toBe(200)
    expect((await como('ana').delete(`/api/tarea/${abierta._id}/entrega`)).status).toBe(404)
    expect((await como('ana').delete(`/api/recurso/${archivoAna}`)).status).toBe(200)
    expect((await como('ana').subir(abierta._id, 'respuesta-v2.pdf')).status).toBe(201)

    const reenviada = await como('ana').post(`/api/tarea/${abierta._id}/entrega`)
    expect(reenviada.status).toBe(201)
    expect(reenviada.body.entrega._id).not.toBe(enviada.body.entrega._id)
    expect(reenviada.body.archivos.map((a) => a.nombre)).toEqual(['respuesta-v2.pdf'])
  })

  test('fuera del plazo no se puede subir, enviar ni retirar', async () => {
    const cerrada = (await crearTarea(-48, -24, 'Cerrada')).body
    const pendiente = (await crearTarea(24, 48, 'Futura')).body
    expect(cerrada.estado).toBe('cerrada')
    expect(pendiente.estado).toBe('pendiente')

    const tarde = await como('ana').subir(cerrada._id)
    expect(tarde.status).toBe(403)
    expect(tarde.body.message).toMatch(/plazo/)
    expect((await como('ana').post(`/api/tarea/${cerrada._id}/entrega`)).status).toBe(403)
    expect((await como('ana').delete(`/api/tarea/${cerrada._id}/entrega`)).status).toBe(403)
    expect((await como('ana').subir(pendiente._id)).status).toBe(403)
  })

  test('quien no pertenece a la asignatura no ve ni entrega', async () => {
    expect((await como('externo').get(`/api/tarea/${abierta._id}`)).status).toBe(403)
    expect((await como('externo').subir(abierta._id)).status).toBe(403)
    expect((await como('externo').get(`/api/tarea/asignatura/${ID_ASIGNATURA}`)).status).toBe(403)
  })

  test('el docente revisa y califica; el estudiante ve solo su calificación', async () => {
    expect((await como('ana').get(`/api/tarea/${abierta._id}/entregas`)).status).toBe(403)

    const entregas = await como('docente').get(`/api/tarea/${abierta._id}/entregas`)
    expect(entregas.status).toBe(200)
    expect(entregas.body.map((e) => e.usuario.nombre)).toEqual(['ana'])
    expect(entregas.body[0].archivos[0]).not.toHaveProperty('recurso')

    const nota = await como('docente').put(`/api/tarea/${abierta._id}/entregas/${mockUsuarios.ana}`, {
      calificacion: 6.5,
      comentario: 'Buen trabajo',
    })
    expect(nota.status).toBe(200)
    expect((await como('ana').put(`/api/tarea/${abierta._id}/entregas/${mockUsuarios.ana}`, { calificacion: 7 })).status).toBe(403)
    expect((await como('docente').put(`/api/tarea/${abierta._id}/entregas/${mockUsuarios.beto}`, { calificacion: 5 })).status).toBe(404)
    expect((await como('docente').put(`/api/tarea/${abierta._id}/entregas/${mockUsuarios.ana}`, { calificacion: 'siete' })).status).toBe(400)

    const propia = await como('ana').get(`/api/tarea/${abierta._id}/mi-entrega`)
    expect(propia.body.entrega).toMatchObject({ calificacion: 6.5, comentario: 'Buen trabajo' })
    expect(propia.body.puedeEditarArchivos).toBe(false)

    const lista = await como('docente').get(`/api/tarea/asignatura/${ID_ASIGNATURA}`)
    expect(lista.body.find((t) => t._id === abierta._id).entregas).toBe(1)
    const listaAna = await como('ana').get(`/api/tarea/asignatura/${ID_ASIGNATURA}`)
    expect(listaAna.body.find((t) => t._id === abierta._id).enviada_en).toBeTruthy()
    expect(listaAna.body[0]).not.toHaveProperty('descripcion')
  })

  test('eliminar una tarea elimina sus entregas y archivos', async () => {
    const { collections } = mongo
    expect((await como('ana').delete(`/api/tarea/${abierta._id}`)).status).toBe(403)
    expect((await como('docente').delete(`/api/tarea/${abierta._id}`)).status).toBe(200)

    expect(await collections.tareas.countDocuments({ _id: new mockObjectId(abierta._id) })).toBe(0)
    expect(await collections.entregas.countDocuments({ id_tarea: new mockObjectId(abierta._id) })).toBe(0)
    expect(await collections.recursos.countDocuments({ id_tarea: abierta._id })).toBe(0)
  })
})
