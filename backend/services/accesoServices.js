const { isMongoConnected, ObjectId, collections } = require('../config/mongo')

// ambos ids se guardan como ObjectId; mezclar tipos hace que el $lookup no encuentre nada
const aObjectId = (id) => (ObjectId.isValid(id) ? new ObjectId(String(id)) : id)

/**
 * Registra (o actualiza) la fecha del último acceso de un usuario a una asignatura.
 * @param {string|ObjectId} id_usuario
 * @param {string|ObjectId} id_asignatura
 * @returns {Promise<object|null>}
 */
const registrarAcceso = async (id_usuario, id_asignatura) => {
    if (isMongoConnected() && collections.accesos) {
        return collections.accesos.updateOne(
            { id_usuario: aObjectId(id_usuario), id_asignatura: aObjectId(id_asignatura) },
            { $set: { ultimo_acceso: new Date() } },
            { upsert: true }
        )
    }
    return null
}

/**
 * Elimina los accesos de una asignatura, o solo los de un usuario en ella.
 * @param {string|ObjectId} id_asignatura
 * @param {string|ObjectId} [id_usuario]
 * @returns {Promise<object|null>}
 */
const eliminarAccesos = async (id_asignatura, id_usuario) => {
    if (isMongoConnected() && collections.accesos) {
        const filtro = { id_asignatura: aObjectId(id_asignatura) }
        if (id_usuario) {
            filtro.id_usuario = aObjectId(id_usuario)
        }
        return collections.accesos.deleteMany(filtro)
    }
    return null
}

module.exports = {
    registrarAcceso,
    eliminarAccesos,
}
