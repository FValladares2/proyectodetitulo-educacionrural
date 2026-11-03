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
 * Último acceso de cada usuario a una asignatura.
 * @returns {Promise<Map<string, Date>>} id del usuario -> fecha
 */
const ultimosAccesos = async (id_asignatura) => {
    if (!isMongoConnected() || !collections.accesos) return new Map()
    const accesos = await collections.accesos
        .find({ id_asignatura: aObjectId(id_asignatura) })
        .project({ _id: 0, id_usuario: 1, ultimo_acceso: 1 })
        .toArray()
    return new Map(accesos.map((a) => [String(a.id_usuario), a.ultimo_acceso]))
}

module.exports = {
    ultimosAccesos,
    registrarAcceso,
}
