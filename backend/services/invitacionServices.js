const crypto = require('crypto')
const { isMongoConnected, collections } = require('../config/mongo')
const { hashPassword } = require('./userServices')
const { encolarCorreo } = require('./correoServices')
const { renderizarCorreo, enlaceApp } = require('./correoPlantillas')

/**
 * Invitaciones para que un usuario creado por un administrador defina su contraseña.
 * El enlace del correo lleva un token aleatorio; en la base de datos solo se guarda su hash,
 * así que ni la base ni la cola de correos (que borra el contenido al enviar) lo conservan.
 */

const HORAS_VIGENCIA = 72

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex')

/**
 * Crea una invitación (reemplaza la anterior, si había) y encola el correo con el enlace.
 * @param {{ _id: ObjectId, nombre: string, correo: string }} usuario
 * @param {{ organizacion: string }} datos
 * @returns {Promise<boolean>} true si se encoló el correo
 */
const invitarUsuario = async (usuario, { organizacion }) => {
    try {
        if (!isMongoConnected()) return false
        const token = crypto.randomBytes(32).toString('base64url')
        await collections.usuarios.updateOne(
            { _id: usuario._id },
            {
                $set: {
                    invitacion: {
                        token_hash: hashToken(token),
                        expira: new Date(Date.now() + HORAS_VIGENCIA * 60 * 60 * 1000),
                    },
                },
            }
        )
        const correo = renderizarCorreo(
            'cuenta_creada',
            { nombre: usuario.nombre, organizacion, horas: HORAS_VIGENCIA },
            { enlace: enlaceApp(`/authentication/change-password?token=${token}`) }
        )
        return Boolean(await encolarCorreo({ para: usuario.correo, tipo: 'cuenta_creada', ...correo }))
    } catch (error) {
        console.error('No se pudo crear la invitación:', error)
        return false
    }
}

/**
 * Define la contraseña con el token del enlace. El token se invalida al usarse.
 * @returns {Promise<boolean>} false si el token no existe o venció
 */
const definirContrasenaConInvitacion = async (token, contrasena) => {
    if (!isMongoConnected() || typeof token !== 'string' || !token) return false
    const hash_contrasena = await hashPassword(contrasena)
    const result = await collections.usuarios.updateOne(
        { 'invitacion.token_hash': hashToken(token), 'invitacion.expira': { $gt: new Date() } },
        { $set: { hash_contrasena }, $unset: { invitacion: '' } }
    )
    return result.modifiedCount === 1
}

module.exports = { HORAS_VIGENCIA, invitarUsuario, definirContrasenaConInvitacion }
