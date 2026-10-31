const express = require('express')
const request = require('supertest')
const { ObjectId: mockObjectId } = require('mongodb')

const mockDocenteId = new mockObjectId()
const mockAlumnoId = new mockObjectId()
const mockExternoId = new mockObjectId()
const ASIGNATURA_ID = new mockObjectId().toString()
const ORGANIZACION_ID = new mockObjectId().toString()

// almacenamiento en memoria en lugar de mongo
const mockDb = new Map()

jest.mock('../utils/auth', () => ({
  authenticate: (req, res, next) => {
    const usuarios = { alumno: mockAlumnoId, externo: mockExternoId }
    req.user = { _id: usuarios[req.headers['x-test-user']] || mockDocenteId }
    next()
  },
  getUserFromToken: jest.fn(),
}))

jest.mock('../services/asignServices', () => ({
  findDocenteInAsign: jest.fn(async (id_asignatura, id_usuario) => String(id_usuario) === String(mockDocenteId)),
  findUsuarioInAsign: jest.fn(async () => true),
}))

// el docente es administrador de la organización, el alumno solo integrante y el externo no pertenece
jest.mock('../services/orgServices', () => ({
  findAdminInOrg: jest.fn(async (id_organizacion, id_usuario) => String(id_usuario) === String(mockDocenteId)),
  findUserInOrg: jest.fn(async (id_organizacion, id_usuario) => String(id_usuario) !== String(mockExternoId)),
}))

jest.mock('../services/recursoServices', () => {
  const actual = jest.requireActual('../services/recursoServices')
  return {
    ...actual,
    createRecurso: jest.fn(async (doc) => {
      const _id = new mockObjectId()
      mockDb.set(String(_id), { _id, ...doc })
      return { insertedId: _id }
    }),
    findRecursoById: jest.fn(async (id) => mockDb.get(String(id)) || null),
    existeNombreEnContenedor: jest.fn(async (contenedor, nombre, excluirId) =>
      [...mockDb.values()].some(
        (d) =>
          // los contenedores guardan ObjectId: se comparan por su valor
          Object.entries(contenedor).every(([campo, valor]) => String(d[campo]) === String(valor)) &&
          d.nombre === nombre &&
          String(d._id) !== String(excluirId),
      ),
    ),
    findRecursosByOrganizacion: jest.fn(async (id_organizacion) =>
      // igual que la proyección real, sin el contenido cifrado
      [...mockDb.values()]
        .filter((d) => String(d.id_organizacion) === String(id_organizacion))
        .map(({ recurso, ...metadatos }) => metadatos),
    ),
    updateRecurso: jest.fn(async (id, campos) => {
      mockDb.set(String(id), { ...mockDb.get(String(id)), ...campos })
      return { matchedCount: 1 }
    }),
    deleteRecurso: jest.fn(async (id) => mockDb.delete(String(id))),
  }
})

jest.mock('../services/actividadServices', () => ({
  ACCIONES: jest.requireActual('../services/actividadServices').ACCIONES,
  registrarActividad: jest.fn(async () => null),
}))
const { ACCIONES, registrarActividad: mockRegistrarActividad } = require('../services/actividadServices')

const recursoRoutes = require('../routes/classroom/recursoRoutes')

const app = express()
app.use(express.json())
app.use(recursoRoutes)

// bytes que no son utf8 válido, para detectar corrupción de binarios
const binario = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0xff, 0xfe, 0x80, 0xc3, 0x28])

const subir = (nombre, usuario = 'docente', campo = 'id_asignatura', id = ASIGNATURA_ID) =>
  request(app)
    .post('/api/recurso/upload')
    .set('x-test-user', usuario)
    .field(campo, id)
    .attach('file', binario, { filename: nombre, contentType: 'image/png' })

const subirAOrganizacion = (nombre, usuario = 'docente') =>
  subir(nombre, usuario, 'id_organizacion', ORGANIZACION_ID)

describe('Rutas de recursos (archivos)', () => {
  beforeEach(() => {
    mockDb.clear()
    mockRegistrarActividad.mockClear()
  })

  test('sube un archivo cifrado, conserva tildes en el nombre y no devuelve el contenido', async () => {
    const res = await subir('Guía de evaluación ñandú.png')

    expect(res.status).toBe(201)
    expect(res.body.nombre).toBe('Guía de evaluación ñandú.png')
    expect(res.body.tamano).toBe(binario.length)
    expect(res.body).not.toHaveProperty('recurso')

    const guardado = mockDb.get(res.body._id)
    expect(guardado.recurso).toHaveProperty('ciphertext')
    expect(guardado.codificacion).toBe('base64')
  })

  test('la descarga devuelve exactamente los mismos bytes subidos', async () => {
    const { body } = await subir('imagen.png')

    const res = await request(app)
      .get(`/api/recurso/${body._id}/descarga`)
      .buffer(true)
      .parse((r, cb) => {
        const partes = []
        r.on('data', (c) => partes.push(c))
        r.on('end', () => cb(null, Buffer.concat(partes)))
      })

    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('image/png')
    expect(res.headers['content-disposition']).toContain('imagen.png')
    expect(Buffer.compare(res.body, binario)).toBe(0)
  })

  test('un alumno no puede subir, renombrar ni eliminar', async () => {
    expect((await subir('a.png', 'alumno')).status).toBe(403)

    const { body } = await subir('b.png')
    const renombrar = await request(app)
      .patch(`/api/recurso/${body._id}`)
      .set('x-test-user', 'alumno')
      .send({ nombre: 'c.png' })
    const eliminar = await request(app).delete(`/api/recurso/${body._id}`).set('x-test-user', 'alumno')

    expect(renombrar.status).toBe(403)
    expect(eliminar.status).toBe(403)
    expect(mockDb.get(body._id).nombre).toBe('b.png')
  })

  test('rechaza nombres duplicados al subir y al renombrar', async () => {
    await subir('repetido.png')
    const { body } = await subir('otro.png')

    expect((await subir('repetido.png')).status).toBe(409)
    const res = await request(app).patch(`/api/recurso/${body._id}`).send({ nombre: 'repetido.png' })
    expect(res.status).toBe(409)
  })

  test('renombra y elimina un recurso como docente', async () => {
    const { body } = await subir('viejo.png')

    const renombrado = await request(app).patch(`/api/recurso/${body._id}`).send({ nombre: 'nuevo.png' })
    expect(renombrado.status).toBe(200)
    expect(renombrado.body.nombre).toBe('nuevo.png')
    expect(renombrado.body).not.toHaveProperty('recurso')

    const invalido = await request(app).patch(`/api/recurso/${body._id}`).send({ nombre: 'carpeta/x.png' })
    expect(invalido.status).toBe(400)

    const eliminado = await request(app).delete(`/api/recurso/${body._id}`)
    expect(eliminado.status).toBe(200)
    expect(mockDb.has(body._id)).toBe(false)
  })

  test('rechaza archivos de más de 10MB', async () => {
    const res = await request(app)
      .post('/api/recurso/upload')
      .field('id_asignatura', ASIGNATURA_ID)
      .attach('file', Buffer.alloc(10 * 1024 * 1024 + 1), 'grande.bin')

    expect(res.status).toBe(413)
  })

  describe('recursos de organización', () => {
    test('un administrador sube un archivo a la organización, sin asignatura', async () => {
      const res = await subirAOrganizacion('banner.png')

      expect(res.status).toBe(201)
      expect(res.body.id_organizacion).toBe(ORGANIZACION_ID)
      // se guarda como ObjectId, no como texto
      expect(mockDb.get(res.body._id).id_organizacion).toBeInstanceOf(mockObjectId)
      expect(res.body).not.toHaveProperty('id_asignatura')
    })

    test('rechaza subir sin destino o a asignatura y organización a la vez', async () => {
      const sinDestino = await request(app)
        .post('/api/recurso/upload')
        .attach('file', binario, { filename: 'x.png', contentType: 'image/png' })
      const ambos = await request(app)
        .post('/api/recurso/upload')
        .field('id_asignatura', ASIGNATURA_ID)
        .field('id_organizacion', ORGANIZACION_ID)
        .attach('file', binario, { filename: 'x.png', contentType: 'image/png' })

      expect(sinDestino.status).toBe(400)
      expect(ambos.status).toBe(400)
    })

    test('un integrante que no es administrador no puede subir, renombrar ni eliminar', async () => {
      expect((await subirAOrganizacion('a.png', 'alumno')).status).toBe(403)

      const { body } = await subirAOrganizacion('b.png')
      const renombrar = await request(app)
        .patch(`/api/recurso/${body._id}`)
        .set('x-test-user', 'alumno')
        .send({ nombre: 'c.png' })
      const eliminar = await request(app).delete(`/api/recurso/${body._id}`).set('x-test-user', 'alumno')

      expect(renombrar.status).toBe(403)
      expect(eliminar.status).toBe(403)
    })

    test('los integrantes descargan y listan; quien no pertenece no', async () => {
      const { body } = await subirAOrganizacion('logo.png')

      const descargaAlumno = await request(app).get(`/api/recurso/${body._id}/descarga`).set('x-test-user', 'alumno')
      const descargaExterno = await request(app)
        .get(`/api/recurso/${body._id}/descarga`)
        .set('x-test-user', 'externo')
      const lista = await request(app).get(`/api/recurso/organizacion/${ORGANIZACION_ID}`).set('x-test-user', 'alumno')
      const listaExterno = await request(app)
        .get(`/api/recurso/organizacion/${ORGANIZACION_ID}`)
        .set('x-test-user', 'externo')

      expect(descargaAlumno.status).toBe(200)
      expect(descargaExterno.status).toBe(403)
      expect(lista.status).toBe(200)
      expect(lista.body.map((r) => r.nombre)).toEqual(['logo.png'])
      expect(lista.body[0]).not.toHaveProperty('recurso')
      expect(listaExterno.status).toBe(403)
    })

    test('los nombres solo se repiten dentro del mismo contenedor', async () => {
      expect((await subirAOrganizacion('igual.png')).status).toBe(201)
      expect((await subir('igual.png')).status).toBe(201)
      expect((await subirAOrganizacion('igual.png')).status).toBe(409)
    })
  })
})

describe('registro de actividad de recursos', () => {
  beforeEach(() => {
    mockDb.clear()
    mockRegistrarActividad.mockClear()
  })

  test('subir, renombrar y eliminar registran la acción con el nombre del archivo', async () => {
    const { body } = await subir('guia.pdf')
    await request(app).patch(`/api/recurso/${body._id}`).send({ nombre: 'guia-v2.pdf' })
    await request(app).delete(`/api/recurso/${body._id}`)

    const llamadas = mockRegistrarActividad.mock.calls.map(([entrada]) => entrada)
    expect(llamadas.map((e) => e.accion)).toEqual([
      ACCIONES.RECURSO_SUBIDO,
      ACCIONES.RECURSO_RENOMBRADO,
      ACCIONES.RECURSO_ELIMINADO,
    ])
    expect(String(llamadas[0].contenedor.id_asignatura)).toBe(ASIGNATURA_ID)
    expect(llamadas[0].detalle).toEqual({ nombre: 'guia.pdf' })
    expect(llamadas[1].detalle).toEqual({ anterior: 'guia.pdf', nombre: 'guia-v2.pdf' })
    // el nombre eliminado queda registrado aunque el recurso ya no exista
    expect(llamadas[2].detalle).toEqual({ nombre: 'guia-v2.pdf' })
    expect(String(llamadas[0].id_usuario)).toBe(String(mockDocenteId))
  })

  test('los recursos de organización registran la actividad en la organización', async () => {
    await subirAOrganizacion('logo.png')
    const { contenedor } = mockRegistrarActividad.mock.calls[0][0]
    expect(Object.keys(contenedor)).toEqual(['id_organizacion'])
    expect(String(contenedor.id_organizacion)).toBe(ORGANIZACION_ID)
  })

  test('las operaciones rechazadas no registran actividad', async () => {
    const { body } = await subir('a.png')
    mockRegistrarActividad.mockClear()

    await subir('b.png', 'alumno')
    await subir('a.png')
    await request(app).patch(`/api/recurso/${body._id}`).set('x-test-user', 'alumno').send({ nombre: 'x.png' })
    await request(app).delete(`/api/recurso/${body._id}`).set('x-test-user', 'alumno')

    expect(mockRegistrarActividad).not.toHaveBeenCalled()
  })
})

describe('validarImagenBanner', () => {
  const { validarImagenBanner } = jest.requireActual('../services/recursoServices')

  test('permite quitar la imagen con null', async () => {
    expect(await validarImagenBanner(null, { id_asignatura: ASIGNATURA_ID })).toEqual({ img: null })
  })

  test('rechaza URLs externas y referencias mal formadas', async () => {
    for (const img of ['https://example.com/a.png', 'recurso:123', '', 42, undefined]) {
      expect((await validarImagenBanner(img, { id_asignatura: ASIGNATURA_ID })).status).toBe(400)
    }
  })

  test('rechaza un recurso inexistente', async () => {
    const res = await validarImagenBanner(`recurso:${new mockObjectId()}`, { id_organizacion: ORGANIZACION_ID })
    expect(res.status).toBe(404)
  })
})
