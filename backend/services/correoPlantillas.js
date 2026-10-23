/**
 * Plantillas de correo. Cada una devuelve { asunto, texto, html }.
 * El contenido es mínimo a propósito: el correo sale del control de acceso de la plataforma,
 * así que nunca incluye calificaciones, comentarios, nombres de archivos ni contraseñas;
 * solo avisa qué pasó y enlaza a la plataforma.
 */

const nombreApp = () => process.env.APP_NOMBRE || 'Educación Rural'

// dirección pública del frontend, por ejemplo https://plataforma.cl (sin barra final)
const urlApp = () => (process.env.APP_URL || 'http://localhost:8065').replace(/\/+$/, '')

const enlaceApp = (ruta) => `${urlApp()}/#${ruta}`

const escaparHtml = (texto) =>
    String(texto ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

const formatoFecha = new Intl.DateTimeFormat('es-CL', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: process.env.APP_ZONA_HORARIA || 'America/Santiago',
})
const formatearFecha = (fecha) => formatoFecha.format(new Date(fecha))

/**
 * Arma el correo con un párrafo, un botón y, si corresponde, el enlace para dejar de recibir
 * este tipo de aviso. Los textos de `parrafos` se escapan en la versión HTML.
 */
const componer = ({ asunto, parrafos, boton, enlace, desuscribir }) => {
    const pie = desuscribir
        ? `Recibes este correo por tus avisos de ${nombreApp()}. Para dejar de recibir este tipo de aviso: ${desuscribir}`
        : `Este correo fue enviado por ${nombreApp()}.`

    const texto = [...parrafos, '', `${boton}: ${enlace}`, '', '—', pie].join('\n')

    const html = `<!doctype html>
<html lang="es"><body style="margin:0;padding:24px;background:#f1f4f6;font-family:Arial,Helvetica,sans-serif;color:#292929">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #d5dade;border-radius:10px;padding:24px">
    <p style="margin:0 0 16px;font-size:13px;color:#5d646c">${escaparHtml(nombreApp())}</p>
    ${parrafos.map((p) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.5">${escaparHtml(p)}</p>`).join('\n    ')}
    <p style="margin:20px 0">
      <a href="${escaparHtml(enlace)}" style="display:inline-block;background:#739121;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;font-size:15px">${escaparHtml(boton)}</a>
    </p>
  </div>
  <p style="max-width:520px;margin:12px auto 0;font-size:12px;color:#5d646c;line-height:1.4">
    ${desuscribir
        ? `Recibes este correo por tus avisos de ${escaparHtml(nombreApp())}. <a href="${escaparHtml(desuscribir)}" style="color:#5d646c">Dejar de recibir este tipo de aviso</a>.`
        : `Este correo fue enviado por ${escaparHtml(nombreApp())}.`}
  </p>
</body></html>`

    return { asunto, texto, html }
}

const PLANTILLAS = {
    tarea_creada: ({ titulo, asignatura, limite }, extra) =>
        componer({
            asunto: `Nueva tarea en ${asignatura}: ${titulo}`,
            parrafos: [
                `Se publicó la tarea "${titulo}" en ${asignatura}.`,
                `El plazo de entrega termina el ${formatearFecha(limite)}.`,
            ],
            boton: 'Ver la tarea',
            ...extra,
        }),

    tarea_por_cerrar: ({ titulo, asignatura, limite }, extra) =>
        componer({
            asunto: `La tarea "${titulo}" cierra pronto`,
            parrafos: [
                `Aún no has enviado la tarea "${titulo}" de ${asignatura}.`,
                `El plazo termina el ${formatearFecha(limite)}. Después de esa hora no se aceptan entregas.`,
            ],
            boton: 'Entregar la tarea',
            ...extra,
        }),

    entrega_calificada: ({ titulo, asignatura }, extra) =>
        componer({
            asunto: `Tu entrega de "${titulo}" fue revisada`,
            parrafos: [`Tu docente revisó tu entrega de la tarea "${titulo}" en ${asignatura}.`],
            boton: 'Ver la revisión',
            ...extra,
        }),

    agregado_asignatura: ({ asignatura }, extra) =>
        componer({
            asunto: `Te agregaron a ${asignatura}`,
            parrafos: [`Ahora eres parte de la asignatura ${asignatura}.`],
            boton: 'Ir a la asignatura',
            ...extra,
        }),

    agregado_organizacion: ({ organizacion }, extra) =>
        componer({
            asunto: `Te agregaron a ${organizacion}`,
            parrafos: [`Ahora eres parte de la organización ${organizacion} en ${nombreApp()}.`],
            boton: 'Ir a la plataforma',
            ...extra,
        }),

    // no es una notificación: no tiene enlace para desuscribirse porque se envía una sola vez
    cuenta_creada: ({ nombre, organizacion, horas }, { enlace }) =>
        componer({
            asunto: `Tu cuenta en ${nombreApp()}`,
            parrafos: [
                `Hola ${nombre}:`,
                `Se creó tu cuenta en ${nombreApp()} para la organización ${organizacion}.`,
                `Define tu contraseña con el siguiente enlace. Es personal y vence en ${horas} horas.`,
                'Si tu administrador ya te entregó una contraseña inicial, también puedes ingresar con ella.',
            ],
            boton: 'Definir mi contraseña',
            enlace,
        }),
}

/**
 * @param {string} tipo
 * @param {object} datos
 * @param {{ enlace: string, desuscribir?: string }} extra
 * @returns {{ asunto: string, texto: string, html: string } | null}
 */
const renderizarCorreo = (tipo, datos, extra) => PLANTILLAS[tipo]?.(datos, extra) ?? null

module.exports = { renderizarCorreo, enlaceApp, urlApp, escaparHtml }
