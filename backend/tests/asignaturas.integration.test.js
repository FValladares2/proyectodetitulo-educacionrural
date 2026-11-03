/**
 * Prueba de integración de crear asignaturas, agregar integrantes por lote, los filtros de la
 * lista de asignaturas, el registro de actividad y el cambio de organización, contra un
 * MongoDB real. Se ejecuta solo si MONGO_TEST_URI está definido (ver
 * tests/tareas.integration.test.js).
 */
const MONGO_TEST_URI = process.env.MONGO_TEST_URI
const describeConMongo = MONGO_TEST_URI ? describe : describe.skip

if (MONGO_TEST_URI) {
  process.env.MONGODB_URI = MONGO_TEST_URI
  process.env.MONGODB_DB = `prueba_asignaturas_${Date.now()}`
}

const express = require('express')
const request = require('supertest')
const { ObjectId: mockObjectId } = require('mongodb')

const mockUsuarios = {
  admin: new mockObjectId(),
  docente: new mockObjectId(),
  docente2: new mockObjectId(),
  ana: new mockObjectId(),
  beto: new mockObjectId(),
  externo: new mockObjectId(),
}

// la sesión se simula con "Bearer <usuario>"; se carga el usuario real de la base de datos
jest.mock('../utils/auth', () => {
  const cargar = async (token) => {
    const { collections } = require('../config/mongo')
    return collections.usuarios.findOne({ _id: mockUsuarios[token] })
  }
  return {
    authenticate: async (req, res, next) => {
      req.user = await cargar((req.headers.authorization || '').split(' ')[1])
      next()
    },
    getUserFromToken: jest.fn(cargar),
    createToken: jest.fn(() => 'token-de-prueba'),
  }
})

const mongo = require('../config/mongo')

const app = express()
app.use(express.json())
app.use(require('../routes/apiRoutes'))

// la actividad y las notificaciones se escriben sin esperar a la respuesta de la ruta
const esperarSegundoPlano = () => new Promise((resolve) => setTimeout(resolve, 150))

const como = (usuario) => {
  const auth = (r) => r.set('Authorization', `Bearer ${usuario}`)
  return {
    get: (url) => auth(request(app).get(url)),
    post: (url, body) => auth(request(app).post(url)).send(body),
    put: (url, body) => auth(request(app).put(url)).send(body),
  }
}

describeConMongo('asignaturas, integrantes y actividad (MongoDB real)', () => {
  const u = mockUsuarios
  let ORG
  let OTRA
  let CIENCIAS
  let HISTORIA
  let MATEMATICAS

  // ?id_organizacion=... con los parámetros indicados; devuelve los nombres en orden
  const listar = async (usuario, params = {}) => {
    const query = new URLSearchParams({ id_organizacion: String(ORG), ...params })
    const res = await como(usuario).get(`/api/asign/user?${query}`)
    // body es un getter de la respuesta de supertest: se copia explícitamente
    return { status: res.status, body: res.body, nombres: (res.body.data || []).map((a) => a.nombre) }
  }

  beforeAll(async () => {
    await mongo.connectMongo()
    const { collections } = mongo
    await collections.usuarios.insertMany(
      Object.entries(u).map(([nombre, _id]) => ({ _id, nombre, correo: `${nombre}@prueba.cl` })),
    )
    ORG = (
      await collections.organizaciones.insertOne({
        nombre: 'Escuela Rural',
        usuarios: [u.admin, u.docente, u.docente2, u.ana, u.beto],
        administradores: [u.admin],
        profesores: [u.admin, u.docente, u.docente2],
      })
    ).insertedId
    OTRA = (
      await collections.organizaciones.insertOne({
        nombre: 'Otra escuela',
        usuarios: [u.externo, u.ana],
        administradores: [u.externo],
        profesores: [u.externo],
      })
    ).insertedId
    await collections.usuarios.updateMany({}, { $set: { org_principal: ORG } })

    const crear = async (nombre, datos, dias) =>
      (
        await collections.asignaturas.insertOne({
          nombre,
          id_organizacion: ORG,
          creado_en: new Date(Date.now() - dias * 24 * 60 * 60 * 1000),
          ...datos,
        })
      ).insertedId
    CIENCIAS = await crear('Ciencias', { activo: true, docentes: [u.docente], usuarios: [u.docente, u.ana] }, 3)
    HISTORIA = await crear(
      'Historia (antigua)',
      { activo: false, docentes: [u.docente], usuarios: [u.docente, u.ana] },
      2,
    )
    MATEMATICAS = await crear(
      'Matemáticas',
      { activo: true, docentes: [u.docente2], usuarios: [u.docente2, u.ana, u.beto] },
      1,
    )
  })

  afterAll(async () => {
    if (mongo.isMongoConnected()) {
      await mongo.client.db(process.env.MONGODB_DB).dropDatabase()
    }
    await mongo.client.close()
  })

  describe('crear asignaturas', () => {
    test('rechaza una organización inválida o a quien no pertenece a ella', async () => {
      expect((await como('docente').post('/api/asign/create', { nombre: 'X', id_organizacion: 'no' })).status).toBe(400)
      const externo = await como('externo').post('/api/asign/create', { nombre: 'X', id_organizacion: String(ORG) })
      expect(externo.status).toBe(403)
    })

    test('los alumnos no pueden crear asignaturas', async () => {
      const res = await como('ana').post('/api/asign/create', { nombre: 'Mía', id_organizacion: String(ORG) })
      expect(res.status).toBe(403)
    })

    test('el nombre es obligatorio, se limpia y tiene un largo máximo', async () => {
      const crear = (nombre) => como('docente').post('/api/asign/create', { nombre, id_organizacion: String(ORG) })
      expect((await crear('   ')).status).toBe(400)
      expect((await crear('a'.repeat(121))).status).toBe(400)
      expect((await crear(undefined)).status).toBe(400)
    })

    test('un profesor la crea como su único docente y queda en la actividad', async () => {
      const res = await como('docente').post('/api/asign/create', {
        nombre: '  Lenguaje   y Comunicación ',
        id_organizacion: String(ORG),
      })
      expect(res.status).toBe(200)
      const asignatura = await mongo.collections.asignaturas.findOne({ _id: new mockObjectId(res.body.insertedId) })
      expect(asignatura).toMatchObject({ nombre: 'Lenguaje y Comunicación', activo: true })
      expect(asignatura.docentes.map(String)).toEqual([String(u.docente)])
      expect(asignatura.id_organizacion).toBeInstanceOf(mockObjectId)

      await esperarSegundoPlano()
      const actividad = await mongo.collections.actividad.findOne({ id_asignatura: asignatura._id })
      expect(actividad).toMatchObject({ accion: 'asignatura_creada', detalle: { nombre: 'Lenguaje y Comunicación' } })
    })

    test('los correos iniciales solo agregan a integrantes de la organización, sin duplicar', async () => {
      const res = await como('docente').post('/api/asign/create', {
        nombre: 'Artes',
        id_organizacion: String(ORG),
        correos: ['ana@prueba.cl', 'ANA@prueba.cl', 'externo@prueba.cl', 'nadie@prueba.cl'],
      })
      expect(res.status).toBe(200)
      const artes = await mongo.collections.asignaturas.findOne({ _id: new mockObjectId(res.body.insertedId) })
      expect(artes.usuarios.map(String).sort()).toEqual([String(u.docente), String(u.ana)].sort())

      await esperarSegundoPlano()
      const avisos = await mongo.collections.notificaciones.find({ id_asignatura: artes._id }).toArray()
      expect(avisos.map((n) => String(n.id_usuario))).toEqual([String(u.ana)])
    })
  })

  describe('agregar integrantes por lote', () => {
    const agregar = (quien, id_asignatura, usuarios) =>
      como(quien).post('/api/asign/users/batch', { id_asignatura: String(id_asignatura), usuarios })

    test('valida la solicitud y la asignatura', async () => {
      expect((await agregar('docente', CIENCIAS, [])).status).toBe(400)
      expect((await agregar('docente', new mockObjectId(), [{ _id: String(u.beto), rol: 'alumno' }])).status).toBe(404)
    })

    test('los alumnos no pueden agregar integrantes', async () => {
      expect((await agregar('ana', CIENCIAS, [{ _id: String(u.beto), rol: 'alumno' }])).status).toBe(403)
    })

    test('un docente agrega alumnos y docentes; quien no es de la organización se omite', async () => {
      const res = await agregar('docente', CIENCIAS, [
        { correo: 'beto@prueba.cl', rol: 'alumno' },
        { _id: String(u.docente2), rol: 'profesor' },
        { correo: 'externo@prueba.cl', rol: 'alumno' },
        { correo: 'nadie@prueba.cl', rol: 'alumno' },
      ])
      expect(res.status).toBe(200)
      expect(res.body.total).toBe(2)

      const ciencias = await mongo.collections.asignaturas.findOne({ _id: CIENCIAS })
      expect(ciencias.usuarios.map(String)).toEqual(
        expect.arrayContaining([String(u.beto), String(u.docente2)]),
      )
      expect(ciencias.usuarios.map(String)).not.toContain(String(u.externo))
      expect(ciencias.docentes.map(String).sort()).toEqual([String(u.docente), String(u.docente2)].sort())
    })

    test('agregar a alguien que ya está no lo duplica ni le avisa de nuevo', async () => {
      await esperarSegundoPlano()
      const avisosAntes = await mongo.collections.notificaciones.countDocuments({ id_usuario: u.beto, id_asignatura: CIENCIAS })
      expect(avisosAntes).toBe(1)

      expect((await agregar('docente', CIENCIAS, [{ _id: String(u.beto), rol: 'alumno' }])).status).toBe(200)
      await esperarSegundoPlano()
      const ciencias = await mongo.collections.asignaturas.findOne({ _id: CIENCIAS })
      expect(ciencias.usuarios.filter((id) => String(id) === String(u.beto))).toHaveLength(1)
      expect(await mongo.collections.notificaciones.countDocuments({ id_usuario: u.beto, id_asignatura: CIENCIAS })).toBe(1)
    })

    test('un administrador de la organización agrega aunque no participe (unirse como docente)', async () => {
      const res = await agregar('admin', MATEMATICAS, [{ _id: String(u.admin), rol: 'profesor' }])
      expect(res.status).toBe(200)
      const matematicas = await mongo.collections.asignaturas.findOne({ _id: MATEMATICAS })
      expect(matematicas.docentes.map(String)).toContain(String(u.admin))
    })
  })

  describe('lista de asignaturas', () => {
    test('por defecto muestra solo las activas en las que participa', async () => {
      const { status, nombres } = await listar('ana')
      expect(status).toBe(200)
      expect(nombres).toEqual(expect.arrayContaining(['Ciencias', 'Matemáticas']))
      expect(nombres).not.toContain('Historia (antigua)')
      expect((await listar('externo')).status).toBe(403)
    })

    test('activo vacío incluye las inactivas y activo=false muestra solo esas', async () => {
      expect((await listar('ana', { activo: '' })).nombres).toContain('Historia (antigua)')
      expect((await listar('ana', { activo: 'false' })).nombres).toEqual(['Historia (antigua)'])
    })

    test('soloDocente muestra solo aquellas en las que es docente', async () => {
      const { nombres, body } = await listar('docente2', { soloDocente: 'true', activo: '' })
      expect(nombres.sort()).toEqual(['Ciencias', 'Matemáticas'])
      expect(body.docenteEnAlguna).toBe(true)
      expect((await listar('ana', { soloDocente: 'true' })).nombres).toEqual([])
      expect((await listar('ana')).body.docenteEnAlguna).toBe(false)
    })

    test('todas=true es solo para administradores e incluye las que no participa', async () => {
      const { nombres } = await listar('admin', { todas: 'true', activo: '' })
      expect(nombres).toEqual(expect.arrayContaining(['Ciencias', 'Historia (antigua)', 'Matemáticas']))
      expect((await listar('docente', { todas: 'true' })).status).toBe(403)
    })

    test('la búsqueda trata los caracteres especiales como texto', async () => {
      expect((await listar('ana', { search: '(antigua)', activo: '' })).nombres).toEqual(['Historia (antigua)'])
      expect((await listar('ana', { search: '.*' })).nombres).toEqual([])
      expect((await listar('ana', { search: 'cien' })).nombres).toEqual(['Ciencias'])
    })

    test('ordena por nombre o por fecha de creación', async () => {
      const porNombre = await listar('ana', { activo: '', sortBy: 'nombre', order: 'desc' })
      expect(porNombre.nombres).toEqual([...porNombre.nombres].sort((a, b) => b.localeCompare(a, 'es')))
      const recientes = await listar('ana', { activo: '', sortBy: 'creado_en', order: 'desc' })
      const fijas = recientes.nombres.filter((n) => ['Ciencias', 'Historia (antigua)', 'Matemáticas'].includes(n))
      expect(fijas).toEqual(['Matemáticas', 'Historia (antigua)', 'Ciencias'])
    })
  })

  describe('registro de actividad', () => {
    test('el de una asignatura lo ven sus docentes y los administradores, no los alumnos', async () => {
      const docente = await como('docente').get(`/api/actividad/asignatura/${CIENCIAS}`)
      expect(docente.status).toBe(200)
      expect(docente.body.actividad.map((a) => a.accion)).toContain('usuarios_agregados')
      expect(docente.body.actividad[0].usuario).toHaveProperty('nombre')

      expect((await como('admin').get(`/api/actividad/asignatura/${CIENCIAS}`)).status).toBe(200)
      expect((await como('ana').get(`/api/actividad/asignatura/${CIENCIAS}`)).status).toBe(403)
      expect((await como('docente').get(`/api/actividad/asignatura/${new mockObjectId()}`)).status).toBe(404)
    })

    test('el de la organización solo lo ven sus administradores', async () => {
      await como('admin').put(`/api/org/${ORG}`, { descripcion: 'Escuela multigrado.' })
      await esperarSegundoPlano()
      const admin = await como('admin').get(`/api/actividad/organizacion/${ORG}`)
      expect(admin.status).toBe(200)
      expect(admin.body.actividad.map((a) => a.accion)).toContain('organizacion_editada')
      expect((await como('docente').get(`/api/actividad/organizacion/${ORG}`)).status).toBe(403)
    })

    test('valida los parámetros y pagina hacia atrás', async () => {
      expect((await como('docente').get('/api/actividad/asignatura/no-es-id')).status).toBe(400)
      expect((await como('docente').get(`/api/actividad/asignatura/${CIENCIAS}?antes=ayer`)).status).toBe(400)

      const primera = await como('docente').get(`/api/actividad/asignatura/${CIENCIAS}?limit=1`)
      expect(primera.body.actividad).toHaveLength(1)
      expect(primera.body.siguiente).toBeTruthy()
      const siguiente = await como('docente').get(
        `/api/actividad/asignatura/${CIENCIAS}?limit=1&antes=${encodeURIComponent(primera.body.siguiente)}`,
      )
      expect(siguiente.body.actividad[0]._id).not.toBe(primera.body.actividad[0]._id)
    })
  })

  describe('organizaciones del usuario', () => {
    test('lista sus organizaciones con su rol en cada una, sin las listas de integrantes', async () => {
      const res = await como('ana').get('/api/org/user')
      expect(res.status).toBe(200)
      const porNombre = Object.fromEntries(res.body.map((o) => [o.nombre, o]))
      expect(porNombre['Escuela Rural'].rol).toBe('alumno')
      expect(porNombre['Otra escuela'].rol).toBe('alumno')
      for (const org of res.body) {
        expect(org).not.toHaveProperty('usuarios')
        expect(org).not.toHaveProperty('administradores')
        expect(org).not.toHaveProperty('profesores')
      }
      const admin = await como('admin').get('/api/org/user')
      expect(admin.body.map((o) => o.rol)).toEqual(['admin'])
      const docente = await como('docente').get('/api/org/user')
      expect(docente.body.map((o) => o.rol)).toEqual(['profesor'])
    })

    test('solo cambia a una organización a la que pertenece', async () => {
      expect((await como('ana').put('/api/org/user/update', { id_organizacion: String(OTRA) })).status).toBe(200)
      const ana = await mongo.collections.usuarios.findOne({ _id: u.ana })
      expect(String(ana.org_principal)).toBe(String(OTRA))

      expect((await como('beto').put('/api/org/user/update', { id_organizacion: String(OTRA) })).status).toBe(403)
      expect((await como('beto').put('/api/org/user/update', { id_organizacion: 'no' })).status).toBe(400)
      const beto = await mongo.collections.usuarios.findOne({ _id: u.beto })
      expect(String(beto.org_principal)).toBe(String(ORG))
    })
  })
})
