const express = require('express')
const multer = require('multer')
const router = express.Router()
const asignServices = require('../../services/asignServices')
const orgServices = require('../../services/orgServices')
const recursoServices = require('../../services/recursoServices')
const tareaServices = require('../../services/tareaServices')
const { ACCIONES, registrarActividad } = require('../../services/actividadServices')
const { ObjectId } = require('../../config/mongo')

const { authenticate, getUserFromToken } = require('../../utils/auth')

const regexTipoArchivo = "/\.[0-9a-z]+$/i";

// el archivo cifrado en base64 crece ~33%, y un documento de mongo no puede superar 16MB
const MAX_TAMANO_ARCHIVO = 10 * 1024 * 1024

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_TAMANO_ARCHIVO, files: 1 },
})

const subirArchivo = (req, res, next) => {
    upload.single('file')(req, res, (err) => {
        if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({ message: 'El archivo supera el tamaño máximo de 10MB.' })
        }
        if (err) {
            return res.status(400).json({ message: 'No se pudo procesar el archivo.' })
        }
        next()
    })
}

// multer entrega el nombre original decodificado como latin1, lo que rompe tildes y ñ
const decodificarNombre = (nombre) => Buffer.from(nombre, 'latin1').toString('utf8')

const validarNombre = (nombre) => {
    if (typeof nombre !== 'string') return null
    const limpio = nombre.trim()
    if (!limpio || limpio.length > 255 || /[\/\\]/.test(limpio)) return null
    return limpio
}

// solo metadatos, nunca el contenido cifrado
const sinContenido = ({ recurso, ...metadatos }) => metadatos

// un recurso pertenece a una asignatura, a una organización (archivos generales como banners)
// o a una tarea (archivos de la entrega de un estudiante, privados para él y los docentes)
const puedeVerContenedor = async (contenedor, userId) => {
    if (contenedor.id_tarea) {
        if (String(contenedor.id_usuario) === String(userId)) return true
        const tarea = await tareaServices.findTareaById(contenedor.id_tarea)
        return Boolean(tarea && await asignServices.findDocenteInAsign(tarea.id_asignatura, userId))
    }
    if (contenedor.id_organizacion) {
        return Boolean(await orgServices.findUserInOrg(contenedor.id_organizacion, userId))
    }
    return Boolean(
        await asignServices.findDocenteInAsign(contenedor.id_asignatura, userId) ||
        await asignServices.findUsuarioInAsign(contenedor.id_asignatura, userId)
    )
}

/**
 * Comprueba si el usuario puede subir, renombrar o eliminar archivos del contenedor.
 * En asignaturas editan los docentes y en organizaciones los administradores; en una tarea,
 * cada estudiante edita solo sus archivos (ver tareaServices.motivoSinEdicionEntrega).
 * @returns {Promise<null | { status: number, message: string }>} null si puede editar
 */
const motivoSinEdicion = async (contenedor, userId, mensajeSinPermiso) => {
    if (contenedor.id_tarea) {
        return tareaServices.motivoSinEdicionEntrega(contenedor, userId)
    }
    const puede = contenedor.id_organizacion
        ? await orgServices.findAdminInOrg(contenedor.id_organizacion, userId)
        : await asignServices.findDocenteInAsign(contenedor.id_asignatura, userId)
    return puede ? null : { status: 403, message: mensajeSinPermiso }
}

// los archivos de entregas no se registran uno a uno; se registra el envío de la entrega
const registrarActividadRecurso = (contenedor, entrada) => {
    if (contenedor.id_tarea) return
    registrarActividad({ contenedor, ...entrada })
}

router.post('/api/recurso/upload', authenticate, subirArchivo, async (req, res) => {
    try {
        const user = req.user
        const { id_asignatura, id_organizacion, id_tarea } = req.body

        // se sube a exactamente un contenedor: asignatura, organización o tarea
        const destinos = [id_asignatura, id_organizacion, id_tarea].filter(Boolean)
        if (!req.file || destinos.length !== 1) {
            return res.status(400).json({ message: 'Faltan campos obligatorios.' })
        }
        if ((id_organizacion || id_tarea) && !ObjectId.isValid(destinos[0])) {
            return res.status(400).json({ message: 'El destino del archivo no es válido.' })
        }
        // en una tarea el archivo pertenece a quien lo sube, que es quien entrega
        const contenedor = recursoServices.normalizarContenedor(
            id_tarea
                ? { id_tarea, id_usuario: user._id }
                : id_organizacion ? { id_organizacion } : { id_asignatura }
        )

        const motivo = await motivoSinEdicion(contenedor, user._id, 'No tienes permisos para subir archivos aquí.')
        if (motivo) {
            return res.status(motivo.status).json({ message: motivo.message })
        }

        const nombre = validarNombre(decodificarNombre(req.file.originalname))
        if (!nombre) {
            return res.status(400).json({ message: 'El nombre del archivo no es válido.' })
        }
        if (await recursoServices.existeNombreEnContenedor(contenedor, nombre)) {
            return res.status(409).json({ message: 'Ya existe un archivo con ese nombre.' })
        }

        // se cifra como base64 porque descifrarRecurso devuelve texto utf8, lo que corrompería binarios
        const recursoCifrado = await recursoServices.cifrarRecurso(req.file.buffer.toString('base64'), user._id)
        const ahora = new Date()
        const archiv = {
            ...contenedor,
            nombre,
            recurso: recursoCifrado,
            codificacion: 'base64',
            tipo_mime: req.file.mimetype || 'application/octet-stream',
            tamano: req.file.size,
            id_usuario: user._id,
            creado_en: ahora,
            actualizado_en: ahora,
        }

        const result = await recursoServices.createRecurso(archiv)
        if (!result) {
            return res.status(503).json({ message: 'Base de datos no disponible.' })
        }

        registrarActividadRecurso(contenedor, {
            id_usuario: user._id,
            accion: ACCIONES.RECURSO_SUBIDO,
            detalle: { nombre },
        })

        res.status(201).json({ _id: result.insertedId, ...sinContenido(archiv) })
    } catch (error) {
        console.error('Error al subir el archivo:', error)
        res.status(500).json({ message: 'No se pudo subir el archivo.' })
    }
})

router.get('/api/recurso/:id/descarga', authenticate, async (req, res) => {
    try {
        const user = req.user
        const archiv = await recursoServices.findRecursoById(req.params.id)
        if (!archiv) {
            return res.status(404).json({ message: 'Recurso no encontrado.' })
        }

        if (!await puedeVerContenedor(recursoServices.getContenedor(archiv), user._id)) {
            return res.status(403).json({ message: 'No tienes permisos para descargar este recurso.' })
        }
        if (!archiv.recurso) {
            return res.status(404).json({ message: 'El recurso no tiene contenido.' })
        }

        const contenido = await recursoServices.descifrarRecurso(archiv.recurso, archiv.id_usuario)
        // recursos antiguos (de la ruta /api/recurso/add, ya eliminada) guardan texto u objetos en vez de base64
        const buffer = archiv.codificacion === 'base64'
            ? Buffer.from(contenido, 'base64')
            : Buffer.from(typeof contenido === 'string' ? contenido : JSON.stringify(contenido), 'utf8')

        res.attachment(archiv.nombre)
        if (archiv.tipo_mime) {
            res.type(archiv.tipo_mime)
        }
        res.status(200).send(buffer)
    } catch (error) {
        console.error('Error al descargar el recurso:', error)
        res.status(500).json({ message: 'No se pudo descargar el recurso.' })
    }
})

router.patch('/api/recurso/:id', authenticate, async (req, res) => {
    try {
        const user = req.user
        const { id } = req.params

        const nombre = validarNombre(req.body.nombre)
        if (!nombre) {
            return res.status(400).json({ message: 'El nombre no es válido.' })
        }

        const archiv = await recursoServices.findRecursoById(id)
        if (!archiv) {
            return res.status(404).json({ message: 'Recurso no encontrado.' })
        }
        const contenedor = recursoServices.getContenedor(archiv)
        const motivo = await motivoSinEdicion(contenedor, user._id, 'No tienes permisos para editar este recurso.')
        if (motivo) {
            return res.status(motivo.status).json({ message: motivo.message })
        }
        if (await recursoServices.existeNombreEnContenedor(contenedor, nombre, id)) {
            return res.status(409).json({ message: 'Ya existe un archivo con ese nombre.' })
        }

        const cambios = { nombre, actualizado_en: new Date() }
        await recursoServices.updateRecurso(id, cambios)
        registrarActividadRecurso(contenedor, {
            id_usuario: user._id,
            accion: ACCIONES.RECURSO_RENOMBRADO,
            detalle: { anterior: archiv.nombre, nombre },
        })
        res.status(200).json(sinContenido({ ...archiv, ...cambios }))
    } catch (error) {
        console.error('Error al editar el recurso:', error)
        res.status(500).json({ message: 'No se pudo editar el recurso.' })
    }
})

router.delete('/api/recurso/:id', authenticate, async (req, res) => {
    try {
        const user = req.user
        const { id } = req.params

        const archiv = await recursoServices.findRecursoById(id)
        if (!archiv) {
            return res.status(404).json({ message: 'Recurso no encontrado.' })
        }
        const contenedor = recursoServices.getContenedor(archiv)
        const motivo = await motivoSinEdicion(contenedor, user._id, 'No tienes permisos para eliminar este recurso.')
        if (motivo) {
            return res.status(motivo.status).json({ message: motivo.message })
        }

        await recursoServices.deleteRecurso(id)
        // se guarda el nombre porque el recurso ya no existirá para consultarlo
        registrarActividadRecurso(contenedor, {
            id_usuario: user._id,
            accion: ACCIONES.RECURSO_ELIMINADO,
            detalle: { nombre: archiv.nombre },
        })
        res.status(200).json({ message: 'Recurso eliminado correctamente.' })
    } catch (error) {
        console.error('Error al eliminar el recurso:', error)
        res.status(500).json({ message: 'No se pudo eliminar el recurso.' })
    }
})

router.get('/api/recurso/:id', authenticate, async (req, res) => {
    try {
        const user = req.user || await getUserFromToken(req.headers.authorization.split(' ')[1])
        const { id } = req.params

        const archiv = await recursoServices.findRecursoById(id)
        if (!archiv) {
            return res.status(404).json({ message: 'Recurso no encontrado.' })
        }

        if (!await puedeVerContenedor(recursoServices.getContenedor(archiv), user._id)) {
            return res.status(403).json({ message: 'No tienes permisos para ver este recurso.' })
        }

        let recursoDescifrado = null
        if (archiv.recurso) {
            recursoDescifrado = await recursoServices.descifrarRecurso(archiv.recurso, archiv.id_usuario)
        }

        res.status(200).json({
            ...archiv,
            recurso: recursoDescifrado,
        })
    } catch (error) {
        console.error('Error al obtener el recurso:', error)
        res.status(500).json({ message: 'No se pudo obtener el recurso.' })
    }
})

router.get('/api/recurso/asignatura/:id_asignatura', authenticate, async (req, res) => {
    try {
        const user = req.user || await getUserFromToken(req.headers.authorization.split(' ')[1])
        const { id_asignatura } = req.params

        const isDocente = await asignServices.findDocenteInAsign(id_asignatura, user._id)
        const isUsuario = await asignServices.findUsuarioInAsign(id_asignatura, user._id)
        if (!isDocente && !isUsuario) {
            return res.status(403).json({ message: 'No tienes permisos para ver los recursos de esta asignatura.' })
        }

        const recursos = await recursoServices.findRecursosByAsignatura(id_asignatura)
        res.status(200).json(recursos)
    } catch (error) {
        console.error('Error al listar recursos de la asignatura:', error)
        res.status(500).json({ message: 'No se pudieron obtener los recursos.' })
    }
})

router.get('/api/recurso/organizacion/:id_organizacion', authenticate, async (req, res) => {
    try {
        const { id_organizacion } = req.params
        if (!ObjectId.isValid(id_organizacion)) {
            return res.status(400).json({ message: 'La organización no es válida.' })
        }
        if (!await puedeVerContenedor({ id_organizacion }, req.user._id)) {
            return res.status(403).json({ message: 'No tienes permisos para ver los recursos de esta organización.' })
        }

        const recursos = await recursoServices.findRecursosByOrganizacion(id_organizacion)
        res.status(200).json(recursos)
    } catch (error) {
        console.error('Error al listar recursos de la organización:', error)
        res.status(500).json({ message: 'No se pudieron obtener los recursos.' })
    }
})

module.exports = router

