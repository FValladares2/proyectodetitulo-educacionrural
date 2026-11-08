const express = require('express')
const router = express.Router()
const orgServices = require('../../services/orgServices')
const classServices = require('../../services/asignServices')
const userServices = require('../../services/userServices')
const recursoServices = require('../../services/recursoServices')
const accesoServices = require('../../services/accesoServices')
const { ACCIONES, registrarActividad } = require('../../services/actividadServices')
const { notificar } = require('../../services/notificacionServices')
const { authenticate, getUserFromToken } = require('../../utils/auth')
const membresiaServices = require('../../services/membresiaServices')
const { ObjectId } = require('../../config/mongo')

const MAX_NOMBRE_ASIGNATURA = 120

// la crean los profesores de la organización (los administradores también lo son)
router.post('/api/asign/create', authenticate, async (req, res) => {
    try {
        const user = await getUserFromToken(req.headers.authorization.split(' ')[1])
        if (!ObjectId.isValid(req.body.id_organizacion)) {
            return res.status(400).json({ message: 'La organización no es válida.' })
        }
        const isU = await orgServices.findUserInOrg(req.body.id_organizacion, user._id)

        if (!isU) {
            return res.status(403).json({ message: 'No tienes permisos para crear una clase en esta organización.' })
        }
        const isProfesor = await orgServices.findTeacherInOrg(req.body.id_organizacion, user._id)

        if (!isProfesor) {
            return res.status(403).json({ message: 'No tienes permisos para crear una clase en esta organización.' })
        }

        const { id_organizacion } = req.body
        const nombre = typeof req.body.nombre === 'string' ? req.body.nombre.trim().replace(/\s+/g, ' ') : ''
        if (!nombre || nombre.length > MAX_NOMBRE_ASIGNATURA) {
            return res.status(400).json({ message: `El nombre es obligatorio y debe tener hasta ${MAX_NOMBRE_ASIGNATURA} caracteres.` })
        }

        const classRoom = await classServices.createClass({
            nombre,
            id_organizacion: new ObjectId(String(id_organizacion)),
            docentes: [user._id],
            usuarios: [user._id],
            activo: true,
            creado_en: new Date(),
        })

        registrarActividad({
            contenedor: { id_asignatura: classRoom.insertedId || classRoom._id },
            id_usuario: user._id,
            accion: ACCIONES.ASIGNATURA_CREADA,
            detalle: { nombre },
        })

        if (Array.isArray(req.body.correos) && req.body.correos.length > 0) {
            const classId = classRoom.insertedId || classRoom._id
            const agregados = []
            for (const correo of req.body.correos) {
                const usuario = await userServices.findUserByEmail(correo)
                // solo integrantes de la organización, igual que al agregar desde Integrantes
                if (usuario && await orgServices.findUserInOrg(id_organizacion, usuario._id)) {
                    await classServices.addUsuarioToAsign(classId, usuario._id)
                    agregados.push(usuario._id)
                }
            }
            notificar({
                destinatarios: agregados,
                tipo: 'agregado_asignatura',
                datos: { asignatura: nombre },
                id_asignatura: classId,
                excluir: user._id,
            })
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
        const { id_organizacion, soloDocente, todas, activo, page, limit, search, sortBy, order } = req.query
        if (!id_organizacion || !ObjectId.isValid(id_organizacion)) {
            return res.status(400).json({ message: 'Faltan campos obligatorios.' })
        }
        if (!await orgServices.findUserInOrg(id_organizacion, user._id)) {
            return res.status(403).json({ message: 'No tienes permisos para ver clases en esta organización.' })
        }
        const verTodas = todas === 'true'
        if (verTodas && !await orgServices.findAdminInOrg(id_organizacion, user._id)) {
            return res.status(403).json({ message: 'Solo un administrador puede ver todas las asignaturas.' })
        }
        const result = await classServices.getFilteredClasses({
            userId: user._id,
            id_organizacion,
            soloDocente: soloDocente === 'true',
            todas: verTodas,
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

        // no se espera: un fallo al registrar el acceso no debe impedir ver la asignatura
        accesoServices.registrarAcceso(user._id, id).catch((error) => {
            console.error('Error al registrar el acceso a la asignatura:', error)
        })

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
        const inactiva = await classServices.motivoAsignaturaInactiva(id)
        if (inactiva) {
            return res.status(inactiva.status).json({ message: inactiva.message })
        }

        if (typeof req.body.formato_markup !== 'string') {
            return res.status(400).json({ message: 'El contenido debe estar en formato Markdown.' })
        }

        const result = await classServices.updateClass(id, { formato_markup: req.body.formato_markup })
        if (!result || result.matchedCount === 0) {
            return res.status(404).json({ message: 'Asignatura no encontrada.' })
        }

        registrarActividad({
            contenedor: { id_asignatura: id },
            id_usuario: user._id,
            accion: ACCIONES.MARKUP_EDITADO,
        })

        res.status(200).json({ formato_markup: req.body.formato_markup })
    } catch (error) {
        console.error('Error al obtener la asignatura:', error)
        res.status(500).json({ message: 'No se pudo obtener la asignatura.' })
    }
})

// banner de la asignatura: { img: "recurso:<id>" } con una imagen de la propia asignatura, o { img: null }
router.put('/api/asign/:id/img', authenticate, async (req, res) => {
    try {
        const { id } = req.params
        if (!await classServices.findDocenteInAsign(id, req.user._id)) {
            return res.status(403).json({ message: 'No tienes permisos para editar esta asignatura.' })
        }
        const inactiva = await classServices.motivoAsignaturaInactiva(id)
        if (inactiva) {
            return res.status(inactiva.status).json({ message: inactiva.message })
        }

        const validacion = await recursoServices.validarImagenBanner(req.body.img, { id_asignatura: id })
        if (validacion.status) {
            return res.status(validacion.status).json({ message: validacion.message })
        }

        const result = await classServices.updateClass(id, { img: validacion.img })
        if (!result || result.matchedCount === 0) {
            return res.status(404).json({ message: 'Asignatura no encontrada.' })
        }

        registrarActividad({
            contenedor: { id_asignatura: id },
            id_usuario: req.user._id,
            accion: validacion.img ? ACCIONES.BANNER_CAMBIADO : ACCIONES.BANNER_QUITADO,
        })

        res.status(200).json({ img: validacion.img })
    } catch (error) {
        console.error('Error al actualizar la imagen de la asignatura:', error)
        res.status(500).json({ message: 'No se pudo actualizar la imagen de la asignatura.' })
    }
})

// docentes de la asignatura y administradores de su organización
const puedeAdministrarIntegrantes = async (asignatura, id_usuario) =>
    (asignatura.docentes || []).some((d) => String(d) === String(id_usuario)) || Boolean(
        asignatura.id_organizacion && await orgServices.findAdminInOrg(asignatura.id_organizacion, id_usuario)
    )

// nombre, estado y espacio usado; la ven y editan los docentes y los administradores de la organización
router.get('/api/asign/:id/config', authenticate, async (req, res) => {
    try {
        if (!ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: 'Parámetros inválidos.' })
        }
        const asignatura = await classServices.getClassById(req.params.id)
        if (!asignatura) {
            return res.status(404).json({ message: 'Asignatura no encontrada.' })
        }
        if (!(await puedeAdministrarIntegrantes(asignatura, req.user._id))) {
            return res.status(403).json({ message: 'No tienes permisos para configurar esta asignatura.' })
        }
        // espacio que ocupan sus archivos: material de la asignatura y entregas de sus tareas
        const resumen = await recursoServices.resumirAlmacenamiento({ ids_asignatura: [asignatura._id] })
        res.status(200).json({
            _id: asignatura._id,
            nombre: asignatura.nombre,
            activo: asignatura.activo !== false,
            almacenamiento: resumen?.asignaturas[String(asignatura._id)] ?? null,
        })
    } catch (error) {
        console.error('Error al obtener la configuración de la asignatura:', error)
        res.status(500).json({ message: 'No se pudo obtener la configuración.' })
    }
})

router.put('/api/asign/:id/config', authenticate, async (req, res) => {
    try {
        if (!ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ message: 'Parámetros inválidos.' })
        }
        const asignatura = await classServices.getClassById(req.params.id)
        if (!asignatura) {
            return res.status(404).json({ message: 'Asignatura no encontrada.' })
        }
        if (!(await puedeAdministrarIntegrantes(asignatura, req.user._id))) {
            return res.status(403).json({ message: 'No tienes permisos para configurar esta asignatura.' })
        }

        const cambios = {}
        if (req.body.nombre !== undefined) {
            const nombre = typeof req.body.nombre === 'string' ? req.body.nombre.trim().replace(/\s+/g, ' ') : ''
            if (!nombre || nombre.length > MAX_NOMBRE_ASIGNATURA) {
                return res.status(400).json({ message: `El nombre es obligatorio y debe tener hasta ${MAX_NOMBRE_ASIGNATURA} caracteres.` })
            }
            cambios.nombre = nombre
        }
        if (req.body.activo !== undefined) {
            if (typeof req.body.activo !== 'boolean') {
                return res.status(400).json({ message: 'El estado debe ser verdadero o falso.' })
            }
            cambios.activo = req.body.activo
        }
        if (Object.keys(cambios).length === 0) {
            return res.status(400).json({ message: 'No hay cambios que guardar.' })
        }

        await classServices.updateClass(req.params.id, { ...cambios, actualizado_en: new Date() })
        registrarActividad({
            contenedor: { id_asignatura: req.params.id },
            id_usuario: req.user._id,
            accion: ACCIONES.ASIGNATURA_CONFIGURADA,
            detalle: cambios,
        })
        res.status(200).json({
            _id: asignatura._id,
            nombre: cambios.nombre ?? asignatura.nombre,
            activo: cambios.activo ?? asignatura.activo !== false,
        })
    } catch (error) {
        console.error('Error al guardar la configuración de la asignatura:', error)
        res.status(500).json({ message: 'No se pudo guardar la configuración.' })
    }
})

// quitar a un integrante (también a sí mismo); la asignatura nunca queda sin docentes
router.delete('/api/asign/:id/users/:id_usuario', authenticate, async (req, res) => {
    try {
        const { id, id_usuario } = req.params
        if (!ObjectId.isValid(id) || !ObjectId.isValid(id_usuario)) {
            return res.status(400).json({ message: 'Parámetros inválidos.' })
        }
        const asignatura = await classServices.getClassById(id)
        if (!asignatura) {
            return res.status(404).json({ message: 'Asignatura no encontrada.' })
        }
        if (!(await puedeAdministrarIntegrantes(asignatura, req.user._id))) {
            return res.status(403).json({ message: 'No tienes permisos para quitar usuarios de esta asignatura.' })
        }

        const resultado = await membresiaServices.quitarDeAsignatura(asignatura, id_usuario)
        if (resultado.status !== 200) {
            return res.status(resultado.status).json({ message: resultado.message })
        }

        registrarActividad({
            contenedor: { id_asignatura: id },
            id_usuario: req.user._id,
            accion: ACCIONES.USUARIO_QUITADO,
            detalle: { id_usuario_quitado: id_usuario, era_docente: resultado.era_docente },
        })
        res.status(200).json({ message: 'Usuario quitado de la asignatura.' })
    } catch (error) {
        console.error('Error al quitar el usuario de la asignatura:', error)
        res.status(500).json({ message: 'No se pudo quitar el usuario.' })
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

        // los administradores de la organización ven los integrantes aunque no participen, pero
        // no el contenido ni las entregas: para eso deben unirse como docentes
        const esIntegrante = Boolean(await classServices.findUsuarioInAsign(id, user._id))
        const puedeAgregar = await puedeAdministrarIntegrantes(asignatura, user._id)
        if (!esIntegrante && !puedeAgregar) {
            return res.status(403).json({ message: 'No tienes permisos para ver los integrantes de esta asignatura.' })
        }

        const docenteIds = (asignatura.docentes || []).map(d => d.toString())
        let teachers = await userServices.getUserBatchBasicInfo(asignatura.docentes || [])
        const alumnoIds = (asignatura.usuarios || []).filter(
            usuario => !docenteIds.includes(usuario.toString())
        )
        let users = await userServices.getUserBatchBasicInfo(alumnoIds)

        // el último acceso a la asignatura solo lo ven quienes administran sus integrantes
        if (puedeAgregar) {
            const accesos = await accesoServices.ultimosAccesos(id)
            const conAcceso = (u) => ({ ...u, ultimo_acceso: accesos.get(String(u._id)) ?? null })
            teachers = (teachers || []).map(conAcceso)
            users = (users || []).map(conAcceso)
        }

        res.status(200).json({
            teachers: teachers || [],
            users: users || [],
            puedeAgregar,
            puedeQuitar: puedeAgregar,
            esIntegrante,
            nombre: asignatura.nombre,
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
                const foundUser = await userServices.findUserByEmail(item.correo.trim().toLowerCase())
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

        const totalAgregados = profesoresToAdd.length + alumnosToAdd.length
        // solo se avisa a quienes no estaban ya en la asignatura
        const integrantesPrevios = new Set((asignatura.usuarios || []).map(String))
        notificar({
            destinatarios: [...profesoresToAdd, ...alumnosToAdd].filter((id) => !integrantesPrevios.has(String(id))),
            tipo: 'agregado_asignatura',
            datos: { asignatura: asignatura.nombre },
            id_asignatura,
            excluir: user._id,
        })
        if (totalAgregados > 0) {
            registrarActividad({
                contenedor: { id_asignatura },
                id_usuario: user._id,
                accion: ACCIONES.USUARIOS_AGREGADOS,
                detalle: { cantidad: totalAgregados },
            })
        }

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