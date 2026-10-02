const express = require('express')
const router = express.Router()
const orgServices = require('../../services/orgServices')
const classServices = require('../../services/asignServices')
const userServices = require('../../services/userServices')
const { authenticate, getUserFromToken } = require('../../utils/auth')

router.post('/api/asign/create', authenticate, async (req, res) => {
    // solo puede crear una clase un usuario que sea administrador de la organización
    try {
        const user = await getUserFromToken(req.headers.authorization.split(' ')[1])
        const isU = await orgServices.findUserInOrg(req.body.id_organizacion, user._id)

        if (!isU) {
            return res.status(403).json({ message: 'No tienes permisos para crear una clase en esta organización.' })
        }
        const isProfesor = await orgServices.findTeacherInOrg(req.body.id_organizacion, user._id)

        if (!isProfesor) {
            return res.status(403).json({ message: 'No tienes permisos para crear una clase en esta organización.' })
        }

        const { nombre, id_organizacion } = req.body

        if (!nombre || !id_organizacion) {
            return res.status(400).json({ message: 'Faltan campos obligatorios.' })
        }

        const classRoom = await classServices.createClass({
            nombre,
            id_organizacion,
            docentes: [user._id],
            usuarios: [user._id],
            activo: true,
            createdAt: new Date(),
        })

        if (Array.isArray(req.body.correos) && req.body.correos.length > 0) {
            const classId = classRoom.insertedId || classRoom._id
            for (const correo of req.body.correos) {
                const usuario = await userServices.findUserByUsernameOrEmail(correo)
                if (usuario) {  
                    await classServices.addUsuarioToAsign(classId, usuario._id)
                }
            }
        }

        res.status(200).json(classRoom)
    } catch (error) {
        console.error('Error al crear la asignatura:', error)
        res.status(500).json({ message: 'No se pudo crear la asignatura.' })
    }
})

router.get('/api/asign/user', authenticate, async (req, res) => {
    try {
        const user = await getUserFromToken(req.headers.authorization.split(' ')[1])
        const { id_organizacion, soloDocente, activo, page, limit, search, sortBy, order } = req.query
        if (!id_organizacion) {
            return res.status(400).json({ message: 'Faltan campos obligatorios.' })
        }
        if (!await orgServices.findUserInOrg(id_organizacion, user._id)) {
            return res.status(403).json({ message: 'No tienes permisos para ver clases en esta organización.' })
        }
        const result = await classServices.getFilteredClasses({
            userId: user._id,
            id_organizacion,
            soloDocente: soloDocente === 'true',
            activo: activo !== undefined ? activo : true,
            page: parseInt(page, 10) || 1,
            limit: parseInt(limit, 10) || 10,
            search,
            sortBy,
            order,
        })
        res.status(200).json(result)
    } catch (error) {
        console.error('Error al obtener las asignaturas:', error)
        res.status(500).json({ message: 'No se pudo obtener las asignaturas.' })
    }
})

router.get('/api/asign/:id', authenticate, async (req, res) => {
    try {
        const user = await getUserFromToken(req.headers.authorization.split(' ')[1])
        const { id } = req.params
        console.log('usuario ', user._id, ' busca la asignatura ', id)

        if (!id) {
            return res.status(400).json({ message: 'Faltan campos obligatorios.' })
        }
        if (!await classServices.findUsuarioInAsign(id, user._id)) {
            console.log('usuario ', user._id, ' no se encuentra en la asignatura ', id)
            return res.status(403).json({ message: 'No tienes permisos para ver esta asignatura.' })
        }

        const asignatura = await classServices.getClassById(id)
        if (!asignatura.formato_markup) {
            asignatura.formato_markup = '# ' + asignatura.nombre + '\n\nEste contenido será visible para todos los integrantes de la asignatura. Asegurate de editarlo para que sea de ayuda.'
            await classServices.updateClass(id, asignatura)
        }
        res.status(200).json(asignatura)
    } catch (error) {
        console.error('Error al obtener la asignatura:', error)
        res.status(500).json({ message: 'No se pudo obtener la asignatura.' })
    }
})

router.put('/api/asign/:id', authenticate, async (req, res) => {
    try {
        const user = await getUserFromToken(req.headers.authorization.split(' ')[1])
        const { id } = req.params
        console.log('usuario ', user._id, ' busca la asignatura ', id)

        if (!id) {
            return res.status(400).json({ message: 'Faltan campos obligatorios.' })
        }
        if (!await classServices.findDocenteInAsign(id, user._id)) {
            console.log('usuario ', user._id, ' no se encuentra en la asignatura ', id)
            return res.status(403).json({ message: 'No tienes permisos para editar esta asignatura.' })
        }

        if (typeof req.body.formato_markup !== 'string') {
            return res.status(400).json({ message: 'El contenido debe estar en formato Markdown.' })
        }

        const result = await classServices.updateClass(id, { formato_markup: req.body.formato_markup })
        if (!result || result.matchedCount === 0) {
            return res.status(404).json({ message: 'Asignatura no encontrada.' })
        }

        res.status(200).json({ formato_markup: req.body.formato_markup })
    } catch (error) {
        console.error('Error al obtener la asignatura:', error)
        res.status(500).json({ message: 'No se pudo obtener la asignatura.' })
    }
})

router.put('/api/asign/addUser', authenticate, async (req, res) => {
    try {
        const user = await getUserFromToken(req.headers.authorization.split(' ')[1])
        const { id_asignatura, id_usuario } = req.body

        const asignatura = await classServices.getClassById(id_asignatura)
        if (!asignatura) {
            return res.status(404).json({ message: 'Asignatura no encontrada.' })
        }

        if (!id_asignatura || !id_usuario) {
            return res.status(400).json({ message: 'Faltan campos obligatorios.' })
        }
        if (!await classServices.findDocenteInAsign(id_asignatura, user._id)) {
            return res.status(403).json({ message: 'No tienes permisos para agregar usuario a esta asignatura.' })
        }
        if (await classServices.findUsuarioInAsign(id_asignatura, id_usuario)) {
            return res.status(403).json({ message: 'El usuario ya está en la asignatura.' })
        }

        await classServices.addUsuarioToAsign(id_asignatura, id_usuario)
        res.status(200).json({ message: 'Usuario agregado a la asignatura exitosamente.' })
    } catch (error) {
        console.error('Error al agregar usuario a la asignatura:', error)
        res.status(500).json({ message: 'No se pudo agregar usuario a la asignatura.' })
    }
})

router.get('/api/asign/:id/users', authenticate, async (req, res) => {
    try {
        const user = await getUserFromToken(req.headers.authorization.split(' ')[1])
        const { id } = req.params

        if (!id) {
            return res.status(400).json({ message: 'Faltan campos obligatorios.' })
        }

        const asignatura = await classServices.getClassById(id)
        if (!asignatura) {
            return res.status(404).json({ message: 'Asignatura no encontrada.' })
        }

        const isUserInAsign = await classServices.findUsuarioInAsign(id, user._id)
        if (!isUserInAsign) {
            return res.status(403).json({ message: 'No tienes permisos para ver los integrantes de esta asignatura.' })
        }

        const docenteIds = (asignatura.docentes || []).map(d => d.toString())
        const teachers = await userServices.getUserBatchBasicInfo(asignatura.docentes || [])
        const alumnoIds = (asignatura.usuarios || []).filter(
            usuario => !docenteIds.includes(usuario.toString())
        )
        const users = await userServices.getUserBatchBasicInfo(alumnoIds)

        res.status(200).json({
            teachers: teachers || [],
            users: users || [],
        })
    } catch (error) {
        console.error('Error al obtener los usuarios de la asignatura:', error)
        res.status(500).json({ message: 'No se pudo obtener los usuarios de la asignatura.' })
    }
})

router.post('/api/asign/users/batch', authenticate, async (req, res) => {
    try {
        const user = await getUserFromToken(req.headers.authorization.split(' ')[1])
        const { id_asignatura, usuarios } = req.body

        if (!id_asignatura || !Array.isArray(usuarios) || usuarios.length === 0) {
            return res.status(400).json({ message: 'La asignatura y los usuarios son obligatorios.' })
        }

        const asignatura = await classServices.getClassById(id_asignatura)
        if (!asignatura) {
            return res.status(404).json({ message: 'Asignatura no encontrada.' })
        }

        const isDocente = await classServices.findDocenteInAsign(id_asignatura, user._id)
        const isAdmin = asignatura.id_organizacion ? await orgServices.findAdminInOrg(asignatura.id_organizacion, user._id) : false
        if (!isDocente && !isAdmin) {
            return res.status(403).json({ message: 'No tienes permisos para agregar usuarios a esta asignatura.' })
        }
        const profesoresToAdd = []
        const alumnosToAdd = []

        for (const item of usuarios) {
            console.log('Procesando usuario:', item)
            let targetUserId = item._id || item.id_usuario
            if (!targetUserId && item.correo) {
                const foundUser = await userServices.findUserByUsernameOrEmail(item.correo.trim().toLowerCase())
                if (foundUser) {
                    targetUserId = foundUser._id
                }
            }

            if (!targetUserId) {
                console.warn('Usuario no encontrado para:', item)
                continue
            }

            // Verify user belongs to the organization
            if (asignatura.id_organizacion) {
                const inOrg = await orgServices.findUserInOrg(asignatura.id_organizacion, targetUserId)
                if (!inOrg) {
                    console.warn(`Usuario ${targetUserId} no pertenece a la organización ${asignatura.id_organizacion}`)
                    continue
                }
            }

            if (item.rol === 'profesor') {
                profesoresToAdd.push(targetUserId)
            } else {
                alumnosToAdd.push(targetUserId)
            }
        }

        console.log('Usuarios a agregar a la asignatura:', {
            profesores: profesoresToAdd,
            alumnos: alumnosToAdd,
        })

        await classServices.addUsersToAsignByRole(id_asignatura, {
            profesores: profesoresToAdd,
            alumnos: alumnosToAdd,
        })

        res.status(200).json({
            message: 'Usuarios agregados correctamente a la asignatura.',
            total: profesoresToAdd.length + alumnosToAdd.length,
        })
    } catch (error) {
        console.error('Error al agregar usuarios por lote a la asignatura:', error)
        res.status(500).json({ message: 'No se pudieron agregar los usuarios a la asignatura.' })
    }
})

module.exports = router