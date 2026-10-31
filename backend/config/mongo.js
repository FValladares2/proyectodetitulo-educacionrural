const { MongoClient, ObjectId } = require('mongodb')
const crypto = require('crypto')
const SALT_ROUNDS = 12

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://mongodb:27017/'
const MONGODB_DB = process.env.MONGODB_DB || 'educacionrural'

const client = new MongoClient(MONGODB_URI)

// la URI puede incluir usuario y contraseña ("mongodb+srv://usuario:clave@host/..."): para los
// registros se deja solo el esquema y el host, sin credenciales ni parámetros
const describirUri = (uri) => {
  const coincidencia = /^(mongodb(?:\+srv)?:\/\/)(?:[^@/]*@)?([^/?]*)/.exec(uri || '')
  return coincidencia ? `${coincidencia[1]}${coincidencia[2]}` : '(URI no válida)'
}

// las entradas de la colección actividad se eliminan solas después de este tiempo
const DIAS_RETENCION_ACTIVIDAD = 180
// notificaciones (leídas o no) y correos de la cola, también con borrado automático
const DIAS_RETENCION_NOTIFICACIONES = 90
const DIAS_RETENCION_CORREOS = 30
const SEGUNDOS_POR_DIA = 24 * 60 * 60

const collections = {
  //collecciones según mongo
  usuarios: null,
  organizaciones: null,
  asignaturas: null,
  recursos: null,
  accesos: null,
  actividad: null,
  tareas: null,
  entregas: null,
  notificaciones: null,
  correos: null
}

let connected = false

const connectMongo = async () => {

    try {
        await client.connect()
        const database = client.db(MONGODB_DB)
        collections.usuarios = database.collection('usuarios')
        collections.organizaciones = database.collection('organizaciones')
        collections.asignaturas = database.collection('asignaturas')
        collections.recursos = database.collection('recursos')
        collections.accesos = database.collection('accesos')
        collections.actividad = database.collection('actividad')
        collections.tareas = database.collection('tareas')
        collections.entregas = database.collection('entregas')
        collections.notificaciones = database.collection('notificaciones')
        collections.correos = database.collection('correos')

        await collections.usuarios.createIndex({ correo: 1 }, { unique: true })
        await collections.usuarios.createIndex({ nombre: 1 })
        await collections.organizaciones.createIndex({ nombre: 1 })
        await collections.asignaturas.createIndex({ nombre: 1 })
        // recursos por contenedor (listas y nombres repetidos); solo en los documentos que lo tienen
        await collections.recursos.createIndex({ id_asignatura: 1, nombre: 1 }, {
            partialFilterExpression: { id_asignatura: { $exists: true } },
        })
        await collections.recursos.createIndex({ id_organizacion: 1, nombre: 1 }, {
            partialFilterExpression: { id_organizacion: { $exists: true } },
        })
        // un documento por usuario y asignatura; también resuelve el $lookup del orden por acceso
        await collections.accesos.createIndex({ id_usuario: 1, id_asignatura: 1 }, { unique: true })
        // archivos de entregas: se consultan por tarea y estudiante
        await collections.recursos.createIndex({ id_tarea: 1, id_usuario: 1 }, {
            partialFilterExpression: { id_tarea: { $exists: true } },
        })
        await collections.tareas.createIndex({ id_asignatura: 1, limite: -1 })
        await collections.entregas.createIndex({ id_tarea: 1, id_usuario: 1 }, { unique: true })
        // notificaciones: lista del usuario, conteo de no leídas y borrado automático
        await collections.notificaciones.createIndex({ id_usuario: 1, creado_en: -1 })
        await collections.notificaciones.createIndex({ id_usuario: 1, leida: 1 })
        await collections.notificaciones.createIndex({ creado_en: 1 }, {
            expireAfterSeconds: DIAS_RETENCION_NOTIFICACIONES * SEGUNDOS_POR_DIA,
        })
        // cola de correos: el proceso de envío busca los pendientes por fecha de intento
        await collections.correos.createIndex({ estado: 1, proximo_intento: 1 })
        await collections.correos.createIndex({ creado_en: 1 }, {
            expireAfterSeconds: DIAS_RETENCION_CORREOS * SEGUNDOS_POR_DIA,
        })
        // invitaciones para definir la contraseña (solo se guarda el hash del enlace)
        await collections.usuarios.createIndex({ 'invitacion.token_hash': 1 }, { sparse: true })
        // registro de cambios: listado por contenedor y borrado automático de entradas antiguas
        await collections.actividad.createIndex({ id_asignatura: 1, fecha: -1 }, {
            partialFilterExpression: { id_asignatura: { $exists: true } },
        })
        await collections.actividad.createIndex({ id_organizacion: 1, fecha: -1 }, {
            partialFilterExpression: { id_organizacion: { $exists: true } },
        })
        await collections.actividad.createIndex({ fecha: 1 }, {
            expireAfterSeconds: DIAS_RETENCION_ACTIVIDAD * 24 * 60 * 60,
        })

        connected = true
        // No registrar la URI completa: puede contener credenciales
        console.log(`Connected to MongoDB (db: ${MONGODB_DB})`)

    } catch (error) {
    connected = false
    console.warn(
      'MongoDB no disponible. No se pudo conectar a ' + describirUri(MONGODB_URI) + ' / ' + MONGODB_DB,
    )
    console.warn(error.message)
  }
}

const isMongoConnected = () => connected

module.exports = { client, collections, connectMongo, isMongoConnected, connected, SALT_ROUNDS, ObjectId, DIAS_RETENCION_ACTIVIDAD }