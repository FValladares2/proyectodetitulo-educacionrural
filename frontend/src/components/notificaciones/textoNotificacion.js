import {
  FaRegBell,
  FaRegCalendarXmark,
  FaRegCircleCheck,
  FaRegClipboard,
  FaRegFolderOpen,
  FaRegUser,
} from 'react-icons/fa6'

const formatoFecha = new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium', timeStyle: 'short' })
const formatoRelativo = new Intl.RelativeTimeFormat('es', { numeric: 'auto' })

// "hace 5 minutos", "ayer"; las de más de una semana muestran la fecha
const tiempoRelativo = (fecha) => {
  const segundos = Math.round((new Date(fecha).getTime() - Date.now()) / 1000)
  const abs = Math.abs(segundos)
  if (abs < 60) return 'recién'
  if (abs < 3600) return formatoRelativo.format(Math.round(segundos / 60), 'minute')
  if (abs < 86400) return formatoRelativo.format(Math.round(segundos / 3600), 'hour')
  if (abs < 7 * 86400) return formatoRelativo.format(Math.round(segundos / 86400), 'day')
  return formatoFecha.format(new Date(fecha))
}

/**
 * Texto e ícono de cada tipo de notificación. Los textos se arman aquí, con los datos mínimos
 * que guarda el backend, para poder cambiar su redacción sin migrar datos.
 */
const TIPOS = {
  tarea_creada: {
    icono: FaRegClipboard,
    texto: ({ titulo, asignatura }) => `Nueva tarea "${titulo}" en ${asignatura}`,
  },
  tarea_por_cerrar: {
    icono: FaRegCalendarXmark,
    texto: ({ titulo, limite }) =>
      `La tarea "${titulo}" cierra pronto${limite ? ` (${formatoFecha.format(new Date(limite))})` : ''}`,
  },
  entrega_calificada: {
    icono: FaRegCircleCheck,
    texto: ({ titulo }) => `Tu entrega de "${titulo}" fue revisada`,
  },
  entrega_recibida: {
    icono: FaRegFolderOpen,
    texto: ({ titulo, cantidad = 1 }) =>
      cantidad > 1 ? `${cantidad} entregas nuevas en "${titulo}"` : `Nueva entrega en "${titulo}"`,
  },
  agregado_asignatura: {
    icono: FaRegUser,
    texto: ({ asignatura }) => `Te agregaron a ${asignatura}`,
  },
  agregado_organizacion: {
    icono: FaRegUser,
    texto: ({ organizacion }) => `Te agregaron a ${organizacion}`,
  },
}

const describirNotificacion = (notificacion) => {
  const tipo = TIPOS[notificacion.tipo]
  return {
    Icono: tipo?.icono ?? FaRegBell,
    texto: tipo ? tipo.texto(notificacion.datos || {}) : 'Nueva notificación',
  }
}

export { describirNotificacion, tiempoRelativo }
