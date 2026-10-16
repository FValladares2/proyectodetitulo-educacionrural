import { createContext } from 'react'
import { defaultUrlTransform } from 'react-markdown'
import { esRecursoSrc } from 'src/components/recursos/recursoSrc'

// react-markdown elimina los protocolos desconocidos, así que recurso: se deja pasar
const urlTransform = (url) => (esRecursoSrc(url) ? url : defaultUrlTransform(url))

// metadatos de los recursos de la asignatura abierta: { recursos: Map<id, recurso> | null, estado }
// estado es 'cargando', 'listo' o 'error'; con 'error' los enlaces se muestran sin verificar
const RecursosAsignaturaContext = createContext({ recursos: null, estado: 'cargando' })

export { urlTransform, RecursosAsignaturaContext }
