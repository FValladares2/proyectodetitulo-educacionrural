import { createContext } from 'react'

// las tareas se enlazan en el markup como [título](tarea:<id>)
const PATRON_TAREA = /^tarea:([0-9a-f]{24})$/i

const getTareaId = (href) => PATRON_TAREA.exec(href ?? '')?.[1] ?? null

const crearTareaHref = (tareaId) => `tarea:${tareaId}`

// tareas de la asignatura abierta: { tareas: Map<id, tarea> | null, estado, abrirTarea(id) }
// estado es 'cargando', 'listo' o 'error'; con 'error' los enlaces se muestran sin verificar
const TareasAsignaturaContext = createContext({
  tareas: null,
  estado: 'cargando',
  abrirTarea: () => {},
})

export { getTareaId, crearTareaHref, TareasAsignaturaContext }
