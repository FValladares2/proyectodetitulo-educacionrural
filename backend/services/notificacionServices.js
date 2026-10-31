const crypto = require('crypto')
const { isMongoConnected, ObjectId, collections } = require('../config/mongo')
const { encolarCorreo } = require('./correoServices')
const { renderizarCorreo, enlaceApp, urlApp } = require('./correoPlantillas')

/**
 * Notificaciones por usuario (colección notificaciones): las muestra la campana de la app y,
 * según el tipo y las preferencias del usuario, también se envían por correo.
 *
 * Solo las crea el backend, desde las rutas, después de que la acción se completa.
 * { id_usuario, tipo, id_asignatura?, id_organizacion?, id_tarea?, datos, leida, creado_en }
 */

/**
 * - correo: si el tipo puede enviarse por correo (el usuario puede desactivarlo)
 * - agrupar: si una notificación no leída del mismo tipo y tarea se actualiza en vez de crear
 *   otra; en ese caso no se envía un correo nuevo
 */
const TIPOS = Object.freeze({
    tarea_creada: { correo: true },
    tarea_por_cerrar: { correo: true },
    entrega_calificada: { correo: true, agrupar: true },
    // solo en la app: un correo por cada entrega recibida sería excesivo para los docentes
    entrega_recibida: { correo: false, agrupar: true },
    agregado_asignatura: { correo: true },
    agregado_organizacion: { correo: true },
})

const TIPOS_CON_CORREO = Object.keys(TIPOS).filter((tipo) => TIPOS[tipo].correo)

const LIMITE_MAXIMO = 50

const aObjectId = (id) => (ObjectId.isValid(id) ? new ObjectId(String(id)) : id)

// estudiantes de una asignatura: integrantes que no son docentes
const estudiantesDe = (asignatura) => {
    const docentes = new Set((asignatura?.docentes || []).map(String))
    return (asignatura?.usuarios || []).filter((id) => !docentes.has(String(id)))
}

// destino del enlace del correo y de la notificación en la app
const rutaDe = ({ id_asignatura, id_tarea }) => {
    if (id_asignatura && id_tarea) return `/asignaturas/${id_asignatura}?tarea=${id_tarea}`
    if (id_asignatura) return `/asignaturas/${id_asignatura}`
    return '/hogar'
}

// --- desuscripción con un enlace firmado (sin iniciar sesión) ---

const secretoDesuscripcion = () =>
    process.env.CORREO_SECRETO || process.env.ENCRYPTION_KEY || 'desarrollo-sin-secreto-configurado'

const firmar = (id_usuario, tipo) =>
    crypto.createHmac('sha256', secretoDesuscripcion()).update(`${id_usuario}:${tipo}`).digest('base64url')

const enlaceDesuscribir = (id_usuario, tipo) =>
    `${urlApp()}/api/notificaciones/desuscribir?u=${id_usuario}&t=${tipo}&f=${firmar(id_usuario, tipo)}`

const firmaValida = (id_usuario, tipo, firma) => {
    if (typeof firma !== 'string') return false
    const esperada = Buffer.from(firmar(id_usuario, tipo))
    const recibida = Buffer.from(firma)
    return esperada.length === recibida.length && crypto.timingSafeEqual(esperada, recibida)
}

// --- preferencias ---

// todos los tipos con correo están activos salvo que el usuario los desactive
const preferenciasDe = (usuario) =>
    Object.fromEntries(TIPOS_CON_CORREO.map((tipo) => [tipo, usuario?.preferencias_correo?.[tipo] !== false]))

const obtenerPreferencias = async (id_usuario) => {
    if (!isMongoConnected()) return preferenciasDe(null)
    const usuario = await collections.usuarios.findOne(
        { _id: aObjectId(id_usuario) },
        { projection: { preferencias_correo: 1 } }
    )
    return preferenciasDe(usuario)
}

/**
 * Actualiza las preferencias indicadas ({ tipo: boolean }); ignora tipos desconocidos.
 * @returns {Promise<object|null>} las preferencias resultantes, o null si el cuerpo no es válido
 */
const actualizarPreferencias = async (id_usuario, cambios) => {
    if (!cambios || typeof cambios !== 'object') return null
    const set = {}
    for (const tipo of TIPOS_CON_CORREO) {
        if (cambios[tipo] === undefined) continue
        if (typeof cambios[tipo] !== 'boolean') return null
        set[`preferencias_correo.${tipo}`] = cambios[tipo]
    }
    if (Object.keys(set).length > 0 && isMongoConnected()) {
        await collections.usuarios.updateOne({ _id: aObjectId(id_usuario) }, { $set: set })
    }
    return obtenerPreferencias(id_usuario)
}

// desde el enlace del correo; devuelve false si la firma no es válida
const desuscribir = async (id_usuario, tipo, firma) => {
    if (!ObjectId.isValid(id_usuario) || !TIPOS_CON_CORREO.includes(tipo) || !firmaValida(id_usuario, tipo, firma)) {
        return false
    }
    await actualizarPreferencias(id_usuario, { [tipo]: false })
    return true
}

// --- creación ---

/**
 * Crea una notificación para cada destinatario (sin repetir y sin `excluir`, normalmente quien
 * realizó la acción) y encola los correos que correspondan. Nunca lanza errores, así que puede
 * llamarse sin await: un fallo no debe hacer fallar la acción que se notifica.
 * @param {object} aviso
 * @param {Array<string|ObjectId>} aviso.destinatarios
 * @param {string} aviso.tipo - una clave de TIPOS
 * @param {object} [aviso.datos] - textos mínimos: titulo, asignatura, organizacion, limite...
 * @param {string|ObjectId} [aviso.id_asignatura]
 * @param {string|ObjectId} [aviso.id_organizacion]
 * @param {string|ObjectId} [aviso.id_tarea]
 * @param {string|ObjectId} [aviso.excluir]
 * @returns {Promise<{ creadas: number, agrupadas: number, correos: number }>}
 */
const notificar = async ({ destinatarios, tipo, datos = {}, id_asignatura, id_organizacion, id_tarea, excluir }) => {
    const resumen = { creadas: 0, agrupadas: 0, correos: 0 }
    try {
        const config = TIPOS[tipo]
        if (!config) {
            console.error('Tipo de notificación desconocido:', tipo)
            return resumen
        }
        if (!isMongoConnected() || !collections.notificaciones) return resumen

        const ids = [...new Set((destinatarios || []).map(String))]
            .filter((id) => id !== String(excluir ?? '') && ObjectId.isValid(id))
            .map((id) => new ObjectId(id))
        if (ids.length === 0) return resumen

        const referencias = {}
        if (id_asignatura) referencias.id_asignatura = aObjectId(id_asignatura)
        if (id_organizacion) referencias.id_organizacion = aObjectId(id_organizacion)
        if (id_tarea) referencias.id_tarea = aObjectId(id_tarea)

        const ahora = new Date()
        const nuevos = []
        for (const id_usuario of ids) {
            if (config.agrupar) {
                const { value: agrupada } = await collections.notificaciones.findOneAndUpdate(
                    { id_usuario, tipo, ...referencias, leida: false },
                    { $set: { creado_en: ahora, ...Object.fromEntries(Object.entries(datos).map(([k, v]) => [`datos.${k}`, v])) }, $inc: { 'datos.cantidad': 1 } },
                    // includeResultMetadata da el mismo formato ({ value }) en las versiones 5 y 6 del driver
                    { includeResultMetadata: true }
                )
                if (agrupada) {
                    resumen.agrupadas++
                    continue
                }
            }
            nuevos.push(id_usuario)
        }
        if (nuevos.length === 0) return resumen

        await collections.notificaciones.insertMany(
            nuevos.map((id_usuario) => ({
                id_usuario,
                tipo,
                ...referencias,
                datos: config.agrupar ? { ...datos, cantidad: 1 } : datos,
                leida: false,
                creado_en: ahora,
            }))
        )
        resumen.creadas = nuevos.length

        if (!config.correo) return resumen
        const usuarios = await collections.usuarios
            .find({ _id: { $in: nuevos } })
            .project({ correo: 1, preferencias_correo: 1 })
            .toArray()
        const enlace = enlaceApp(rutaDe({ id_asignatura, id_tarea }))
        for (const usuario of usuarios) {
            if (!usuario.correo || !preferenciasDe(usuario)[tipo]) continue
            const correo = renderizarCorreo(tipo, datos, {
                enlace,
                desuscribir: enlaceDesuscribir(usuario._id, tipo),
            })
            if (correo && await encolarCorreo({ para: usuario.correo, tipo, ...correo })) {
                resumen.correos++
            }
        }
        return resumen
    } catch (error) {
        console.error('No se pudo crear la notificación:', error)
        return resumen
    }
}

// --- lectura ---

const listarNotificaciones = async (id_usuario, { limit = 20, antes } = {}) => {
    if (!isMongoConnected() || !collections.notificaciones) return []
    const filtro = { id_usuario: aObjectId(id_usuario) }
    if (antes) filtro.creado_en = { $lt: antes }
    return collections.notificaciones
        .find(filtro)
        .sort({ creado_en: -1 })
        .limit(Math.min(Math.max(1, limit), LIMITE_MAXIMO))
        .toArray()
}

const contarNoLeidas = async (id_usuario) => {
    if (!isMongoConnected() || !collections.notificaciones) return 0
    return collections.notificaciones.countDocuments({ id_usuario: aObjectId(id_usuario), leida: false })
}

// solo marca notificaciones del propio usuario
const marcarLeida = async (id, id_usuario) => {
    if (!isMongoConnected() || !ObjectId.isValid(id)) return null
    return collections.notificaciones.updateOne(
        { _id: new ObjectId(String(id)), id_usuario: aObjectId(id_usuario) },
        { $set: { leida: true } }
    )
}

const marcarTodasLeidas = async (id_usuario) => {
    if (!isMongoConnected()) return null
    return collections.notificaciones.updateMany(
        { id_usuario: aObjectId(id_usuario), leida: false },
        { $set: { leida: true } }
    )
}

module.exports = {
    TIPOS,
    TIPOS_CON_CORREO,
    LIMITE_MAXIMO,
    estudiantesDe,
    rutaDe,
    notificar,
    listarNotificaciones,
    contarNoLeidas,
    marcarLeida,
    marcarTodasLeidas,
    obtenerPreferencias,
    actualizarPreferencias,
    desuscribir,
    enlaceDesuscribir,
}
