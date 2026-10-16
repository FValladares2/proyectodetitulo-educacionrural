const express = require('express')
const router = express.Router()
const orgServices = require('../../services/orgServices')
const userServices = require('../../services/userServices')
const { authenticate, getUserFromToken } = require('../../utils/auth')
const recursoServices = require('../../services/recursoServices')
const { ObjectId } = require('../../config/mongo')
const crypto = require('crypto')

router.get('/api/org/all', async (req, res) => {
    // public for testing purposes TODO: delete later
    try {
        const orgs = await orgServices.getAllOrgs()
        res.status(200).json(orgs)
    } catch (error) {
        res.status(500).json({ message: error.message })
    }
})

router.get('/api/org/user', authenticate, async (req, res) => {
    try {
        const user = await getUserFromToken(req.headers.authorization.split(' ')[1])
        const orgs = await orgServices.getAllOrgsWithUser(user._id)
        res.status(200).json(orgs)
    } catch (error) {
        console.error('Error al obtener organizaciones:', error)
        res.status(500).json({ message: 'No se pudo obtener organizaciones.' })
    }
})

router.get('/api/org/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params
        const user = await getUserFromToken(req.headers.authorization.split(' ')[1])

        if (!id) {
            return res.status(400).json({ message: 'Faltan campos obligatorios.' })
        }
        const isUserInOrg = await orgServices.findUserInOrg(id, user._id)
        if (!isUserInOrg) {
            return res.status(403).json({ message: 'No tienes permisos para ver esta organización.' })
        }

        const org = await orgServices.getOrgById(id)
        res.status(200).json(org)
    } catch (error) {
        console.error('Error al obtener la organización:', error)
        res.status(500).json({ message: 'No se pudo obtener la organización.' })
    }
})

router.post('/api/org/create', async (req, res) => {
    try {
        const { nombre, id_usuario } = req.body

        if (!nombre || !id_usuario) {
            return res.status(400).json({ message: 'Faltan campos obligatorios.' })
        }

        const org = await orgServices.createOrg({
            nombre,
            admin: [id_usuario],
            profesores: [id_usuario],
            usuarios: [id_usuario]
        })

        res.status(200).json(org)
    } catch (error) {
        console.error('Error al crear la organización:', error)
        res.status(500).json({ message: 'No se pudo crear la organización.' })
    }
})

router.put('/api/org/user/update', authenticate, async (req, res) => {
    try {
        const asker = await getUserFromToken(req.headers.authorization.split(' ')[1])

        const { id_organizacion } = req.body

        if (!id_organizacion) {
            return res.status(400).json({ message: 'Faltan campos obligatorios.' })
        }

        const org = await userServices.setUserMainOrg(asker._id, id_organizacion)
        res.status(200).json(org)
    } catch (error) {
        console.error('Error al actualizar la organización:', error)
        res.status(500).json({ message: 'No se pudo actualizar la organización.' })
    }
})

// banner de la organización: { img: "recurso:<id>" } con una imagen de la propia organización, o { img: null }
router.put('/api/org/:id/img', authenticate, async (req, res) => {
    try {
        const { id } = req.params
        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'La organización no es válida.' })
        }
        if (!(await orgServices.findAdminInOrg(id, req.user._id))) {
            return res.status(403).json({ message: 'Solo un administrador puede cambiar la imagen.' })
        }

        const validacion = await recursoServices.validarImagenBanner(req.body.img, { id_organizacion: id })
        if (validacion.status) {
            return res.status(validacion.status).json({ message: validacion.message })
        }

        const result = await orgServices.updateOrg(id, { img: validacion.img })
        if (!result || result.matchedCount === 0) {
            return res.status(404).json({ message: 'Organización no encontrada.' })
        }

        res.status(200).json({ img: validacion.img })
    } catch (error) {
        console.error('Error al actualizar la imagen de la organización:', error)
        res.status(500).json({ message: 'No se pudo actualizar la imagen de la organización.' })
    }
})

router.get('/api/users/batch/:id_organizacion', authenticate, async (req, res) => {
    try {
        // gives basic info for every user within an org; id, nombre, correo, rol
        const { id_organizacion } = req.params
        if (!id_organizacion) {
            return res.status(400).json({ message: 'Faltan campos obligatorios.' })
        }

        const asker = await getUserFromToken(req.headers.authorization.split(' ')[1])
        if (!asker) {
            return res.status(404).json({ message: 'No se pudo obtener la información del usuario solicitante.' })
        }

        if (!asker.org_principal) {
            console.log("era problema con asker.org_principal")
            return res.status(403).json({ message: 'No tienes permisos para obtener la información de estos usuarios.' })
        }
        const isUserInOrg = await orgServices.findUserInOrg(id_organizacion, asker._id)
        console.log(isUserInOrg, asker._id, " - api/users/batch/:",id_organizacion)
        if (!isUserInOrg) {
            return res.status(403).json({ message: 'No tienes permisos para obtener la información de estos usuarios.' })
        }

        const adminsInOrg = await orgServices.getAdminsInOrg(id_organizacion)
        const teachersInOrg = await orgServices.getTeachersInOrg(id_organizacion)
        const usersInOrg = await orgServices.getUsersInOrg(id_organizacion)

        const adminIds = adminsInOrg.map(id => id.toString());
        const teacherIds = teachersInOrg.map(id => id.toString());

        // Admins and teachers are also users, remove their ids from the users list
        // also, admins are also teachers, remove their ids from the teachers list
        const filteredUsers = usersInOrg.filter(
            user => !adminIds.includes(user.toString()) && !teacherIds.includes(user.toString())
        );

        const filteredTeachers = teachersInOrg.filter(
            teacher => !adminIds.includes(teacher.toString())
        );

        const admins = await userServices.getUserBatchBasicInfo(adminsInOrg)
        const teachers = await userServices.getUserBatchBasicInfo(filteredTeachers)
        const users = await userServices.getUserBatchBasicInfo(filteredUsers)

        res.status(200).json({ admins, teachers, users })
    } catch (error) {
        console.error('Error al obtener la información de los usuarios:', error)
        res.status(500).json({ message: 'No se pudo obtener la información de los usuarios.' })
    }
})

router.post('/api/org/users/batch', authenticate, async (req, res) => {
    try {
        const { id_organizacion, usuarios } = req.body
        if (!id_organizacion || !Array.isArray(usuarios) || usuarios.length === 0) {
            return res.status(400).json({ message: 'La organización y los usuarios son obligatorios.' })
        }

        if (!(await orgServices.findAdminInOrg(id_organizacion, req.user._id))) {
            return res.status(403).json({ message: 'Solo un administrador puede agregar usuarios.' })
        }

        const usersByRole = { admin: [], profesor: [], alumno: [] }
        const createdUsers = []
        for (const userData of usuarios) {
            const correo = userData.correo?.trim().toLowerCase()
            const role = userData.rol
            if (!correo || !usersByRole[role]) {
                return res.status(400).json({ message: 'Cada usuario debe tener correo y un rol válido.' })
            }

            let user = await userServices.findUserByUsernameOrEmail(correo)
            if (!user) {
                if (!userData.nombre || !userData.contrasena || userData.contrasena.length < 8) {
                    return res.status(400).json({ message: `El nuevo usuario ${correo} requiere nombre y contraseña de 8 caracteres.` })
                }
                const passwordHash = await userServices.hashPassword(userData.contrasena)
                const result = await userServices.insertUser({
                    nombre: userData.nombre.trim(),
                    correo,
                    passwordHash,
                    encryptionSalt: crypto.randomBytes(16).toString('base64'),
                    createdAt: new Date(),
                })
                user = { _id: result.insertedId }
                await userServices.setUserMainOrg(result.insertedId, id_organizacion)
                createdUsers.push(correo)
            }
            usersByRole[role].push(user._id)
        }

        await orgServices.addUsersToOrgByRole(id_organizacion, usersByRole)
        res.status(200).json({ message: 'Usuarios agregados correctamente.', createdUsers, total: usuarios.length })
    } catch (error) {
        console.error('Error al agregar usuarios a la organización:', error)
        res.status(500).json({ message: 'No se pudieron agregar los usuarios.' })
    }
})

module.exports = router