const express = require('express')
const router = express.Router()
const userServices = require('../../services/userServices')
const { authenticate, createToken } = require('../../utils/auth')

const MIN_CONTRASENA = 8

// el correo no se puede cambiar: identifica la cuenta para iniciar sesión
const perfilDe = (user) => ({
    _id: user._id,
    nombre: user.nombre,
    correo: user.correo,
    org_principal: user.org_principal,
})

router.get('/api/usuario/perfil', authenticate, async (req, res) => {
    res.status(200).json(perfilDe(req.user))
})

router.put('/api/usuario/perfil', authenticate, async (req, res) => {
    try {
        const nombre = userServices.validarNombre(req.body.nombre)
        if (!nombre) {
            return res.status(400).json({ message: 'El nombre es obligatorio y debe tener hasta 100 caracteres.' })
        }
        await userServices.actualizarNombre(req.user._id, nombre)
        res.status(200).json(perfilDe({ ...req.user, nombre }))
    } catch (error) {
        console.error('Error al actualizar el perfil:', error)
        res.status(500).json({ message: 'No se pudo actualizar el perfil.' })
    }
})

// cierra las demás sesiones y devuelve un token nuevo para la actual
router.put('/api/usuario/contrasena', authenticate, async (req, res) => {
    try {
        const { actual, nueva } = req.body
        if (typeof nueva !== 'string' || nueva.length < MIN_CONTRASENA) {
            return res.status(400).json({ message: `La nueva contraseña debe tener al menos ${MIN_CONTRASENA} caracteres.` })
        }
        if (
            typeof actual !== 'string' ||
            !req.user.hash_contrasena ||
            !(await userServices.comparePassword(actual, req.user.hash_contrasena))
        ) {
            return res.status(400).json({ message: 'La contraseña actual no es correcta.' })
        }
        await userServices.cambiarContrasena(req.user._id, nueva)
        res.status(200).json({ message: 'Contraseña actualizada. Se cerraron tus otras sesiones.', token: createToken(req.user) })
    } catch (error) {
        console.error('Error al cambiar la contraseña:', error)
        res.status(500).json({ message: 'No se pudo cambiar la contraseña.' })
    }
})

module.exports = router
