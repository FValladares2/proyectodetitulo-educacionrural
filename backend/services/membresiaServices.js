const { isMongoConnected, ObjectId, collections } = require('../config/mongo')

/**
 * Quitar integrantes de asignaturas y organizaciones.
 *
 * Reglas:
 * - una asignatura nunca queda sin docentes y una organización nunca queda sin administradores;
 *   las comprobaciones van en el mismo filtro de la actualización para que dos eliminaciones
 *   simultáneas no puedan dejarlas vacías
 * - quitar a alguien de una organización lo quita también de todas sus asignaturas; si era el
 *   único docente de alguna, esta pasa a quien lo quita
 * - una cuenta que se queda sin organizaciones se desactiva (no puede iniciar sesión) hasta
 *   que una organización la vuelva a agregar
 *
 * Las entregas, calificaciones y archivos del usuario se conservan.
 */

const aObjectId = (id) => (ObjectId.isValid(id) ? new ObjectId(String(id)) : id)
const contiene = (lista, id) => (lista || []).some((x) => String(x) === String(id))

/**
 * @returns {Promise<{ status: number, message?: string, era_docente?: boolean }>}
 */
const quitarDeAsignatura = async (asignatura, id_usuario) => {
    if (!isMongoConnected()) return { status: 503, message: 'Base de datos no disponible.' }
    const idUsuario = aObjectId(id_usuario)
    if (!contiene(asignatura.usuarios, idUsuario)) {
        return { status: 404, message: 'El usuario no pertenece a esta asignatura.' }
    }

    const era_docente = contiene(asignatura.docentes, idUsuario)
    const filtro = { _id: asignatura._id, usuarios: idUsuario }
    if (era_docente) {
        // solo si queda al menos otro docente
        filtro.docentes = idUsuario
        filtro['docentes.1'] = { $exists: true }
    }
    const { modifiedCount } = await collections.asignaturas.updateOne(filtro, {
        $pull: { usuarios: idUsuario, docentes: idUsuario },
    })
    if (modifiedCount === 0) {
        return era_docente
            ? { status: 409, message: 'Es el único docente de la asignatura. Agrega otro docente antes de quitarlo.' }
            : { status: 404, message: 'El usuario no pertenece a esta asignatura.' }
    }
    await collections.accesos.deleteMany({ id_asignatura: asignatura._id, id_usuario: idUsuario })
    return { status: 200, era_docente }
}

/**
 * @param {object} organizacion - documento completo
 * @param {string|ObjectId} id_usuario - a quien se quita
 * @param {string|ObjectId} id_actor - administrador que realiza la acción
 * @returns {Promise<{ status: number, message?: string, asignaturasTransferidas?: string[],
 *   cuentaDesactivada?: boolean }>}
 */
const quitarDeOrganizacion = async (organizacion, id_usuario, id_actor) => {
    if (!isMongoConnected()) return { status: 503, message: 'Base de datos no disponible.' }
    const idUsuario = aObjectId(id_usuario)
    const idActor = aObjectId(id_actor)
    const aSiMismo = String(idUsuario) === String(idActor)
    if (!contiene(organizacion.usuarios, idUsuario)) {
        return { status: 404, message: 'El usuario no pertenece a esta organización.' }
    }

    // asignaturas que quedarían sin docentes
    const huerfanas = await collections.asignaturas
        .find({ id_organizacion: organizacion._id, docentes: [idUsuario] })
        .project({ nombre: 1 })
        .toArray()
    if (huerfanas.length > 0 && aSiMismo) {
        return {
            status: 409,
            message: `Eres el único docente de: ${huerfanas.map((a) => a.nombre).join(', ')}. Agrega otro docente antes de salir de la organización.`,
        }
    }

    const filtro = { _id: organizacion._id, usuarios: idUsuario }
    if (contiene(organizacion.administradores, idUsuario)) {
        filtro.administradores = idUsuario
        filtro['administradores.1'] = { $exists: true }
    }
    const { modifiedCount } = await collections.organizaciones.updateOne(filtro, {
        $pull: { usuarios: idUsuario, profesores: idUsuario, administradores: idUsuario },
    })
    if (modifiedCount === 0) {
        return filtro.administradores
            ? { status: 409, message: 'Es el único administrador de la organización. Agrega otro administrador antes de quitarlo.' }
            : { status: 404, message: 'El usuario no pertenece a esta organización.' }
    }

    // las asignaturas que quedarían sin docentes pasan a quien lo quita
    if (huerfanas.length > 0) {
        await collections.asignaturas.updateMany(
            { _id: { $in: huerfanas.map((a) => a._id) } },
            { $addToSet: { usuarios: idActor, docentes: idActor } }
        )
    }

    const asignaturas = await collections.asignaturas
        .find({ id_organizacion: organizacion._id, usuarios: idUsuario })
        .project({ _id: 1 })
        .toArray()
    const idsAsignaturas = asignaturas.map((a) => a._id)
    if (idsAsignaturas.length > 0) {
        await collections.asignaturas.updateMany(
            { _id: { $in: idsAsignaturas } },
            { $pull: { usuarios: idUsuario, docentes: idUsuario } }
        )
        await collections.accesos.deleteMany({ id_asignatura: { $in: idsAsignaturas }, id_usuario: idUsuario })
    }

    const cuentaDesactivada = await ajustarCuentaTrasSalida(idUsuario, organizacion._id)
    return {
        status: 200,
        asignaturasTransferidas: huerfanas.map((a) => a.nombre),
        cuentaDesactivada,
    }
}

// cambia la organización principal si era la que dejó; sin ninguna, desactiva la cuenta
const ajustarCuentaTrasSalida = async (idUsuario, idOrganizacion) => {
    const otra = await collections.organizaciones.findOne({ usuarios: idUsuario }, { projection: { _id: 1 } })
    if (!otra) {
        await collections.usuarios.updateOne(
            { _id: idUsuario },
            { $set: { desactivado_en: new Date() }, $unset: { org_principal: '' } }
        )
        return true
    }
    await collections.usuarios.updateOne(
        { _id: idUsuario, org_principal: idOrganizacion },
        { $set: { org_principal: otra._id } }
    )
    return false
}

// al volver a agregarla a una organización, la cuenta se reactiva
const reactivarCuenta = async (id_usuario, id_organizacion) => {
    if (!isMongoConnected()) return null
    const idUsuario = aObjectId(id_usuario)
    const idOrganizacion = aObjectId(id_organizacion)
    await collections.usuarios.updateOne(
        { _id: idUsuario, desactivado_en: { $exists: true } },
        { $unset: { desactivado_en: '' }, $set: { org_principal: idOrganizacion } }
    )
    return collections.usuarios.updateOne(
        { _id: idUsuario, org_principal: { $exists: false } },
        { $set: { org_principal: idOrganizacion } }
    )
}

module.exports = {
    quitarDeAsignatura,
    quitarDeOrganizacion,
    reactivarCuenta,
}
