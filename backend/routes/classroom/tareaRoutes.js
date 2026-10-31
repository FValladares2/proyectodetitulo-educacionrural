const express = require('express')
const router = express.Router()
const asignServices = require('../../services/asignServices')
const recursoServices = require('../../services/recursoServices')
const tareaServices = require('../../services/tareaServices')
const { ACCIONES, registrarActividad } = require('../../services/actividadServices')
const { estudiantesDe, notificar } = require('../../services/notificacionServices')
const { ObjectId, collections, isMongoConnected } = require('../../config/mongo')
const { authenticate } = require('../../utils/auth')

/**
 * Tareas: los docentes de la asignatura las crean con un periodo de entrega (apertura a limite).
 * Durante ese periodo cada integrante sube sus archivos con POST /api/recurso/upload (campo
 * id_tarea) y luego envía la entrega. Para editar una entrega enviada se retira y se envía otra.
 * Solo el estudiante y los docentes de la asignatura ven los archivos y la calificación.
 */

const esDocenteDe = (tarea, userId) => asignServices.findDocenteInAsign(tarea.id_asignatura, userId)

const esIntegranteDe = async (tarea, userId) =>
    Boolean(await esDocenteDe(tarea, userId) || await asignServices.findUsuarioInAsign(tarea.id_asignatura, userId))

// carga la tarea de :id o responde 400/404; devuelve null si ya se respondió
const cargarTarea = async (req, res) => {
    if (!ObjectId.isValid(req.params.id)) {
        res.status(400).json({ message: 'La tarea no es válida.' })
        return null
    }
    const tarea = await tareaServices.findTareaById(req.params.id)
    if (!tarea) {
        res.status(404).json({ message: 'Tarea no encontrada.' })
        return null
    }
    return tarea
}

const conEstado = (tarea) => ({ ...tarea, estado: tareaServices.estadoTarea(tarea) })

const registrar = (tarea, id_usuario, accion, detalle) =>
    registrarActividad({ contenedor: { id_asignatura: tarea.id_asignatura }, id_usuario, accion, detalle })

// notifica sin hacer esperar a la respuesta; `destinatarios` recibe la asignatura de la tarea
const avisar = (tarea, tipo, destinatarios, excluir) => {
    asignServices.getClassById(tarea.id_asignatura)
        .then((asignatura) => {
            if (!asignatura) return null
            return notificar({
                destinatarios: destinatarios(asignatura),
                tipo,
                datos: { titulo: tarea.titulo, asignatura: asignatura.nombre, limite: tarea.limite },
                id_asignatura: tarea.id_asignatura,
                id_tarea: tarea._id,
                excluir,
            })
        })
        .catch((error) => console.error('No se pudo notificar:', error))
}

// --- tareas ---

router.post('/api/tarea', authenticate, async (req, res) => {
    try {
        const { id_asignatura } = req.body
        if (!ObjectId.isValid(id_asignatura)) {
            return res.status(400).json({ message: 'La asignatura no es válida.' })
        }
        if (!await asignServices.findDocenteInAsign(id_asignatura, req.user._id)) {
            return res.status(403).json({ message: 'Solo los docentes de la asignatura pueden crear tareas.' })
        }

        const validacion = tareaServices.validarDatosTarea(req.body)
        if (validacion.message) {
            return res.status(400).json({ message: validacion.message })
        }

        const ahora = new Date()
        const tarea = {
            id_asignatura: new ObjectId(String(id_asignatura)),
            ...validacion.datos,
            creada_por: req.user._id,
            creado_en: ahora,
            actualizado_en: ahora,
        }
        const result = await tareaServices.crearTarea(tarea)
        if (!result) {
            return res.status(503).json({ message: 'Base de datos no disponible.' })
        }

        registrar(tarea, req.user._id, ACCIONES.TAREA_CREADA, { titulo: tarea.titulo })
        avisar({ _id: result.insertedId, ...tarea }, 'tarea_creada', estudiantesDe, req.user._id)
        res.status(201).json(conEstado({ _id: result.insertedId, ...tarea }))
    } catch (error) {
        console.error('Error al crear la tarea:', error)
        res.status(500).json({ message: 'No se pudo crear la tarea.' })
    }
})

// lista sin descripciones; los docentes reciben cuántas entregas hay y los estudiantes si ya entregaron
router.get('/api/tarea/asignatura/:id_asignatura', authenticate, async (req, res) => {
    try {
        const { id_asignatura } = req.params
        if (!ObjectId.isValid(id_asignatura)) {
            return res.status(400).json({ message: 'La asignatura no es válida.' })
        }
        const esDocente = await asignServices.findDocenteInAsign(id_asignatura, req.user._id)
        if (!esDocente && !await asignServices.findUsuarioInAsign(id_asignatura, req.user._id)) {
            return res.status(403).json({ message: 'No tienes permisos para ver las tareas de esta asignatura.' })
        }

        const tareas = await tareaServices.listarTareasPorAsignatura(id_asignatura)
        if (tareas.length === 0 || !isMongoConnected()) {
            return res.status(200).json(tareas.map(conEstado))
        }

        const ids = tareas.map((t) => t._id)
        if (esDocente) {
            const conteos = await collections.entregas.aggregate([
                { $match: { id_tarea: { $in: ids } } },
                { $group: { _id: '$id_tarea', total: { $sum: 1 } } },
            ]).toArray()
            const porTarea = new Map(conteos.map((c) => [String(c._id), c.total]))
            return res.status(200).json(tareas.map((t) => ({ ...conEstado(t), entregas: porTarea.get(String(t._id)) || 0 })))
        }

        const propias = await collections.entregas
            .find({ id_tarea: { $in: ids }, id_usuario: req.user._id })
            .project({ id_tarea: 1, enviada_en: 1 })
            .toArray()
        const enviadas = new Map(propias.map((e) => [String(e.id_tarea), e.enviada_en]))
        res.status(200).json(tareas.map((t) => ({ ...conEstado(t), enviada_en: enviadas.get(String(t._id)) || null })))
    } catch (error) {
        console.error('Error al listar las tareas:', error)
        res.status(500).json({ message: 'No se pudieron obtener las tareas.' })
    }
})

router.get('/api/tarea/:id', authenticate, async (req, res) => {
    try {
        const tarea = await cargarTarea(req, res)
        if (!tarea) return
        if (!await esIntegranteDe(tarea, req.user._id)) {
            return res.status(403).json({ message: 'No tienes permisos para ver esta tarea.' })
        }
        res.status(200).json(conEstado(tarea))
    } catch (error) {
        console.error('Error al obtener la tarea:', error)
        res.status(500).json({ message: 'No se pudo obtener la tarea.' })
    }
})

router.put('/api/tarea/:id', authenticate, async (req, res) => {
    try {
        const tarea = await cargarTarea(req, res)
        if (!tarea) return
        if (!await esDocenteDe(tarea, req.user._id)) {
            return res.status(403).json({ message: 'Solo los docentes de la asignatura pueden editar tareas.' })
        }

        const validacion = tareaServices.validarDatosTarea(req.body, tarea)
        if (validacion.message) {
            return res.status(400).json({ message: validacion.message })
        }

        const cambios = { ...validacion.datos, actualizado_en: new Date() }
        // con un nuevo límite, el recordatorio de cierre vuelve a enviarse cuando corresponda
        if (cambios.limite && cambios.limite.getTime() !== new Date(tarea.limite).getTime()) {
            cambios.recordatorio_enviado = false
        }
        await tareaServices.actualizarTarea(tarea._id, cambios)
        registrar(tarea, req.user._id, ACCIONES.TAREA_EDITADA, { titulo: cambios.titulo ?? tarea.titulo })
        res.status(200).json(conEstado({ ...tarea, ...cambios }))
    } catch (error) {
        console.error('Error al editar la tarea:', error)
        res.status(500).json({ message: 'No se pudo editar la tarea.' })
    }
})

// elimina también las entregas y sus archivos
router.delete('/api/tarea/:id', authenticate, async (req, res) => {
    try {
        const tarea = await cargarTarea(req, res)
        if (!tarea) return
        if (!await esDocenteDe(tarea, req.user._id)) {
            return res.status(403).json({ message: 'Solo los docentes de la asignatura pueden eliminar tareas.' })
        }

        await tareaServices.eliminarTarea(tarea._id)
        registrar(tarea, req.user._id, ACCIONES.TAREA_ELIMINADA, { titulo: tarea.titulo })
        res.status(200).json({ message: 'Tarea eliminada correctamente.' })
    } catch (error) {
        console.error('Error al eliminar la tarea:', error)
        res.status(500).json({ message: 'No se pudo eliminar la tarea.' })
    }
})

// --- entrega propia ---

// la entrega del usuario (null si no ha enviado), sus archivos y si todavía puede modificarlos
router.get('/api/tarea/:id/mi-entrega', authenticate, async (req, res) => {
    try {
        const tarea = await cargarTarea(req, res)
        if (!tarea) return
        if (!await esIntegranteDe(tarea, req.user._id)) {
            return res.status(403).json({ message: 'No tienes permisos para ver esta tarea.' })
        }

        const [entrega, archivos] = await Promise.all([
            tareaServices.findEntrega(tarea._id, req.user._id),
            recursoServices.findRecursosByTarea(tarea._id, req.user._id),
        ])
        res.status(200).json({
            estado: tareaServices.estadoTarea(tarea),
            entrega,
            archivos,
            puedeEditarArchivos: !entrega && tareaServices.estadoTarea(tarea) === 'abierta',
        })
    } catch (error) {
        console.error('Error al obtener la entrega:', error)
        res.status(500).json({ message: 'No se pudo obtener la entrega.' })
    }
})

// enviar; si ya había una entrega se reemplaza por una nueva (y pierde su calificación)
router.post('/api/tarea/:id/entrega', authenticate, async (req, res) => {
    try {
        const tarea = await cargarTarea(req, res)
        if (!tarea) return
        const motivo = await tareaServices.motivoFueraDePlazo(tarea, req.user._id)
        if (motivo) {
            return res.status(motivo.status).json({ message: motivo.message })
        }

        const archivos = await recursoServices.findRecursosByTarea(tarea._id, req.user._id)
        if (archivos.length === 0) {
            return res.status(400).json({ message: 'Sube al menos un archivo antes de enviar la entrega.' })
        }

        const entrega = await tareaServices.reemplazarEntrega(tarea._id, req.user._id)
        if (!entrega) {
            return res.status(503).json({ message: 'Base de datos no disponible.' })
        }

        registrar(tarea, req.user._id, ACCIONES.ENTREGA_ENVIADA, { titulo: tarea.titulo, archivos: archivos.length })
        avisar(tarea, 'entrega_recibida', (asignatura) => asignatura.docentes || [], req.user._id)
        res.status(201).json({ entrega, archivos })
    } catch (error) {
        console.error('Error al enviar la entrega:', error)
        res.status(500).json({ message: 'No se pudo enviar la entrega.' })
    }
})

// retirar: la entrega se elimina y sus archivos quedan como borrador para editarlos o borrarlos
router.delete('/api/tarea/:id/entrega', authenticate, async (req, res) => {
    try {
        const tarea = await cargarTarea(req, res)
        if (!tarea) return
        const motivo = await tareaServices.motivoFueraDePlazo(tarea, req.user._id)
        if (motivo) {
            return res.status(motivo.status).json({ message: motivo.message })
        }

        const result = await tareaServices.eliminarEntrega(tarea._id, req.user._id)
        if (!result || result.deletedCount === 0) {
            return res.status(404).json({ message: 'No hay una entrega enviada para retirar.' })
        }

        registrar(tarea, req.user._id, ACCIONES.ENTREGA_RETIRADA, { titulo: tarea.titulo })
        res.status(200).json({ message: 'Entrega retirada. Puedes modificar tus archivos y enviarla de nuevo.' })
    } catch (error) {
        console.error('Error al retirar la entrega:', error)
        res.status(500).json({ message: 'No se pudo retirar la entrega.' })
    }
})

// --- revisión docente ---

router.get('/api/tarea/:id/entregas', authenticate, async (req, res) => {
    try {
        const tarea = await cargarTarea(req, res)
        if (!tarea) return
        if (!await esDocenteDe(tarea, req.user._id)) {
            return res.status(403).json({ message: 'Solo los docentes de la asignatura pueden ver las entregas.' })
        }
        res.status(200).json(await tareaServices.listarEntregas(tarea._id))
    } catch (error) {
        console.error('Error al listar las entregas:', error)
        res.status(500).json({ message: 'No se pudieron obtener las entregas.' })
    }
})

// { calificacion: número | null, comentario?: string }; se puede calificar en cualquier momento
router.put('/api/tarea/:id/entregas/:id_usuario', authenticate, async (req, res) => {
    try {
        const tarea = await cargarTarea(req, res)
        if (!tarea) return
        if (!ObjectId.isValid(req.params.id_usuario)) {
            return res.status(400).json({ message: 'El estudiante no es válido.' })
        }
        if (!await esDocenteDe(tarea, req.user._id)) {
            return res.status(403).json({ message: 'Solo los docentes de la asignatura pueden calificar.' })
        }

        const validacion = tareaServices.validarCalificacion(req.body)
        if (validacion.message) {
            return res.status(400).json({ message: validacion.message })
        }

        const entrega = await tareaServices.calificarEntrega(
            tarea._id,
            req.params.id_usuario,
            validacion.datos,
            req.user._id
        )
        if (!entrega) {
            return res.status(404).json({ message: 'El estudiante no ha enviado esta tarea.' })
        }

        registrar(tarea, req.user._id, ACCIONES.ENTREGA_CALIFICADA, { titulo: tarea.titulo })
        avisar(tarea, 'entrega_calificada', () => [req.params.id_usuario])
        res.status(200).json(entrega)
    } catch (error) {
        console.error('Error al calificar la entrega:', error)
        res.status(500).json({ message: 'No se pudo calificar la entrega.' })
    }
})

module.exports = router
