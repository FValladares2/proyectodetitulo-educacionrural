const nodemailer = require('nodemailer')
const { isMongoConnected, collections } = require('../config/mongo')

/**
 * Envío de correos con una cola en MongoDB (colección correos):
 * - las rutas solo encolan (encolarCorreo); nunca esperan al proveedor de correo
 * - un proceso periódico (iniciarEnvioCorreos) envía los pendientes y reintenta los fallidos
 *   con esperas crecientes, así que una caída del proveedor o un reinicio no pierde correos
 * - al terminar (enviado o fallido) se borra el contenido, porque puede incluir enlaces
 *   privados como el de invitación; queda solo el destinatario, el asunto y el estado
 *
 * Transporte según CORREO_TRANSPORTE:
 * - "smtp": usa SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER y SMTP_PASS (Mailgun, Brevo, etc.)
 * - "registro": no envía nada y muestra cada correo en la consola (bandeja de prueba)
 * Si no se define, se usa "smtp" cuando hay SMTP_HOST y "registro" en caso contrario.
 */

const MAX_INTENTOS = 5
// espera antes de cada reintento: 1 min, 5 min, 30 min, 2 h
const ESPERAS_REINTENTO_MS = [60, 5 * 60, 30 * 60, 2 * 60 * 60].map((s) => s * 1000)
// un correo "enviando" por más de este tiempo se considera abandonado (por ejemplo, un reinicio)
const BLOQUEO_MAXIMO_MS = 10 * 60 * 1000

let transporte = null

const modoTransporte = () =>
    process.env.CORREO_TRANSPORTE || (process.env.SMTP_HOST ? 'smtp' : 'registro')

const crearTransporte = () => {
    if (modoTransporte() === 'smtp') {
        return nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT) || 587,
            secure: process.env.SMTP_SECURE === 'true',
            auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
        })
    }
    const registro = nodemailer.createTransport({ jsonTransport: true })
    return {
        sendMail: async (mensaje) => {
            const info = await registro.sendMail(mensaje)
            console.log(`[correo de prueba] Para: ${mensaje.to} | Asunto: ${mensaje.subject}\n${mensaje.text}\n`)
            return info
        },
    }
}

const getTransporte = () => {
    if (!transporte) transporte = crearTransporte()
    return transporte
}

// permite reemplazar el transporte (pruebas); null vuelve a crearlo desde las variables de entorno
const configurarTransporte = (nuevo) => {
    transporte = nuevo
}

const remitente = () =>
    process.env.CORREO_REMITENTE || `${process.env.APP_NOMBRE || 'Educación Rural'} <no-responder@localhost>`

/**
 * Agrega un correo a la cola. Nunca lanza errores: un fallo se informa en consola.
 * @param {{ para: string, asunto: string, texto: string, html?: string, tipo?: string }} correo
 * @returns {Promise<object|null>}
 */
const encolarCorreo = async ({ para, asunto, texto, html, tipo }) => {
    try {
        if (!isMongoConnected() || !collections.correos || !para) return null
        const ahora = new Date()
        const correo = {
            para,
            asunto,
            texto,
            html,
            tipo: tipo || null,
            estado: 'pendiente',
            intentos: 0,
            proximo_intento: ahora,
            creado_en: ahora,
        }
        await collections.correos.insertOne(correo)
        return correo
    } catch (error) {
        console.error('No se pudo encolar el correo:', error)
        return null
    }
}

// toma un correo listo para enviar y lo marca como "enviando" para que nadie más lo tome
const reclamarSiguiente = async (ahora) => {
    const { value } = await collections.correos.findOneAndUpdate(
        {
            $or: [
                { estado: 'pendiente', proximo_intento: { $lte: ahora } },
                { estado: 'enviando', bloqueado_en: { $lt: new Date(ahora.getTime() - BLOQUEO_MAXIMO_MS) } },
            ],
        },
        { $set: { estado: 'enviando', bloqueado_en: ahora } },
        // includeResultMetadata da el mismo formato ({ value }) en las versiones 5 y 6 del driver
        { sort: { proximo_intento: 1 }, returnDocument: 'after', includeResultMetadata: true }
    )
    return value
}

/**
 * Envía hasta `limite` correos pendientes. Devuelve cuántos se enviaron y cuántos fallaron.
 * @returns {Promise<{ enviados: number, fallidos: number }>}
 */
const procesarCola = async ({ limite = 20 } = {}) => {
    const resultado = { enviados: 0, fallidos: 0 }
    if (!isMongoConnected() || !collections.correos) return resultado

    for (let i = 0; i < limite; i++) {
        const ahora = new Date()
        const correo = await reclamarSiguiente(ahora)
        if (!correo) break

        try {
            await getTransporte().sendMail({
                from: remitente(),
                to: correo.para,
                subject: correo.asunto,
                text: correo.texto,
                html: correo.html,
            })
            await collections.correos.updateOne(
                { _id: correo._id },
                { $set: { estado: 'enviado', enviado_en: new Date() }, $unset: { texto: '', html: '', bloqueado_en: '' } }
            )
            resultado.enviados++
        } catch (error) {
            const intentos = (correo.intentos || 0) + 1
            const agotado = intentos >= MAX_INTENTOS
            await collections.correos.updateOne(
                { _id: correo._id },
                agotado
                    ? {
                        $set: { estado: 'fallido', intentos, error: String(error.message).slice(0, 500) },
                        $unset: { texto: '', html: '', bloqueado_en: '' },
                    }
                    : {
                        $set: {
                            estado: 'pendiente',
                            intentos,
                            error: String(error.message).slice(0, 500),
                            proximo_intento: new Date(ahora.getTime() + ESPERAS_REINTENTO_MS[intentos - 1]),
                        },
                        $unset: { bloqueado_en: '' },
                    }
            )
            console.error(`No se pudo enviar el correo a ${correo.para} (intento ${intentos}):`, error.message)
            if (agotado) resultado.fallidos++
        }
    }
    return resultado
}

/**
 * Inicia el envío periódico de la cola. Devuelve una función para detenerlo.
 * @param {number} [intervaloMs]
 */
const iniciarEnvioCorreos = (intervaloMs = 30 * 1000) => {
    console.log(`Envío de correos activo (transporte: ${modoTransporte()})`)
    let ocupado = false
    const tick = async () => {
        if (ocupado) return
        ocupado = true
        try {
            await procesarCola()
        } catch (error) {
            console.error('Error al procesar la cola de correos:', error)
        } finally {
            ocupado = false
        }
    }
    const intervalo = setInterval(tick, intervaloMs)
    intervalo.unref()
    tick()
    return () => clearInterval(intervalo)
}

module.exports = {
    MAX_INTENTOS,
    encolarCorreo,
    procesarCola,
    iniciarEnvioCorreos,
    configurarTransporte,
}
