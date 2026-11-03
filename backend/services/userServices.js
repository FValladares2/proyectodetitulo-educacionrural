const { SALT_ROUNDS, isMongoConnected, collections, ObjectId } = require('../config/mongo')
const bcrypt = require('bcryptjs')

const hashPassword = async (password) => bcrypt.hash(password, SALT_ROUNDS)
const comparePassword = async (password, hash) => bcrypt.compare(password, hash)

// los nombres no son únicos ni fijos: las cuentas se identifican solo por correo
const findUserByEmail = async (correo) => {
  if (isMongoConnected() && collections.usuarios && typeof correo === 'string') {
    return collections.usuarios.findOne({ correo: correo.trim().toLowerCase() })
  }

  return null
}

const findUserById = async (id) => {
  if (isMongoConnected() && collections.usuarios) {
    if (!ObjectId.isValid(id)) return null
    return collections.usuarios.findOne({ _id: new ObjectId(id) })
  }

  return null
}

const findUserByCredentials = async (correo, password) => {
  const user = await findUserByEmail(correo)
  if (!user || !user.hash_contrasena) {
    return null
  }

  const validPassword = await comparePassword(password, user.hash_contrasena)
  return validPassword ? user : null
}

const insertUser = async (user) => {
  if (isMongoConnected() && collections.usuarios) {
    return collections.usuarios.insertOne(user)
  }

  return null
}

const setUserMainOrg = async (userId, orgId) => {
  if (isMongoConnected() && collections.usuarios) {
    if (!ObjectId.isValid(userId) || !ObjectId.isValid(orgId)) return null
    return collections.usuarios.updateOne({ _id: new ObjectId(userId) }, { $set: { org_principal: new ObjectId(String(orgId)) } })
  }

  return null
}

// conConexion agrega ultima_conexion, que solo deben ver los administradores
const getUserBatchBasicInfo = async (usersIds, { conConexion = false } = {}) => {
  if (isMongoConnected() && collections.usuarios) {
    const proyeccion = { nombre: 1, _id: 1, correo: 1 }
    if (conConexion) proyeccion.ultima_conexion = 1
    return collections.usuarios.find({ _id: { $in: usersIds } }).project(proyeccion).toArray()
  }

  return []
}

const MAX_NOMBRE = 100

// @returns {string|null} el nombre limpio, o null si no es válido
const validarNombre = (nombre) => {
  if (typeof nombre !== 'string') return null
  const limpio = nombre.trim().replace(/\s+/g, ' ')
  return limpio.length > 0 && limpio.length <= MAX_NOMBRE ? limpio : null
}

const actualizarNombre = async (userId, nombre) => {
  if (!isMongoConnected() || !collections.usuarios) return null
  return collections.usuarios.updateOne({ _id: new ObjectId(String(userId)) }, { $set: { nombre } })
}

/**
 * Cambia la contraseña y cierra las demás sesiones: los tokens emitidos antes de
 * sesiones_validas_desde dejan de ser válidos (ver utils/auth.js). Se redondea al segundo
 * porque los tokens guardan su fecha en segundos, así el token nuevo sigue siendo válido.
 */
const cambiarContrasena = async (userId, nueva) => {
  if (!isMongoConnected() || !collections.usuarios) return null
  const hash_contrasena = await hashPassword(nueva)
  return collections.usuarios.updateOne(
    { _id: new ObjectId(String(userId)) },
    { $set: { hash_contrasena, sesiones_validas_desde: new Date(Math.floor(Date.now() / 1000) * 1000) } }
  )
}

// ultima_conexion se actualiza a lo más una vez por intervalo para no escribir en cada solicitud
const INTERVALO_CONEXION_MS = 5 * 60 * 1000

const registrarConexion = async (user) => {
  if (!isMongoConnected() || !collections.usuarios || !user?._id) return null
  const ahora = Date.now()
  if (user.ultima_conexion && ahora - new Date(user.ultima_conexion).getTime() < INTERVALO_CONEXION_MS) {
    return null
  }
  return collections.usuarios.updateOne({ _id: user._id }, { $set: { ultima_conexion: new Date(ahora) } })
}

module.exports = {
  hashPassword,
  comparePassword,
  findUserByEmail,
  findUserById,
  findUserByCredentials,
  insertUser,
  setUserMainOrg,
  getUserBatchBasicInfo,
  registrarConexion,
  validarNombre,
  actualizarNombre,
  cambiarContrasena,
}