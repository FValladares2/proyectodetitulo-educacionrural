const { MongoClient, ObjectId } = require('mongodb')
const crypto = require('crypto')
const SALT_ROUNDS = 12

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://mongodb:27017/'
const MONGODB_DB = process.env.MONGODB_DB || 'educacionrural'

const client = new MongoClient(MONGODB_URI)

const collections = {
  //collecciones según mongo
  usuarios: null,
  organizaciones: null,
  asignaturas: null,
  recursos: null,
  accesos: null
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

        await collections.usuarios.createIndex({ correo: 1 }, { unique: true })
        await collections.usuarios.createIndex({ nombre: 1 })
        await collections.organizaciones.createIndex({ nombre: 1 })
        await collections.asignaturas.createIndex({ nombre: 1 })
        await collections.recursos.createIndex({ nombre_archivo: 1 })
        // un documento por usuario y asignatura; también resuelve el $lookup del orden por acceso
        await collections.accesos.createIndex({ id_usuario: 1, id_asignatura: 1 }, { unique: true })

        connected = true
        // No registrar la URI completa: puede contener credenciales
        console.log(`Connected to MongoDB (db: ${MONGODB_DB})`)

    } catch (error) {
    connected = false
    console.warn(
      'MongoDB no disponible. No se pudo conectar a ' + MONGODB_URI + ' / ' + MONGODB_DB,
    )
    console.warn(error.message)
  }
}

const isMongoConnected = () => connected

module.exports = { client, collections, connectMongo, isMongoConnected, connected, SALT_ROUNDS, ObjectId }