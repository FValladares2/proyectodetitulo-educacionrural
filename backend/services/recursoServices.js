const { isMongoConnected, ObjectId, collections } = require('../config/mongo')
const encryption = require('../utils/encryption')

/**
 * Fallback key used only for local test/dev when ENCRYPTION_KEY is not defined in .env
 */
const DEV_FALLBACK_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'

/**
 * Retrieves the master encryption key from the environment.
 * @returns {Buffer} 32-byte key buffer
 */
const getMasterKey = () => {
  const envKey = process.env.ENCRYPTION_KEY
  if (!envKey) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('ENCRYPTION_KEY environment variable is required in production.')
    }
    console.warn('Warning: ENCRYPTION_KEY not set. Using dev fallback key. Set ENCRYPTION_KEY in .env')
    return encryption.normalizeKey(DEV_FALLBACK_KEY)
  }
  return encryption.normalizeKey(envKey)
}

/**
 * Obtains or derives an encryption key for a given user context.
 * If userId is provided, derives a unique context-bound key using HKDF.
 * Otherwise, uses the master key directly.
 * @param {string|ObjectId} [userId]
 * @returns {Buffer}
 */
const getRecursoKey = (userId) => {
  const masterKey = getMasterKey()
  if (userId) {
    return encryption.deriveKey(masterKey, 'recurso-encryption', String(userId))
  }
  return masterKey
}

/**
 * Encrypts a resource before storing it in MongoDB.
 * @param {string|Buffer|object} recurso - The resource payload (content, base64, object)
 * @param {string|ObjectId} [userId] - Optional author/user ID for key derivation
 * @returns {Promise<{ ciphertext: string, iv: string, authTag: string, version: number }>}
 */
const cifrarRecurso = async (recurso, userId) => {
  if (recurso === undefined || recurso === null) {
    return null
  }
  const key = getRecursoKey(userId)
  return encryption.encrypt(recurso, key)
}

/**
 * Decrypts an encrypted resource.
 * @param {{ ciphertext: string, iv: string, authTag: string } | string} recursoCifrado
 * @param {string|ObjectId} [userId] - User ID used when encrypting (if key was derived)
 * @returns {Promise<string|object>}
 */
const descifrarRecurso = async (recursoCifrado, userId) => {
  if (!recursoCifrado) {
    return null
  }
  const key = getRecursoKey(userId)
  return encryption.decrypt(recursoCifrado, key)
}

const aObjectId = (id) => (ObjectId.isValid(id) ? new ObjectId(String(id)) : id)

/**
 * Converts every id of a container to ObjectId, as stored in the recursos collection.
 * @param {object} contenedor - { id_asignatura } | { id_organizacion } | { id_tarea, id_usuario }
 * @returns {object}
 */
const normalizarContenedor = (contenedor) =>
  Object.fromEntries(Object.entries(contenedor).map(([campo, valor]) => [campo, aObjectId(valor)]))

/**
 * Inserts a new recurso document into MongoDB.
 * @param {object} recurso
 * @returns {Promise<object|null>}
 */
const createRecurso = async (recurso) => {
  if (isMongoConnected() && collections.recursos) {
    return collections.recursos.insertOne(recurso)
  }
  return null
}

/**
 * Finds a recurso document by its ID.
 * @param {string|ObjectId} id
 * @returns {Promise<object|null>}
 */
const findRecursoById = async (id) => {
  if (isMongoConnected() && collections.recursos) {
    if (!ObjectId.isValid(id)) return null
    return collections.recursos.findOne({ _id: new ObjectId(id) })
  }
  return null
}

/**
 * Finds all recursos associated with a specific asignatura.
 * @param {string|ObjectId} id_asignatura
 * @returns {Promise<Array>}
 */
const findRecursosByAsignatura = async (id_asignatura) => {
  if (isMongoConnected() && collections.recursos) {
    return collections.recursos
        .find({ id_asignatura: aObjectId(id_asignatura) })
        .project({ recurso: 0 })
        .sort({ nombre: 1 })
        .collation({ locale: 'es', strength: 2 })
        .toArray()
  }
  return []
}

/**
 * Finds all recursos that belong to an organización instead of an asignatura.
 * @param {string} id_organizacion
 * @returns {Promise<Array>}
 */
const findRecursosByOrganizacion = async (id_organizacion) => {
  if (isMongoConnected() && collections.recursos) {
    return collections.recursos
        .find({ id_organizacion: aObjectId(id_organizacion) })
        .project({ recurso: 0 })
        .sort({ nombre: 1 })
        .collation({ locale: 'es', strength: 2 })
        .toArray()
  }
  return []
}

/**
 * Finds the files a user submitted to a tarea (metadata only).
 * @param {string|ObjectId} id_tarea
 * @param {string|ObjectId} id_usuario
 * @returns {Promise<Array>}
 */
const findRecursosByTarea = async (id_tarea, id_usuario) => {
  if (isMongoConnected() && collections.recursos) {
    return collections.recursos
        .find({ id_tarea: aObjectId(id_tarea), id_usuario: aObjectId(id_usuario) })
        .project({ recurso: 0 })
        .sort({ nombre: 1 })
        .toArray()
  }
  return []
}

/**
 * Returns the container a recurso belongs to:
 * - { id_tarea, id_usuario } for files submitted to a tarea, private to the student and the docentes
 * - { id_organizacion } for general organization files such as banners
 * - { id_asignatura } otherwise
 * @param {object} recurso
 * @returns {{ id_tarea: ObjectId, id_usuario: ObjectId } | { id_organizacion: ObjectId } | { id_asignatura: ObjectId }}
 */
const getContenedor = (recurso) => {
  if (recurso.id_tarea) return { id_tarea: recurso.id_tarea, id_usuario: recurso.id_usuario }
  if (recurso.id_organizacion) return { id_organizacion: recurso.id_organizacion }
  return { id_asignatura: recurso.id_asignatura }
}

/**
 * Checks if another recurso with the same name already exists in the same container.
 * @param {{ id_asignatura: string } | { id_organizacion: string }} contenedor
 * @param {string} nombre
 * @param {string|ObjectId} [excluirId] - Recurso to ignore (used when renaming)
 * @returns {Promise<boolean>}
 */
const existeNombreEnContenedor = async (contenedor, nombre, excluirId) => {
  if (isMongoConnected() && collections.recursos) {
    const query = { ...normalizarContenedor(contenedor), nombre }
    if (excluirId && ObjectId.isValid(excluirId)) {
      query._id = { $ne: new ObjectId(excluirId) }
    }
    const doc = await collections.recursos.findOne(query, {
      projection: { _id: 1 },
      collation: { locale: 'es', strength: 2 },
    })
    return Boolean(doc)
  }
  return false
}

const PATRON_IMAGEN_RECURSO = /^recurso:([0-9a-f]{24})$/i

/**
 * Validates a banner image reference ("recurso:<id>" or null to remove it).
 * The recurso must be an image stored in the same container, so everyone who
 * can see the banner can also download it.
 * @param {unknown} img
 * @param {{ id_asignatura: string } | { id_organizacion: string }} contenedor
 * @returns {Promise<{ img: string|null } | { status: number, message: string }>}
 */
const validarImagenBanner = async (img, contenedor) => {
  if (img === null) return { img: null }

  const recursoId = typeof img === 'string' ? PATRON_IMAGEN_RECURSO.exec(img)?.[1] : null
  if (!recursoId) {
    return { status: 400, message: 'La imagen debe ser un recurso de la plataforma.' }
  }

  const recurso = await findRecursoById(recursoId)
  const contenedorRecurso = recurso ? getContenedor(recurso) : null
  const mismoContenedor =
    contenedorRecurso &&
    Object.keys(contenedor).length === Object.keys(contenedorRecurso).length &&
    Object.entries(contenedor).every(([campo, valor]) => String(contenedorRecurso[campo]) === String(valor))
  if (!mismoContenedor) {
    return { status: 404, message: 'El recurso no existe en este espacio.' }
  }
  if (!(recurso.tipo_mime || '').startsWith('image/')) {
    return { status: 400, message: 'El recurso seleccionado no es una imagen.' }
  }

  return { img: `recurso:${recursoId}` }
}

/**
 * Updates metadata fields of a recurso by ID.
 * @param {string|ObjectId} id
 * @param {object} campos
 * @returns {Promise<object|null>}
 */
const updateRecurso = async (id, campos) => {
  if (isMongoConnected() && collections.recursos) {
    if (!ObjectId.isValid(id)) return null
    return collections.recursos.updateOne({ _id: new ObjectId(id) }, { $set: campos })
  }
  return null
}

/**
 * Retrieves a recurso by ID and decrypts its content.
 * @param {string|ObjectId} id
 * @returns {Promise<object|null>}
 */
const findRecursoAndDecrypt = async (id) => {
  const doc = await findRecursoById(id)
  if (!doc) return null

  if (doc.recurso) {
    try {
      const decrypted = await descifrarRecurso(doc.recurso, doc.id_usuario)
      return { ...doc, recurso: decrypted }
    } catch (err) {
      console.error(`Error descifrando recurso ${id}:`, err.message)
      return { ...doc, recursoError: 'No se pudo descifrar el recurso.' }
    }
  }

  return doc
}

/**
 * Deletes a recurso by ID.
 * @param {string|ObjectId} id
 * @returns {Promise<object|null>}
 */
const deleteRecurso = async (id) => {
  if (isMongoConnected() && collections.recursos) {
    if (!ObjectId.isValid(id)) return null
    return collections.recursos.deleteOne({ _id: new ObjectId(id) })
  }
  return null
}

module.exports = {
  getMasterKey,
  getRecursoKey,
  cifrarRecurso,
  descifrarRecurso,
  createRecurso,
  findRecursoById,
  findRecursosByAsignatura,
  findRecursosByOrganizacion,
  findRecursosByTarea,
  normalizarContenedor,
  getContenedor,
  existeNombreEnContenedor,
  validarImagenBanner,
  updateRecurso,
  findRecursoAndDecrypt,
  deleteRecurso,
}