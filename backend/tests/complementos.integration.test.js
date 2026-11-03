/**
 * Casos complementarios contra un MongoDB real: banners, ver una asignatura, recursos de la
 * organización, validaciones de rutas de tareas, registro e invitaciones, agrupación de la
 * actividad, recordatorios en asignaturas inactivas y fallos parciales de la plantilla del
 * tutorial. Se ejecuta solo si MONGO_TEST_URI está definido (ver tests/tareas.integration.test.js).
 */
const MONGO_TEST_URI = process.env.MONGO_TEST_URI
const describeConMongo = MONGO_TEST_URI ? describe : describe.skip

if (MONGO_TEST_URI) {
  process.env.MONGODB_URI = MONGO_TEST_URI
  process.env.MONGODB_DB = `prueba_complementos_${Date.now()}`
}

const fs = require('fs')
const os = require('os')
const path = require('path')
const express = require('express')
const request = require('supertest')
const { ObjectId: mockObjectId } = require('mongodb')

const mockUsuarios = {
  admin: new mockObjectId(),
  docente: new mockObjectId(),
  ana: new mockObjectId(),
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
const actividadServices = require('../services/actividadServices')
const { revisarTareasPorCerrar } = require('../services/recordatorioServices')
const { crearAsignaturaTutorial } = require('../services/tutorialServices')

const app = express()
app.use(express.json())
app.use(require('../routes/apiRoutes'))

const HORA = 60 * 60 * 1000
const esperarSegundoPlano = () => new Promise((resolve) => setTimeout(resolve, 150))
// los primeros bytes de un PNG bastan: el tipo lo da el content-type de la subida
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

const como = (usuario) => {
  const auth = (r) => r.set('Authorization', `Bearer ${usuario}`)
  return {
    get: (url) => auth(request(app).get(url)),
    post: (url, body) => auth(request(app).post(url)).send(body),
    put: (url, body) => auth(request(app).put(url)).send(body),
    subir: (campos, nombre, contenido = PNG, contentType = 'image/png') => {
      let r = auth(request(app).post('/api/recurso/upload'))
      for (const [k, v] of Object.entries(campos)) r = r.field(k, String(v))
      return r.attach('file', contenido, { filename: nombre, contentType })
    },
  }
}

describeConMongo('casos complementarios (MongoDB real)', () => {
  const u = mockUsuarios
  let ORG
  let CIENCIAS
  let HISTORIA

  beforeAll(async () => {
    await mongo.connectMongo()
    const { collections } = mongo
    await collections.usuarios.insertMany(
      Object.entries(u).map(([nombre, _id]) => ({ _id, nombre, correo: `${nombre}@prueba.cl` })),
    )
    ORG = (
      await collections.organizaciones.insertOne({
        nombre: 'Escuela Rural',
        usuarios: [u.admin, u.docente, u.ana],
        administradores: [u.admin],
        profesores: [u.admin, u.docente],
      })
    ).insertedId
    CIENCIAS = (
      await collections.asignaturas.insertOne({
        nombre: 'Ciencias',
        id_organizacion: ORG,
        activo: true,
        docentes: [u.docente],
        usuarios: [u.docente, u.ana],
      })
    ).insertedId
    HISTORIA = (
      await collections.asignaturas.insertOne({
        nombre: 'Historia',
        id_organizacion: ORG,
        activo: true,
        docentes: [u.docente],
        usuarios: [u.docente, u.ana],
        formato_markup: '# Historia',
      })
    ).insertedId
  })

  afterAll(async () => {
    if (mongo.isMongoConnected()) {
      await mongo.client.db(process.env.MONGODB_DB).dropDatabase()
    }
    await mongo.client.close()
  })

  describe('banners', () => {
    let imagenOrg
    let imagenCiencias
    let pdfCiencias

    beforeAll(async () => {
      imagenOrg = (await como('admin').subir({ id_organizacion: ORG }, 'banner.png')).body._id
      imagenCiencias = (await como('docente').subir({ id_asignatura: CIENCIAS }, 'portada.png')).body._id
      pdfCiencias = (
        await como('docente').subir({ id_asignatura: CIENCIAS }, 'guia.pdf', Buffer.from('%PDF'), 'application/pdf')
      ).body._id
    })

    test('un administrador cambia y quita el banner de la organización', async () => {
      const res = await como('admin').put(`/api/org/${ORG}/img`, { img: `recurso:${imagenOrg}` })
      expect(res.status).toBe(200)
      expect((await mongo.collections.organizaciones.findOne({ _id: ORG })).img).toBe(`recurso:${imagenOrg}`)

      expect((await como('admin').put(`/api/org/${ORG}/img`, { img: null })).body).toEqual({ img: null })
      await esperarSegundoPlano()
      const acciones = (await mongo.collections.actividad.find({ id_organizacion: ORG }).toArray()).map((a) => a.accion)
      expect(acciones).toEqual(expect.arrayContaining(['banner_cambiado', 'banner_quitado']))
    })

    test('solo administradores y solo imágenes de la propia organización', async () => {
      expect((await como('docente').put(`/api/org/${ORG}/img`, { img: `recurso:${imagenOrg}` })).status).toBe(403)
      expect((await como('admin').put(`/api/org/${ORG}/img`, { img: `recurso:${imagenCiencias}` })).status).toBe(404)
      expect((await como('admin').put(`/api/org/${ORG}/img`, { img: 'https://otro.sitio/img.png' })).status).toBe(400)
      expect((await como('admin').put('/api/org/no-es-id/img', { img: null })).status).toBe(400)
    })

    test('el banner de una asignatura es una imagen de esa misma asignatura', async () => {
      expect((await como('docente').put(`/api/asign/${CIENCIAS}/img`, { img: `recurso:${imagenCiencias}` })).status).toBe(200)
      expect((await como('docente').put(`/api/asign/${CIENCIAS}/img`, { img: `recurso:${pdfCiencias}` })).status).toBe(400)
      expect((await como('docente').put(`/api/asign/${HISTORIA}/img`, { img: `recurso:${imagenCiencias}` })).status).toBe(404)
      expect((await como('ana').put(`/api/asign/${CIENCIAS}/img`, { img: null })).status).toBe(403)
    })
  })

  describe('recursos de la organización', () => {
    test('los ven sus integrantes; los suben solo los administradores', async () => {
      const lista = await como('ana').get(`/api/recurso/organizacion/${ORG}`)
      expect(lista.status).toBe(200)
      expect(lista.body.map((r) => r.nombre)).toContain('banner.png')
      expect(lista.body[0]).not.toHaveProperty('recurso')

      expect((await como('externo').get(`/api/recurso/organizacion/${ORG}`)).status).toBe(403)
      expect((await como('ana').get('/api/recurso/organizacion/no-es-id')).status).toBe(400)
      expect((await como('docente').subir({ id_organizacion: ORG }, 'otro.png')).status).toBe(403)
    })

    test('descargar un recurso sin contenido responde 404', async () => {
      const { insertedId } = await mongo.collections.recursos.insertOne({
        id_organizacion: ORG,
        nombre: 'vacio.txt',
        id_usuario: u.admin,
      })
      expect((await como('ana').get(`/api/recurso/${insertedId}/descarga`)).status).toBe(404)
    })
  })

  describe('ver una asignatura', () => {
    test('quien no participa no puede verla', async () => {
      expect((await como('externo').get(`/api/asign/${CIENCIAS}`)).status).toBe(403)
    })

    test('sin contenido se le asigna uno inicial y se registra el acceso', async () => {
      const res = await como('ana').get(`/api/asign/${CIENCIAS}`)
      expect(res.status).toBe(200)
      expect(res.body.formato_markup).toMatch(/^# Ciencias/)
      expect((await mongo.collections.asignaturas.findOne({ _id: CIENCIAS })).formato_markup).toBe(res.body.formato_markup)

      await esperarSegundoPlano()
      const acceso = await mongo.collections.accesos.findOne({ id_asignatura: CIENCIAS, id_usuario: u.ana })
      expect(acceso.ultimo_acceso).toBeInstanceOf(Date)
    })

    test('un administrador que no participa puede configurarla', async () => {
      expect((await como('admin').get(`/api/asign/${HISTORIA}/config`)).status).toBe(200)
      const res = await como('admin').put(`/api/asign/${HISTORIA}/config`, { nombre: 'Historia y Geografía' })
      expect(res.body.nombre).toBe('Historia y Geografía')
    })
  })

  describe('validaciones de rutas', () => {
    test('una tarea con id inválido responde 400 y una inexistente 404', async () => {
      expect((await como('docente').get('/api/tarea/no-es-id')).status).toBe(400)
      expect((await como('docente').get(`/api/tarea/${new mockObjectId()}`)).status).toBe(404)
      expect((await como('docente').put(`/api/tarea/${new mockObjectId()}`, { titulo: 'x' })).status).toBe(404)
    })

    test('el registro exige todos los campos y un correo no usado', async () => {
      const registrar = (datos) => request(app).post('/api/auth/register').send(datos)
      const completo = { nombre: 'Nueva', correo: 'nueva@prueba.cl', contrasena: 'contrasena-segura', nombre_organizacion: 'Escuela' }
      for (const campo of Object.keys(completo)) {
        expect((await registrar({ ...completo, [campo]: undefined })).status).toBe(400)
      }
      expect((await registrar({ ...completo, correo: 'ANA@prueba.cl' })).status).toBe(409)
    })

    test('definir la contraseña exige 8 caracteres y un enlace válido', async () => {
      const definir = (token, contrasena) => request(app).post('/api/auth/establecer-contrasena').send({ token, contrasena })
      expect((await definir('cualquiera', 'corta')).status).toBe(400)
      expect((await definir(undefined, 'contrasena-segura')).status).toBe(400)
      const invalido = await definir('token-que-no-existe', 'contrasena-segura')
      expect(invalido.status).toBe(400)
      expect(invalido.body.message).toMatch(/no es válido o ya venció/)
    })

    test('las notificaciones rechazan una fecha "antes" inválida', async () => {
      expect((await como('ana').get('/api/notificaciones?antes=ayer')).status).toBe(400)
      expect((await como('ana').get('/api/notificaciones?limit=5')).status).toBe(200)
    })
  })

  describe('registro de actividad', () => {
    test('editar el contenido varias veces seguidas queda como una sola entrada', async () => {
      await como('docente').put(`/api/asign/${HISTORIA}`, { formato_markup: '# Historia\n\nUno' })
      await esperarSegundoPlano()
      await como('docente').put(`/api/asign/${HISTORIA}`, { formato_markup: '# Historia\n\nDos' })
      await esperarSegundoPlano()
      const ediciones = await mongo.collections.actividad.countDocuments({ id_asignatura: HISTORIA, accion: 'markup_editado' })
      expect(ediciones).toBe(1)
    })

    test('una entrada sin contenedor o con una acción desconocida no se guarda', async () => {
      const consola = jest.spyOn(console, 'error').mockImplementation(() => {})
      expect(await actividadServices.registrarActividad({ contenedor: {}, id_usuario: u.ana, accion: 'markup_editado' })).toBeNull()
      expect(
        await actividadServices.registrarActividad({ contenedor: { id_asignatura: CIENCIAS }, id_usuario: u.ana, accion: 'inventada' }),
      ).toBeNull()
      expect(consola).toHaveBeenCalledTimes(2)
      consola.mockRestore()
    })
  })

  describe('recordatorios', () => {
    test('una tarea por cerrar en una asignatura inactiva no avisa, pero queda marcada', async () => {
      const { insertedId: inactiva } = await mongo.collections.asignaturas.insertOne({
        nombre: 'Taller cerrado',
        id_organizacion: ORG,
        activo: false,
        docentes: [u.docente],
        usuarios: [u.docente, u.ana],
      })
      const { insertedId: tarea } = await mongo.collections.tareas.insertOne({
        id_asignatura: inactiva,
        titulo: 'Última guía',
        apertura: new Date(Date.now() - HORA),
        limite: new Date(Date.now() + 6 * HORA),
      })

      await revisarTareasPorCerrar()
      expect(await mongo.collections.notificaciones.countDocuments({ id_tarea: tarea })).toBe(0)
      expect((await mongo.collections.tareas.findOne({ _id: tarea })).recordatorio_enviado).toBe(true)
    })
  })

  describe('plantilla del tutorial con fallos parciales', () => {
    let carpeta

    beforeAll(() => {
      carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'tutorial-'))
      fs.mkdirSync(path.join(carpeta, 'tutorial'))
      fs.writeFileSync(path.join(carpeta, 'tutorial', 'existe.png'), PNG)
      // un archivo sobre el máximo de subida
      fs.writeFileSync(path.join(carpeta, 'tutorial', 'grande.png'), Buffer.alloc(10 * 1024 * 1024 + 1))
      fs.writeFileSync(
        path.join(carpeta, 'tutorial', 'tareas.json'),
        JSON.stringify({ valida: { titulo: 'Tarea válida', dias_abierta: 7 }, sin_titulo: { titulo: '' } }),
      )
      fs.writeFileSync(
        path.join(carpeta, 'plantilla.md'),
        [
          '<!-- notas -->',
          '# Tutorial de prueba',
          '![a](plantilla:existe.png) ![b](plantilla:falta.png) ![c](plantilla:grande.png)',
          '[1](plantilla-tarea:valida) [2](plantilla-tarea:sin_titulo) [3](plantilla-tarea:no_definida)',
        ].join('\n'),
      )
      process.env.TUTORIAL_PLANTILLA = path.join(carpeta, 'plantilla.md')
    })

    afterAll(() => {
      delete process.env.TUTORIAL_PLANTILLA
      fs.rmSync(carpeta, { recursive: true, force: true })
    })

    test('crea lo que puede y deja sin reemplazar lo que falta, sin fallar', async () => {
      const consola = jest.spyOn(console, 'error').mockImplementation(() => {})
      const id = await crearAsignaturaTutorial(u.admin, ORG)
      consola.mockRestore()
      expect(id).toBeInstanceOf(mockObjectId)

      const tutorial = await mongo.collections.asignaturas.findOne({ _id: id })
      expect(tutorial.nombre).toBe('Tutorial de prueba')
      expect(tutorial.formato_markup).not.toContain('<!--')
      expect(tutorial.formato_markup).toMatch(/!\[a\]\(recurso:[0-9a-f]{24}\)/)
      expect(tutorial.formato_markup).toContain('plantilla:falta.png')
      expect(tutorial.formato_markup).toContain('plantilla:grande.png')
      expect(tutorial.formato_markup).toMatch(/\[1\]\(tarea:[0-9a-f]{24}\)/)
      expect(tutorial.formato_markup).toContain('plantilla-tarea:sin_titulo')
      expect(tutorial.formato_markup).toContain('plantilla-tarea:no_definida')

      const recursos = await mongo.collections.recursos.find({ id_asignatura: id }).toArray()
      expect(recursos.map((r) => r.nombre)).toEqual(['existe.png'])
      const tareas = await mongo.collections.tareas.find({ id_asignatura: id }).toArray()
      expect(tareas.map((t) => t.titulo)).toEqual(['Tarea válida'])
      expect(tareas[0].limite.getTime() - tareas[0].apertura.getTime()).toBe(7 * 24 * HORA)
    })
  })
})
