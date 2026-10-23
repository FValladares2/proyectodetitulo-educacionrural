const express = require('express')
const router = express.Router()
const notificacionServices = require('../../services/notificacionServices')
const { escaparHtml, urlApp } = require('../../services/correoPlantillas')
const { authenticate } = require('../../utils/auth')

// ?limit=20&antes=<createdAt de la última recibida> para paginar hacia atrás
router.get('/api/notificaciones', authenticate, async (req, res) => {
    try {
        const limit = Number.parseInt(req.query.limit, 10)
        const antes = req.query.antes ? new Date(req.query.antes) : undefined
        if (antes && Number.isNaN(antes.getTime())) {
            return res.status(400).json({ message: 'Parámetros inválidos.' })
        }
        const opciones = { limit: Number.isNaN(limit) ? 20 : limit, antes }
        const [notificaciones, noLeidas] = await Promise.all([
            notificacionServices.listarNotificaciones(req.user._id, opciones),
            notificacionServices.contarNoLeidas(req.user._id),
        ])
        res.status(200).json({
            notificaciones: notificaciones.map((n) => ({ ...n, ruta: notificacionServices.rutaDe(n) })),
            noLeidas,
        })
    } catch (error) {
        console.error('Error al obtener las notificaciones:', error)
        res.status(500).json({ message: 'No se pudieron obtener las notificaciones.' })
    }
})

// consulta liviana para el contador de la campana
router.get('/api/notificaciones/no-leidas', authenticate, async (req, res) => {
    try {
        res.status(200).json({ cantidad: await notificacionServices.contarNoLeidas(req.user._id) })
    } catch (error) {
        console.error('Error al contar las notificaciones:', error)
        res.status(500).json({ message: 'No se pudieron contar las notificaciones.' })
    }
})

router.put('/api/notificaciones/leidas', authenticate, async (req, res) => {
    try {
        await notificacionServices.marcarTodasLeidas(req.user._id)
        res.status(200).json({ noLeidas: 0 })
    } catch (error) {
        console.error('Error al marcar las notificaciones:', error)
        res.status(500).json({ message: 'No se pudieron marcar las notificaciones.' })
    }
})

router.put('/api/notificaciones/:id/leida', authenticate, async (req, res) => {
    try {
        const result = await notificacionServices.marcarLeida(req.params.id, req.user._id)
        if (!result || result.matchedCount === 0) {
            return res.status(404).json({ message: 'Notificación no encontrada.' })
        }
        res.status(200).json({ noLeidas: await notificacionServices.contarNoLeidas(req.user._id) })
    } catch (error) {
        console.error('Error al marcar la notificación:', error)
        res.status(500).json({ message: 'No se pudo marcar la notificación.' })
    }
})

// { tipo: boolean } para cada aviso que puede enviarse por correo
router.get('/api/notificaciones/preferencias', authenticate, async (req, res) => {
    try {
        res.status(200).json(await notificacionServices.obtenerPreferencias(req.user._id))
    } catch (error) {
        console.error('Error al obtener las preferencias:', error)
        res.status(500).json({ message: 'No se pudieron obtener las preferencias.' })
    }
})

router.put('/api/notificaciones/preferencias', authenticate, async (req, res) => {
    try {
        const preferencias = await notificacionServices.actualizarPreferencias(req.user._id, req.body)
        if (!preferencias) {
            return res.status(400).json({ message: 'Cada preferencia debe ser verdadera o falsa.' })
        }
        res.status(200).json(preferencias)
    } catch (error) {
        console.error('Error al guardar las preferencias:', error)
        res.status(500).json({ message: 'No se pudieron guardar las preferencias.' })
    }
})

const paginaSimple = (titulo, mensaje) => `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escaparHtml(titulo)}</title></head>
<body style="margin:0;padding:24px;background:#f1f4f6;font-family:Arial,Helvetica,sans-serif;color:#292929">
  <div style="max-width:480px;margin:40px auto;background:#fff;border:1px solid #d5dade;border-radius:10px;padding:24px">
    <h1 style="font-size:20px;margin:0 0 12px">${escaparHtml(titulo)}</h1>
    <p style="margin:0 0 16px;line-height:1.5">${escaparHtml(mensaje)}</p>
    <a href="${escaparHtml(`${urlApp()}/#/hogar`)}" style="color:#739121">Ir a la plataforma</a>
  </div>
</body></html>`

// enlace de los correos: pública (sin sesión), validada con la firma del enlace
router.get('/api/notificaciones/desuscribir', async (req, res) => {
    try {
        const { u, t, f } = req.query
        const listo = await notificacionServices.desuscribir(String(u ?? ''), String(t ?? ''), f)
        if (!listo) {
            return res.status(400).type('html').send(
                paginaSimple('Enlace no válido', 'Este enlace no es válido. Puedes cambiar tus avisos desde Configuración en la plataforma.')
            )
        }
        res.status(200).type('html').send(
            paginaSimple('Listo', 'Ya no recibirás este tipo de aviso por correo. Puedes volver a activarlo desde Configuración en la plataforma.')
        )
    } catch (error) {
        console.error('Error al desuscribir:', error)
        res.status(500).type('html').send(paginaSimple('Error', 'No se pudo completar la solicitud. Inténtalo más tarde.'))
    }
})

module.exports = router
