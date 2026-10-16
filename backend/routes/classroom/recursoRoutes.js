const express = require('express')
const multer = require('multer')
const router = express.Router()
const asignServices = require('../../services/asignServices')
const orgServices = require('../../services/orgServices')
const recursoServices = require('../../services/recursoServices')
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

// un recurso pertenece a una asignatura o, para archivos generales como banners, a una organización
const puedeVerContenedor = async (contenedor, userId) => {
    if (contenedor.id_organizacion) {
        return Boolean(await orgServices.findUserInOrg(contenedor.id_organizacion, userId))
    }
    return Boolean(
        await asignServices.findDocenteInAsign(contenedor.id_asignatura, userId) ||
        await asignServices.findUsuarioInAsign(contenedor.id_asignatura, userId)
    )
}

// en asignaturas editan los docentes; en organizaciones, los administradores
const puedeEditarContenedor = async (contenedor, userId) => {
    if (contenedor.id_organizacion) {
        return Boolean(await orgServices.findAdminInOrg(contenedor.id_organizacion, userId))
    }
    return Boolean(await asignServices.findDocenteInAsign(contenedor.id_asignatura, userId))
}

router.post('/api/recurso/upload', authenticate, subirArchivo, async (req, res) => {
    try {
        const user = req.user
        const { id_asignatura, id_organizacion } = req.body

        // se sube a una asignatura o a una organización, nunca a ambas
        if (!req.file || Boolean(id_asignatura) === Boolean(id_organizacion)) {
            return res.status(400).json({ message: 'Faltan campos obligatorios.' })
        }
        if (id_organizacion && !ObjectId.isValid(id_organizacion)) {
            return res.status(400).json({ message: 'La organización no es válida.' })
        }
        const contenedor = id_organizacion ? { id_organizacion } : { id_asignatura }

        if (!await puedeEditarContenedor(contenedor, user._id)) {
            return res.status(403).json({ message: 'No tienes permisos para subir archivos aquí.' })
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
            ruta: '/',
            recurso: recursoCifrado,
            codificacion: 'base64',
            mimetype: req.file.mimetype || 'application/octet-stream',
            tamano: req.file.size,
            usuario: user._id,
            createdAt: ahora,
            updatedAt: ahora,
            limite_apertura: null,
            limite_cierre: null,
            id_tarea: null,
        }

        const result = await recursoServices.createRecurso(archiv)
        if (!result) {
            return res.status(503).json({ message: 'Base de datos no disponible.' })
        }

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

        const contenido = await recursoServices.descifrarRecurso(archiv.recurso, archiv.usuario)
        // recursos creados por /api/recurso/add guardan texto u objetos en vez de un archivo en base64
        const buffer = archiv.codificacion === 'base64'
            ? Buffer.from(contenido, 'base64')
            : Buffer.from(typeof contenido === 'string' ? contenido : JSON.stringify(contenido), 'utf8')

        res.attachment(archiv.nombre)
        if (archiv.mimetype) {
            res.type(archiv.mimetype)
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
        if (!await puedeEditarContenedor(contenedor, user._id)) {
            return res.status(403).json({ message: 'No tienes permisos para editar este recurso.' })
        }
        if (await recursoServices.existeNombreEnContenedor(contenedor, nombre, id)) {
            return res.status(409).json({ message: 'Ya existe un archivo con ese nombre.' })
        }

        const cambios = { nombre, updatedAt: new Date() }
        await recursoServices.updateRecurso(id, cambios)
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
        if (!await puedeEditarContenedor(recursoServices.getContenedor(archiv), user._id)) {
            return res.status(403).json({ message: 'No tienes permisos para eliminar este recurso.' })
        }

        await recursoServices.deleteRecurso(id)
        res.status(200).json({ message: 'Recurso eliminado correctamente.' })
    } catch (error) {
        console.error('Error al eliminar el recurso:', error)
        res.status(500).json({ message: 'No se pudo eliminar el recurso.' })
    }
})

router.post('/api/recurso/add', authenticate, async (req, res) => {
    try {
        const user = await getUserFromToken(req.headers.authorization.split(' ')[1])
        const { id_asignatura, nombre, ruta, recurso, id_tarea, limite_apertura, limite_cierre, fecha_entrega } = req.body //todo: definir tarea

        if (!id_asignatura || !nombre) {
            return res.status(400).json({ message: 'Faltan campos obligatorios.' })
        }

        if (!await asignServices.findDocenteInAsign(id_asignatura, user._id)) {
            return res.status(403).json({ message: 'No tienes permisos para crear un archivo en esta asignatura.' })
        }
        if (id_tarea && !await asignServices.findUsuarioInAsign(id_asignatura, user._id)) {
            return res.status(403).json({ message: 'No tienes permisos para subir una respuesta a tareas en esta asignatura.' })
        }

        const recursoCifrado = await recursoServices.cifrarRecurso(recurso, user._id);

        const archiv = await recursoServices.createRecurso({
            id_asignatura,
            nombre,
            ruta,
            recurso: recursoCifrado,
            usuario: user._id,
            createdAt: new Date(),
            limite_apertura: limite_apertura ? new Date(limite_apertura) : null, //apertura y cierre son para recursos descargables dentro de la asignatura
            limite_cierre: limite_cierre ? new Date(limite_cierre) : null,
            fecha_entrega: fecha_entrega ? new Date(fecha_entrega) : new Date(), //fecha de entrega es para entregas a tareas
            id_tarea: id_tarea || null,
        })
        res.status(200).json(archiv)
    } catch (error) {
        console.error('Error al crear el archivo:', error)
        res.status(500).json({ message: 'No se pudo crear el archivo.' })
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
            recursoDescifrado = await recursoServices.descifrarRecurso(archiv.recurso, archiv.usuario)
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

