/**
 * Prueba de integración de quitar integrantes de asignaturas y organizaciones contra un MongoDB
 * real. Se ejecuta solo si MONGO_TEST_URI está definido (ver tests/tareas.integration.test.js).
 */
const MONGO_TEST_URI = process.env.MONGO_TEST_URI
const describeConMongo = MONGO_TEST_URI ? describe : describe.skip

if (MONGO_TEST_URI) {
  process.env.MONGODB_URI = MONGO_TEST_URI
  process.env.MONGODB_DB = `prueba_membresia_${Date.now()}`
}

const express = require('express')
const request = require('supertest')
const { ObjectId: mockObjectId } = require('mongodb')

const mockUsuarios = {
  admin: new mockObjectId(),
  admin2: new mockObjectId(),
  docente: new mockObjectId(),
  docente2: new mockObjectId(),
  ana: new mockObjectId(),
  beto: new mockObjectId(),
}

// la sesión se simula con "Bearer <usuario>"
jest.mock('../utils/auth', () => {
  const usuarioDe = (token) => ({ _id: mockUsuarios[token] })
  return {
    authenticate: (req, res, next) => {
      req.user = usuarioDe((req.headers.authorization || '').split(' ')[1])
      next()
    },
    getUserFromToken: jest.fn(async (token) => usuarioDe(token)),
    createToken: jest.fn(() => 'token-de-prueba'),
  }
})

const mongo = require('../config/mongo')
const userServices = require('../services/userServices')

const app = express()
app.use(express.json())
app.use(require('../routes/classroom/asignRoutes'))
app.use(require('../routes/user/orgRoutes'))
app.use(require('../routes/user/authRoutes'))

const como = (usuario) => {
  const auth = (r) => r.set('Authorization', `Bearer ${usuario}`)
  return {
    get: (url) => auth(request(app).get(url)),
    post: (url, body) => auth(request(app).post(url)).send(body),
    delete: (url) => auth(request(app).delete(url)),
  }
}

describeConMongo('quitar integrantes (MongoDB real)', () => {
  let ORG
  let OTRA_ORG
  let CIENCIAS
  let HISTORIA
  const u = mockUsuarios

  beforeAll(async () => {
    await mongo.connectMongo()
    const { collections } = mongo
    const hash_contrasena = await userServices.hashPassword('contrasena-segura')
    await collections.usuarios.insertMany(
      Object.entries(u).map(([nombre, _id]) => ({ _id, nombre, correo: `${nombre}@prueba.cl`, hash_contrasena })),
    )
    ORG = (
      await collections.organizaciones.insertOne({
        nombre: 'Escuela Rural',
        usuarios: Object.values(u),
        administradores: [u.admin, u.admin2],
        profesores: [u.admin, u.admin2, u.docente, u.docente2],
      })
    ).insertedId
    // docente2 también pertenece a otra organización, así que no se desactiva al quitarlo
    OTRA_ORG = (
      await collections.organizaciones.insertOne({
        nombre: 'Otra escuela',
        usuarios: [u.docente2],
        administradores: [],
        profesores: [u.docente2],
      })
    ).insertedId
    await collections.usuarios.updateMany({}, { $set: { org_principal: ORG } })
    CIENCIAS = (
      await collections.asignaturas.insertOne({
        nombre: 'Ciencias',
        id_organizacion: ORG,
        docentes: [u.docente, u.docente2],
        usuarios: [u.docente, u.docente2, u.ana, u.beto],
      })
    ).insertedId
    HISTORIA = (
      await collections.asignaturas.insertOne({
        nombre: 'Historia',
        id_organizacion: ORG,
        docentes: [u.docente],
        usuarios: [u.docente, u.ana],
      })
    ).insertedId
    await collections.accesos.insertOne({ id_usuario: u.ana, id_asignatura: CIENCIAS, ultimo_acceso: new Date() })
  })

  afterAll(async () => {
    if (mongo.isMongoConnected()) {
      await mongo.client.db(process.env.MONGODB_DB).dropDatabase()
    }
    await mongo.client.close()
  })

  test('el último acceso solo lo ven quienes administran la asignatura', async () => {
    const docente = await como('docente').get(`/api/asign/${CIENCIAS}/users`)
    expect(docente.body.puedeQuitar).toBe(true)
    expect(docente.body.users.find((x) => x.nombre === 'ana').ultimo_acceso).toBeTruthy()

    const alumno = await como('ana').get(`/api/asign/${CIENCIAS}/users`)
    expect(alumno.body.puedeQuitar).toBe(false)
    expect(alumno.body.users[0]).not.toHaveProperty('ultimo_acceso')
  })

  test('la última conexión de la organización solo la ven los administradores', async () => {
    await mongo.collections.usuarios.updateOne({ _id: u.ana }, { $set: { ultima_conexion: new Date() } })
    const admin = await como('admin').get(`/api/users/batch/${ORG}`)
    expect(admin.body.users.find((x) => x.nombre === 'ana').ultima_conexion).toBeTruthy()
    const alumno = await como('ana').get(`/api/users/batch/${ORG}`)
    expect(alumno.body.users.find((x) => x.nombre === 'ana')).not.toHaveProperty('ultima_conexion')
  })

  test('los administradores ven todas las asignaturas y sus integrantes, pero no su contenido', async () => {
    const propias = await como('admin').get(`/api/asign/user?id_organizacion=${ORG}`)
    expect(propias.body.total).toBe(0)
    const todas = await como('admin').get(`/api/asign/user?id_organizacion=${ORG}&todas=true`)
    expect(todas.body.data.map((a) => a.nombre).sort()).toEqual(['Ciencias', 'Historia'])
    expect((await como('docente').get(`/api/asign/user?id_organizacion=${ORG}&todas=true`)).status).toBe(403)

    const integrantes = await como('admin').get(`/api/asign/${HISTORIA}/users`)
    expect(integrantes.status).toBe(200)
    expect(integrantes.body).toMatchObject({ esIntegrante: false, puedeAgregar: true, nombre: 'Historia' })
    expect((await como('admin').get(`/api/asign/${HISTORIA}`)).status).toBe(403)
    expect((await como('beto').get(`/api/asign/${HISTORIA}/users`)).status).toBe(403)
  })

  test('en una asignatura quitan docentes y administradores, nunca al último docente', async () => {
    expect((await como('ana').delete(`/api/asign/${CIENCIAS}/users/${u.beto}`)).status).toBe(403)

    expect((await como('docente').delete(`/api/asign/${CIENCIAS}/users/${u.ana}`)).status).toBe(200)
    const ciencias = await mongo.collections.asignaturas.findOne({ _id: CIENCIAS })
    expect(ciencias.usuarios.map(String)).not.toContain(String(u.ana))
    expect(await mongo.collections.accesos.countDocuments({ id_usuario: u.ana, id_asignatura: CIENCIAS })).toBe(0)

    // un administrador de la organización puede aunque no sea integrante
    expect((await como('admin').delete(`/api/asign/${CIENCIAS}/users/${u.beto}`)).status).toBe(200)

    // un docente puede salir si queda otro; el último no
    expect((await como('docente2').delete(`/api/asign/${CIENCIAS}/users/${u.docente2}`)).status).toBe(200)
    const ultimo = await como('docente').delete(`/api/asign/${CIENCIAS}/users/${u.docente}`)
    expect(ultimo.status).toBe(409)
    expect(ultimo.body.message).toMatch(/único docente/)

    expect((await como('docente').delete(`/api/asign/${CIENCIAS}/users/${u.beto}`)).status).toBe(404)
    const quedan = await mongo.collections.asignaturas.findOne({ _id: CIENCIAS })
    expect(quedan.docentes.map(String)).toEqual([String(u.docente)])
  })

  test('en la organización solo quitan administradores, y nunca al último', async () => {
    expect((await como('docente').delete(`/api/org/${ORG}/users/${u.beto}`)).status).toBe(403)

    // un administrador puede salir si queda otro
    expect((await como('admin2').delete(`/api/org/${ORG}/users/${u.admin2}`)).status).toBe(200)
    const ultimo = await como('admin').delete(`/api/org/${ORG}/users/${u.admin}`)
    expect(ultimo.status).toBe(409)
    expect(ultimo.body.message).toMatch(/único administrador/)
  })

  test('quitar de la organización lo quita de sus asignaturas y transfiere las que quedarían sin docente', async () => {
    const res = await como('admin').delete(`/api/org/${ORG}/users/${u.docente}`)
    expect(res.status).toBe(200)
    expect(res.body.asignaturasTransferidas.sort()).toEqual(['Ciencias', 'Historia'])
    expect(res.body.cuentaDesactivada).toBe(true)

    const asignaturas = await mongo.collections.asignaturas.find({ id_organizacion: ORG }).toArray()
    for (const asignatura of asignaturas) {
      expect(asignatura.usuarios.map(String)).not.toContain(String(u.docente))
      expect(asignatura.docentes.map(String)).toEqual([String(u.admin)])
    }
    const org = await mongo.collections.organizaciones.findOne({ _id: ORG })
    expect(org.usuarios.map(String)).not.toContain(String(u.docente))
    expect(org.profesores.map(String)).not.toContain(String(u.docente))
  })

  test('quien pertenece a otra organización no se desactiva y cambia de organización principal', async () => {
    const res = await como('admin').delete(`/api/org/${ORG}/users/${u.docente2}`)
    expect(res.status).toBe(200)
    expect(res.body.cuentaDesactivada).toBe(false)
    const docente2 = await mongo.collections.usuarios.findOne({ _id: u.docente2 })
    expect(docente2.desactivado_en).toBeUndefined()
    expect(String(docente2.org_principal)).toBe(String(OTRA_ORG))
  })

  test('una cuenta desactivada no inicia sesión hasta que una organización la vuelve a agregar', async () => {
    const login = () => request(app).post('/api/auth/login').send({ correo: 'docente@prueba.cl', contrasena: 'contrasena-segura' })

    const bloqueado = await login()
    expect(bloqueado.status).toBe(403)
    expect(bloqueado.body.codigo).toBe('cuenta_desactivada')
    // con una contraseña incorrecta no se revela que la cuenta está desactivada
    const incorrecta = await request(app).post('/api/auth/login').send({ correo: 'docente@prueba.cl', contrasena: 'otra' })
    expect(incorrecta.status).toBe(401)

    const agregar = await como('admin').post('/api/org/users/batch', {
      id_organizacion: String(ORG),
      usuarios: [{ correo: 'docente@prueba.cl', rol: 'profesor' }],
    })
    expect(agregar.status).toBe(200)
    const reactivado = await login()
    expect(reactivado.status).toBe(200)
    expect(String(reactivado.body.user.org_principal)).toBe(String(ORG))
  })

  test('un administrador no puede salir si es el único docente de alguna asignatura', async () => {
    await mongo.collections.organizaciones.updateOne({ _id: ORG }, { $addToSet: { administradores: u.admin2, usuarios: u.admin2 } })
    const res = await como('admin').delete(`/api/org/${ORG}/users/${u.admin}`)
    expect(res.status).toBe(409)
    expect(res.body.message).toMatch(/Ciencias/)
  })
})
