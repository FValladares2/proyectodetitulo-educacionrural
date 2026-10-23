// Fechas de tareas: los inputs datetime-local usan la hora local del navegador sin zona
// ("2026-11-12T23:59"); al servidor se envían como ISO. Abrir o cerrar lo decide el servidor.

const formato = new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium', timeStyle: 'short' })

const formatearFecha = (fecha) => (fecha ? formato.format(new Date(fecha)) : '')

const dosDigitos = (n) => String(n).padStart(2, '0')

const aInputLocal = (fecha) => {
  if (!fecha) return ''
  const d = new Date(fecha)
  return `${d.getFullYear()}-${dosDigitos(d.getMonth() + 1)}-${dosDigitos(d.getDate())}T${dosDigitos(d.getHours())}:${dosDigitos(d.getMinutes())}`
}

const desdeInputLocal = (valor) => (valor ? new Date(valor).toISOString() : '')

/**
 * Texto y color de la insignia de una tarea. Con `enviada_en` (vista del estudiante) se
 * indica que ya entregó.
 */
const insigniaTarea = (tarea) => {
  if (tarea.enviada_en) return { texto: 'Entregada', color: 'primary' }
  if (tarea.estado === 'pendiente') {
    return { texto: `Abre el ${formatearFecha(tarea.apertura)}`, color: 'info' }
  }
  if (tarea.estado === 'abierta') {
    return { texto: `Cierra el ${formatearFecha(tarea.limite)}`, color: 'success' }
  }
  return { texto: 'Cerrada', color: 'secondary' }
}

export { formatearFecha, aInputLocal, desdeInputLocal, insigniaTarea }
