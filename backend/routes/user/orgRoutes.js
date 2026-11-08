const express = require('express')
const router = express.Router()
const orgServices = require('../../services/orgServices')
const userServices = require('../../services/userServices')
const { authenticate, getUserFromToken } = require('../../utils/auth')
const recursoServices = require('../../services/recursoServices')
const { ACCIONES, registrarActividad } = require('../../services/actividadServices')
const { notificar } = require('../../services/notificacionServices')
const { invitarUsuario } = require('../../services/invitacionServices')
const membresiaServices = require('../../services/membresiaServices')
const { ObjectId } = require('../../config/mongo')
const crypto = require('crypto')

router.get('/api/org/user', authenticate, async (req, res) => {
    try {
        const user = await getUserFromToken(req.headers.authorization.split(' ')[1])
        const orgs = await orgServices.getAllOrgsWithUser(user._id)
        // rol del usuario en cada organización, para que el frontend oculte acciones sin permiso
        const rolEn = (org) => {
            const contiene = (lista) => (lista || []).some((id) => String(id) === String(user._id))
            if (contiene(org.administradores)) return 'admin'
            if (contiene(org.profesores)) return 'profesor'
            return 'alumno'
        }
        res.status(200).json(orgs.map(({ administradores, profesores, ...org }) => ({ ...org, rol: rolEn({ administradores, profesores }) })))
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

// cambia la organización principal; solo a una a la que el usuario pertenece
router.put('/api/org/user/update', authenticate, async (req, res) => {
    try {
        const asker = req.user
        const { id_organizacion } = req.body

        if (!id_organizacion || !ObjectId.isValid(id_organizacion)) {
            return res.status(400).json({ message: 'Faltan campos obligatorios.' })
        }
        if (!(await orgServices.findUserInOrg(id_organizacion, asker._id))) {
            return res.status(403).json({ message: 'No perteneces a esa organización.' })
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

        registrarActividad({
            contenedor: { id_organizacion: id },
            id_usuario: req.user._id,
            accion: validacion.img ? ACCIONES.BANNER_CAMBIADO : ACCIONES.BANNER_QUITADO,
        })

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

        const asker = req.user
        const isUserInOrg = await orgServices.findUserInOrg(id_organizacion, asker._id)
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

        // la última conexión solo la ven los administradores
        const conConexion = adminIds.includes(String(asker._id))
        const admins = await userServices.getUserBatchBasicInfo(adminsInOrg, { conConexion })
        const teachers = await userServices.getUserBatchBasicInfo(filteredTeachers, { conConexion })
        const users = await userServices.getUserBatchBasicInfo(filteredUsers, { conConexion })

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

        const organizacion = await orgServices.getOrgById(id_organizacion)
        const miembrosPrevios = new Set((organizacion?.usuarios || []).map(String))

        const usersByRole = { admin: [], profesor: [], alumno: [] }
        const createdUsers = []
        // los nuevos reciben una invitación para definir su contraseña; los existentes, un aviso
        const invitados = []
        const agregados = []
        for (const userData of usuarios) {
            const correo = userData.correo?.trim().toLowerCase()
            const role = userData.rol
            if (!correo || !usersByRole[role]) {
                return res.status(400).json({ message: 'Cada usuario debe tener correo y un rol válido.' })
            }

            let user = await userServices.findUserByEmail(correo)
            if (!user) {
                // la contraseña inicial es opcional: sin ella, el usuario la define con la invitación
                if (!userData.nombre || (userData.contrasena && userData.contrasena.length < 8)) {
                    return res.status(400).json({ message: `El nuevo usuario ${correo} requiere nombre, y la contraseña debe tener al menos 8 caracteres.` })
                }
                const nombre = userData.nombre.trim()
                const hash_contrasena = userData.contrasena ? await userServices.hashPassword(userData.contrasena) : null
                const result = await userServices.insertUser({
                    nombre,
                    correo,
                    hash_contrasena,
                    sal_cifrado: crypto.randomBytes(16).toString('base64'),
                    creado_en: new Date(),
                })
                user = { _id: result.insertedId }
                await userServices.setUserMainOrg(result.insertedId, id_organizacion)
                createdUsers.push(correo)
                invitados.push({ _id: result.insertedId, nombre, correo })
            } else if (!miembrosPrevios.has(String(user._id))) {
                agregados.push(user._id)
                // una cuenta desactivada por haberse quedado sin organizaciones vuelve a activarse
                await membresiaServices.reactivarCuenta(user._id, id_organizacion)
            }
            usersByRole[role].push(user._id)
        }

        await orgServices.addUsersToOrgByRole(id_organizacion, usersByRole)
        registrarActividad({
            contenedor: { id_organizacion },
            id_usuario: req.user._id,
            accion: ACCIONES.USUARIOS_AGREGADOS,
            detalle: { cantidad: usuarios.length },
        })

        const nombreOrganizacion = organizacion?.nombre || 'tu organización'
        for (const invitado of invitados) {
            invitarUsuario(invitado, { organizacion: nombreOrganizacion })
        }
        notificar({
            destinatarios: agregados,
            tipo: 'agregado_organizacion',
            datos: { organizacion: nombreOrganizacion },
            id_organizacion,
            excluir: req.user._id,
        })

        res.status(200).json({ message: 'Usuarios agregados correctamente.', createdUsers, total: usuarios.length })
    } catch (error) {
        console.error('Error al agregar usuarios a la organización:', error)
        res.status(500).json({ message: 'No se pudieron agregar los usuarios.' })
    }
})

// datos visibles de la organización; solo administradores. Campos de texto, todos opcionales
// salvo el nombre; una cadena vacía borra el campo
const CAMPOS_ORGANIZACION = {
    nombre: { max: 120, obligatorio: true },
    descripcion: { max: 1000 },
    direccion: { max: 200 },
    informacion_contacto: { max: 300 },
}

router.put('/api/org/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params
        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Parámetros inválidos.' })
        }
        if (!(await orgServices.findAdminInOrg(id, req.user._id))) {
            return res.status(403).json({ message: 'Solo un administrador puede editar la organización.' })
        }

        const set = {}
        const unset = {}
        for (const [campo, { max, obligatorio }] of Object.entries(CAMPOS_ORGANIZACION)) {
            const valor = req.body[campo]
            if (valor === undefined) continue
            if (typeof valor !== 'string' || valor.trim().length > max) {
                return res.status(400).json({ message: `El campo ${campo} debe ser texto de hasta ${max} caracteres.` })
            }
            const limpio = valor.trim()
            if (limpio) {
                set[campo] = limpio
            } else if (obligatorio) {
                return res.status(400).json({ message: 'El nombre es obligatorio.' })
            } else {
                unset[campo] = ''
            }
        }
        if (Object.keys(set).length === 0 && Object.keys(unset).length === 0) {
            return res.status(400).json({ message: 'No hay cambios que guardar.' })
        }

        set.actualizado_en = new Date()
        const actualizacion = { $set: set }
        if (Object.keys(unset).length > 0) actualizacion.$unset = unset
        await orgServices.actualizarOrg(id, actualizacion)

        registrarActividad({
            contenedor: { id_organizacion: id },
            id_usuario: req.user._id,
            accion: ACCIONES.ORGANIZACION_EDITADA,
            detalle: { campos: [...Object.keys(set), ...Object.keys(unset)].filter((c) => c !== 'actualizado_en') },
        })
        res.status(200).json(await orgServices.getOrgById(id))
    } catch (error) {
        console.error('Error al editar la organización:', error)
        res.status(500).json({ message: 'No se pudo editar la organización.' })
    }
})

// espacio que ocupan los archivos de la organización y de cada asignatura; solo administradores
router.get('/api/org/:id/almacenamiento', authenticate, async (req, res) => {
    try {
        const { id } = req.params
        if (!ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Parámetros inválidos.' })
        }
        if (!(await orgServices.findAdminInOrg(id, req.user._id))) {
            return res.status(403).json({ message: 'Solo un administrador puede ver el almacenamiento de la organización.' })
        }

        const asignaturas = await orgServices.getAsignaturasDeOrg(id)
        const resumen = await recursoServices.resumirAlmacenamiento({
            ids_asignatura: asignaturas.map((a) => a._id),
            id_organizacion: id,
        })
        if (!resumen) {
            return res.status(503).json({ message: 'Base de datos no disponible.' })
        }

        const total = recursoServices.sumarEspacio(recursoServices.espacioVacio(), resumen.organizacion)
        const detalle = asignaturas.map((asignatura) => {
            const { material, entregas } = resumen.asignaturas[String(asignatura._id)]
            const subtotal = recursoServices.sumarEspacio(recursoServices.sumarEspacio(recursoServices.espacioVacio(), material), entregas)
            recursoServices.sumarEspacio(total, subtotal)
            return { _id: asignatura._id, nombre: asignatura.nombre, activo: asignatura.activo !== false, material, entregas, total: subtotal }
        })

        res.status(200).json({
            limite: recursoServices.LIMITE_ALMACENAMIENTO,
            total,
            organizacion: resumen.organizacion,
            asignaturas: detalle,
        })
    } catch (error) {
        console.error('Error al calcular el almacenamiento de la organización:', error)
        res.status(500).json({ message: 'No se pudo calcular el almacenamiento.' })
    }
})

// quitar a un integrante; solo administradores (también a sí mismos si queda otro administrador)
router.delete('/api/org/:id/users/:id_usuario', authenticate, async (req, res) => {
    try {
        const { id, id_usuario } = req.params
        if (!ObjectId.isValid(id) || !ObjectId.isValid(id_usuario)) {
            return res.status(400).json({ message: 'Parámetros inválidos.' })
        }
        if (!(await orgServices.findAdminInOrg(id, req.user._id))) {
            return res.status(403).json({ message: 'Solo un administrador puede quitar usuarios.' })
        }

        const organizacion = await orgServices.getOrgById(id)
        const resultado = await membresiaServices.quitarDeOrganizacion(organizacion, id_usuario, req.user._id)
        if (resultado.status !== 200) {
            return res.status(resultado.status).json({ message: resultado.message })
        }

        registrarActividad({
            contenedor: { id_organizacion: id },
            id_usuario: req.user._id,
            accion: ACCIONES.USUARIO_QUITADO,
            detalle: { id_usuario_quitado: id_usuario },
        })
        res.status(200).json({
            message: 'Usuario quitado de la organización.',
            asignaturasTransferidas: resultado.asignaturasTransferidas,
            cuentaDesactivada: resultado.cuentaDesactivada,
        })
    } catch (error) {
        console.error('Error al quitar el usuario de la organización:', error)
        res.status(500).json({ message: 'No se pudo quitar el usuario.' })
    }
})

module.exports = router