const express = require('express')
const router = express.Router()
const asignServices = require('../../services/asignServices')
const orgServices = require('../../services/orgServices')
const actividadServices = require('../../services/actividadServices')
const { ObjectId } = require('../../config/mongo')
const { authenticate } = require('../../utils/auth')

// ?limit=30&antes=<fecha ISO de la última entrada recibida> para paginar hacia atrás
const leerPaginacion = (query) => {
    const limit = Number.parseInt(query.limit, 10)
    const antes = query.antes ? new Date(query.antes) : undefined
    if (antes && Number.isNaN(antes.getTime())) return null
    return {
        limit: Number.isNaN(limit) ? 30 : Math.min(Math.max(1, limit), actividadServices.LIMITE_MAXIMO),
        antes,
    }
}

// la página siguiente comienza antes de la última entrada; null si no hay más
const responder = (res, actividad, limit) =>
    res.status(200).json({
        actividad,
        siguiente: actividad.length === limit ? actividad[actividad.length - 1].fecha : null,
    })

// visible para los docentes de la asignatura y los administradores de su organización
router.get('/api/actividad/asignatura/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params
        const paginacion = leerPaginacion(req.query)
        if (!ObjectId.isValid(id) || !paginacion) {
            return res.status(400).json({ message: 'Parámetros inválidos.' })
        }

        const asignatura = await asignServices.getClassById(id)
        if (!asignatura) {
            return res.status(404).json({ message: 'Asignatura no encontrada.' })
        }
        const esDocente = await asignServices.findDocenteInAsign(id, req.user._id)
        const esAdmin = !esDocente && asignatura.id_organizacion && ObjectId.isValid(asignatura.id_organizacion)
            ? await orgServices.findAdminInOrg(asignatura.id_organizacion, req.user._id)
            : false
        if (!esDocente && !esAdmin) {
            return res.status(403).json({ message: 'No tienes permisos para ver la actividad de esta asignatura.' })
        }

        const actividad = await actividadServices.listarActividad({ id_asignatura: id }, paginacion)
        responder(res, actividad, paginacion.limit)
    } catch (error) {
        console.error('Error al obtener la actividad de la asignatura:', error)
        res.status(500).json({ message: 'No se pudo obtener la actividad.' })
    }
})

// visible solo para los administradores de la organización
router.get('/api/actividad/organizacion/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params
        const paginacion = leerPaginacion(req.query)
        if (!ObjectId.isValid(id) || !paginacion) {
            return res.status(400).json({ message: 'Parámetros inválidos.' })
        }
        if (!await orgServices.findAdminInOrg(id, req.user._id)) {
            return res.status(403).json({ message: 'Solo un administrador puede ver la actividad de la organización.' })
        }

        const actividad = await actividadServices.listarActividad({ id_organizacion: id }, paginacion)
        responder(res, actividad, paginacion.limit)
    } catch (error) {
        console.error('Error al obtener la actividad de la organización:', error)
        res.status(500).json({ message: 'No se pudo obtener la actividad.' })
    }
})

module.exports = router
