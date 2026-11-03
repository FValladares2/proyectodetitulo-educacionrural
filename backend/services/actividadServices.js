const { isMongoConnected, ObjectId, collections, DIAS_RETENCION_ACTIVIDAD } = require('../config/mongo')

/**
 * Registro de cambios por asignatura u organización. Solo lo escribe el backend, después de
 * que una operación se completa, para que el registro no pueda contradecir lo que ocurrió.
 * Se guardan códigos de acción y un detalle mínimo, nunca el contenido ni las diferencias.
 */
const ACCIONES = Object.freeze({
    ASIGNATURA_CREADA: 'asignatura_creada',
    MARKUP_EDITADO: 'markup_editado',
    BANNER_CAMBIADO: 'banner_cambiado',
    BANNER_QUITADO: 'banner_quitado',
    RECURSO_SUBIDO: 'recurso_subido',
    RECURSO_RENOMBRADO: 'recurso_renombrado',
    RECURSO_ELIMINADO: 'recurso_eliminado',
    USUARIOS_AGREGADOS: 'usuarios_agregados',
    USUARIO_QUITADO: 'usuario_quitado',
    ASIGNATURA_CONFIGURADA: 'asignatura_configurada',
    ORGANIZACION_EDITADA: 'organizacion_editada',
    TAREA_CREADA: 'tarea_creada',
    TAREA_EDITADA: 'tarea_editada',
    TAREA_ELIMINADA: 'tarea_eliminada',
    ENTREGA_ENVIADA: 'entrega_enviada',
    ENTREGA_RETIRADA: 'entrega_retirada',
    ENTREGA_CALIFICADA: 'entrega_calificada',
})

const ACCIONES_VALIDAS = new Set(Object.values(ACCIONES))

// ediciones repetidas del mismo usuario dentro de esta ventana actualizan la entrada anterior
// en vez de crear otra, para que guardar varias veces seguidas quede como un solo cambio
const VENTANAS_AGRUPACION_MS = {
    [ACCIONES.MARKUP_EDITADO]: 10 * 60 * 1000,
    [ACCIONES.TAREA_EDITADA]: 10 * 60 * 1000,
}

const LIMITE_MAXIMO = 100

const aObjectId = (id) => (ObjectId.isValid(id) ? new ObjectId(String(id)) : id)

// { id_asignatura } o { id_organizacion }, igual que en los recursos, con ObjectId
const normalizarContenedor = (contenedor) => {
    if (contenedor?.id_organizacion) return { id_organizacion: aObjectId(contenedor.id_organizacion) }
    if (contenedor?.id_asignatura) return { id_asignatura: aObjectId(contenedor.id_asignatura) }
    return null
}

/**
 * Registra una acción. Nunca lanza errores: un fallo del registro se informa en consola pero
 * no debe hacer fallar la operación que se está registrando, así que puede llamarse sin await.
 * @param {object} entrada
 * @param {{ id_asignatura: string|ObjectId } | { id_organizacion: string|ObjectId }} entrada.contenedor
 * @param {string|ObjectId} entrada.id_usuario
 * @param {string} entrada.accion - uno de ACCIONES
 * @param {object} [entrada.detalle] - datos mínimos, por ejemplo { nombre: 'guia.pdf' }
 * @returns {Promise<object|null>}
 */
const registrarActividad = async ({ contenedor, id_usuario, accion, detalle }) => {
    try {
        if (!isMongoConnected() || !collections.actividad) return null

        const filtroContenedor = normalizarContenedor(contenedor)
        if (!filtroContenedor || !id_usuario || !ACCIONES_VALIDAS.has(accion)) {
            console.error('Entrada de actividad inválida:', { contenedor, accion })
            return null
        }

        const ahora = new Date()
        const base = { ...filtroContenedor, id_usuario: aObjectId(id_usuario), accion }

        const ventana = VENTANAS_AGRUPACION_MS[accion]
        if (ventana) {
            // includeResultMetadata da el mismo formato ({ value }) en las versiones 5 y 6 del driver
            const { value: agrupada } = await collections.actividad.findOneAndUpdate(
                { ...base, fecha: { $gte: new Date(ahora.getTime() - ventana) } },
                { $set: { fecha: ahora } },
                { sort: { fecha: -1 }, returnDocument: 'after', includeResultMetadata: true }
            )
            if (agrupada) return agrupada
        }

        const entrada = { ...base, fecha: ahora }
        if (detalle && Object.keys(detalle).length > 0) {
            entrada.detalle = detalle
        }
        await collections.actividad.insertOne(entrada)
        return entrada
    } catch (error) {
        console.error('No se pudo registrar la actividad:', error)
        return null
    }
}

/**
 * Lista la actividad de un contenedor, de la más reciente a la más antigua, con el nombre
 * de cada usuario. Para la página siguiente se pasa como `antes` la fecha de la última entrada.
 * @param {{ id_asignatura: string } | { id_organizacion: string }} contenedor
 * @param {{ limit?: number, antes?: Date }} [opciones]
 * @returns {Promise<Array>}
 */
const listarActividad = async (contenedor, { limit = 30, antes } = {}) => {
    if (!isMongoConnected() || !collections.actividad) return []

    const filtro = normalizarContenedor(contenedor)
    if (!filtro) return []
    if (antes) {
        filtro.fecha = { $lt: antes }
    }

    return collections.actividad.aggregate([
        { $match: filtro },
        { $sort: { fecha: -1 } },
        { $limit: Math.min(Math.max(1, limit), LIMITE_MAXIMO) },
        {
            $lookup: {
                from: 'usuarios',
                localField: 'id_usuario',
                foreignField: '_id',
                pipeline: [{ $project: { _id: 1, nombre: 1 } }],
                as: 'usuario',
            },
        },
        { $set: { usuario: { $first: '$usuario' } } },
    ]).toArray()
}

module.exports = {
    ACCIONES,
    DIAS_RETENCION: DIAS_RETENCION_ACTIVIDAD,
    LIMITE_MAXIMO,
    registrarActividad,
    listarActividad,
}
