const { isMongoConnected, ObjectId, collections } = require('../config/mongo')
const asignServices = require('./asignServices')

/**
 * Tareas de una asignatura y las entregas de los estudiantes.
 *
 * - tareas:   { id_asignatura, titulo, descripcion, apertura, limite, creada_por, creado_en, actualizado_en }
 * - entregas: { id_tarea, id_usuario, enviada_en, calificacion, comentario, calificada_por, calificada_en }
 *   Una por estudiante y tarea (índice único). Editar una entrega enviada es retirarla y enviar
 *   una nueva, así que el documento se reemplaza y su calificación anterior no se conserva.
 * - Los archivos de una entrega son recursos con { id_tarea, id_usuario } en vez de id_asignatura,
 *   por lo que ninguna consulta de recursos de la asignatura los incluye.
 */

const MAX_TITULO = 200
const MAX_DESCRIPCION = 20000
const MAX_COMENTARIO = 2000

const aObjectId = (id) => (ObjectId.isValid(id) ? new ObjectId(String(id)) : id)

/**
 * Estado de la tarea según la hora del servidor; nunca se confía en el reloj del cliente.
 * @returns {'pendiente'|'abierta'|'cerrada'}
 */
const estadoTarea = (tarea, ahora = new Date()) => {
    if (ahora < tarea.apertura) return 'pendiente'
    if (ahora > tarea.limite) return 'cerrada'
    return 'abierta'
}

const leerFecha = (valor) => {
    if (valor === undefined || valor === null || valor === '') return null
    const fecha = new Date(valor)
    return Number.isNaN(fecha.getTime()) ? null : fecha
}

/**
 * Valida los campos editables de una tarea. Con `actual` (edición) los campos omitidos
 * conservan su valor, y la regla apertura < limite se comprueba sobre el resultado.
 * @returns {{ datos: object } | { message: string }}
 */
const validarDatosTarea = (body = {}, actual = null) => {
    const datos = {}

    if (body.titulo !== undefined || !actual) {
        const titulo = typeof body.titulo === 'string' ? body.titulo.trim() : ''
        if (!titulo || titulo.length > MAX_TITULO) {
            return { message: `El título es obligatorio y debe tener hasta ${MAX_TITULO} caracteres.` }
        }
        datos.titulo = titulo
    }

    if (body.descripcion !== undefined) {
        if (typeof body.descripcion !== 'string' || body.descripcion.length > MAX_DESCRIPCION) {
            return { message: 'La descripción debe ser texto en formato Markdown.' }
        }
        datos.descripcion = body.descripcion
    } else if (!actual) {
        datos.descripcion = ''
    }

    for (const campo of ['apertura', 'limite']) {
        if (body[campo] !== undefined || !actual) {
            const fecha = leerFecha(body[campo])
            if (!fecha) {
                return { message: `La fecha de ${campo} no es válida.` }
            }
            datos[campo] = fecha
        }
    }

    const apertura = datos.apertura ?? actual?.apertura
    const limite = datos.limite ?? actual?.limite
    if (!(apertura < limite)) {
        return { message: 'La apertura debe ser anterior al límite de entrega.' }
    }

    return { datos }
}

/**
 * Valida una calificación: número (o null para quitarla) y un comentario opcional.
 * @returns {{ datos: object } | { message: string }}
 */
const validarCalificacion = (body = {}) => {
    const { calificacion = null, comentario = '' } = body
    if (calificacion !== null && !(typeof calificacion === 'number' && Number.isFinite(calificacion))) {
        return { message: 'La calificación debe ser un número.' }
    }
    if (typeof comentario !== 'string' || comentario.length > MAX_COMENTARIO) {
        return { message: `El comentario debe tener hasta ${MAX_COMENTARIO} caracteres.` }
    }
    return { datos: { calificacion, comentario: comentario.trim() } }
}

// --- tareas ---

const crearTarea = async (tarea) => {
    if (isMongoConnected() && collections.tareas) {
        return collections.tareas.insertOne({ ...tarea, id_asignatura: aObjectId(tarea.id_asignatura) })
    }
    return null
}

const findTareaById = async (id) => {
    if (isMongoConnected() && collections.tareas && ObjectId.isValid(id)) {
        return collections.tareas.findOne({ _id: new ObjectId(String(id)) })
    }
    return null
}

// sin la descripción, que puede ser larga; se obtiene al abrir la tarea
const listarTareasPorAsignatura = async (id_asignatura) => {
    if (isMongoConnected() && collections.tareas) {
        return collections.tareas
            .find({ id_asignatura: aObjectId(id_asignatura) })
            .project({ descripcion: 0 })
            .sort({ limite: -1 })
            .toArray()
    }
    return []
}

const actualizarTarea = async (id, campos) => {
    if (isMongoConnected() && collections.tareas && ObjectId.isValid(id)) {
        return collections.tareas.updateOne({ _id: new ObjectId(String(id)) }, { $set: campos })
    }
    return null
}

// elimina la tarea con sus entregas y los archivos de las entregas
const eliminarTarea = async (id) => {
    if (isMongoConnected() && collections.tareas && ObjectId.isValid(id)) {
        const idTarea = new ObjectId(String(id))
        await collections.entregas.deleteMany({ id_tarea: idTarea })
        await collections.recursos.deleteMany({ id_tarea: idTarea })
        return collections.tareas.deleteOne({ _id: idTarea })
    }
    return null
}

// --- entregas ---

const findEntrega = async (id_tarea, id_usuario) => {
    if (isMongoConnected() && collections.entregas) {
        return collections.entregas.findOne({ id_tarea: aObjectId(id_tarea), id_usuario: aObjectId(id_usuario) })
    }
    return null
}

// enviar o editar: se elimina la entrega anterior (si la hay) y se crea una nueva
const reemplazarEntrega = async (id_tarea, id_usuario) => {
    if (isMongoConnected() && collections.entregas) {
        const filtro = { id_tarea: aObjectId(id_tarea), id_usuario: aObjectId(id_usuario) }
        await collections.entregas.deleteOne(filtro)
        const entrega = {
            ...filtro,
            enviada_en: new Date(),
            calificacion: null,
            comentario: '',
        }
        const result = await collections.entregas.insertOne(entrega)
        return { _id: result.insertedId, ...entrega }
    }
    return null
}

const eliminarEntrega = async (id_tarea, id_usuario) => {
    if (isMongoConnected() && collections.entregas) {
        return collections.entregas.deleteOne({ id_tarea: aObjectId(id_tarea), id_usuario: aObjectId(id_usuario) })
    }
    return null
}

/**
 * Entregas de una tarea con el nombre y correo de cada estudiante y los metadatos de sus
 * archivos (nunca el contenido).
 */
const listarEntregas = async (id_tarea) => {
    if (!isMongoConnected() || !collections.entregas) return []
    return collections.entregas.aggregate([
        { $match: { id_tarea: aObjectId(id_tarea) } },
        { $sort: { enviada_en: 1 } },
        {
            $lookup: {
                from: 'usuarios',
                localField: 'id_usuario',
                foreignField: '_id',
                pipeline: [{ $project: { _id: 1, nombre: 1, correo: 1 } }],
                as: 'usuario',
            },
        },
        { $set: { usuario: { $first: '$usuario' } } },
        {
            $lookup: {
                from: 'recursos',
                let: { usuario: '$id_usuario' },
                pipeline: [
                    { $match: { id_tarea: aObjectId(id_tarea), $expr: { $eq: ['$id_usuario', '$$usuario'] } } },
                    { $project: { recurso: 0 } },
                    { $sort: { nombre: 1 } },
                ],
                as: 'archivos',
            },
        },
    ]).toArray()
}

const calificarEntrega = async (id_tarea, id_usuario, { calificacion, comentario }, id_docente) => {
    if (isMongoConnected() && collections.entregas) {
        return collections.entregas.findOneAndUpdate(
            { id_tarea: aObjectId(id_tarea), id_usuario: aObjectId(id_usuario) },
            {
                $set: {
                    calificacion,
                    comentario,
                    calificada_por: aObjectId(id_docente),
                    calificada_en: new Date(),
                },
            },
            // includeResultMetadata da el mismo formato ({ value }) en las versiones 5 y 6 del driver
            { returnDocument: 'after', includeResultMetadata: true }
        ).then((resultado) => resultado.value)
    }
    return null
}

// --- reglas de entrega, compartidas por las rutas de tareas y de recursos ---

/**
 * Comprueba que el usuario pertenece a la asignatura de la tarea y que la tarea está abierta.
 * @returns {Promise<null | { status: number, message: string }>} null si puede entregar
 */
const motivoFueraDePlazo = async (tarea, userId) => {
    if (!await asignServices.findUsuarioInAsign(tarea.id_asignatura, userId)) {
        return { status: 403, message: 'No perteneces a la asignatura de esta tarea.' }
    }
    const inactiva = await asignServices.motivoAsignaturaInactiva(tarea.id_asignatura)
    if (inactiva) return inactiva
    const estado = estadoTarea(tarea)
    if (estado === 'pendiente') {
        return { status: 403, message: 'La tarea aún no está abierta para entregas.' }
    }
    if (estado === 'cerrada') {
        return { status: 403, message: 'El plazo de entrega terminó.' }
    }
    return null
}

/**
 * Un estudiante puede subir, renombrar o eliminar los archivos de su entrega solo si son suyos,
 * la tarea está abierta y no la ha enviado (para modificarla debe retirarla primero).
 * @param {{ id_tarea: ObjectId, id_usuario: ObjectId }} contenedor
 * @returns {Promise<null | { status: number, message: string }>} null si puede editar
 */
const motivoSinEdicionEntrega = async (contenedor, userId) => {
    if (String(contenedor.id_usuario) !== String(userId)) {
        return { status: 403, message: 'Solo quien subió el archivo puede modificarlo.' }
    }
    const tarea = await findTareaById(contenedor.id_tarea)
    if (!tarea) {
        return { status: 404, message: 'Tarea no encontrada.' }
    }
    const motivo = await motivoFueraDePlazo(tarea, userId)
    if (motivo) return motivo
    if (await findEntrega(contenedor.id_tarea, userId)) {
        return { status: 409, message: 'Ya enviaste esta tarea. Retira la entrega para modificar sus archivos.' }
    }
    return null
}

module.exports = {
    estadoTarea,
    motivoFueraDePlazo,
    motivoSinEdicionEntrega,
    validarDatosTarea,
    validarCalificacion,
    crearTarea,
    findTareaById,
    listarTareasPorAsignatura,
    actualizarTarea,
    eliminarTarea,
    findEntrega,
    reemplazarEntrega,
    eliminarEntrega,
    listarEntregas,
    calificarEntrega,
}
