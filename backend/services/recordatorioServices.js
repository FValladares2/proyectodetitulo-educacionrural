const { isMongoConnected, collections } = require('../config/mongo')
const { estudiantesDe, notificar } = require('./notificacionServices')

/**
 * Recordatorio "la tarea cierra pronto": un proceso periódico busca tareas abiertas cuyo límite
 * es dentro de las próximas HORAS_ANTICIPACION y avisa una sola vez a los estudiantes que aún
 * no han enviado. Si un docente cambia el límite, la marca se reinicia (ver tareaRoutes).
 */

const HORAS_ANTICIPACION = 24

const revisarTareasPorCerrar = async (ahora = new Date()) => {
    if (!isMongoConnected() || !collections.tareas) return 0
    const hasta = new Date(ahora.getTime() + HORAS_ANTICIPACION * 60 * 60 * 1000)
    let avisadas = 0

    for (;;) {
        // se marca antes de avisar, así una tarea nunca se procesa dos veces
        const { value: tarea } = await collections.tareas.findOneAndUpdate(
            {
                apertura: { $lte: ahora },
                limite: { $gt: ahora, $lte: hasta },
                recordatorio_enviado: { $ne: true },
            },
            { $set: { recordatorio_enviado: true } },
            // includeResultMetadata da el mismo formato ({ value }) en las versiones 5 y 6 del driver
            { includeResultMetadata: true }
        )
        if (!tarea) break

        const asignatura = await collections.asignaturas.findOne(
            { _id: tarea.id_asignatura },
            { projection: { nombre: 1, usuarios: 1, docentes: 1, activo: 1 } }
        )
        // en una asignatura inactiva no se puede entregar: no tiene sentido recordarlo
        if (!asignatura || asignatura.activo === false) continue

        const entregaron = await collections.entregas.distinct('id_usuario', { id_tarea: tarea._id })
        const yaEntregaron = new Set(entregaron.map(String))
        await notificar({
            destinatarios: estudiantesDe(asignatura).filter((id) => !yaEntregaron.has(String(id))),
            tipo: 'tarea_por_cerrar',
            datos: { titulo: tarea.titulo, asignatura: asignatura.nombre, limite: tarea.limite },
            id_asignatura: tarea.id_asignatura,
            id_tarea: tarea._id,
        })
        avisadas++
    }
    return avisadas
}

/**
 * Inicia la revisión periódica. Devuelve una función para detenerla.
 * @param {number} [intervaloMs]
 */
const iniciarRecordatorios = (intervaloMs = 10 * 60 * 1000) => {
    const tick = () =>
        revisarTareasPorCerrar().catch((error) => console.error('Error al revisar tareas por cerrar:', error))
    const intervalo = setInterval(tick, intervaloMs)
    intervalo.unref()
    tick()
    return () => clearInterval(intervalo)
}

module.exports = { HORAS_ANTICIPACION, revisarTareasPorCerrar, iniciarRecordatorios }
