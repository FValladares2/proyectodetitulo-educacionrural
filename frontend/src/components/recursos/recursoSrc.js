import { useEffect, useState } from 'react'
import { fetchRecursoBlob } from 'src/services/recursoServices'

// los recursos se referencian como recurso:<id>, en el markup de asignaturas y en los banners (img)
const PATRON_RECURSO = /^recurso:([0-9a-f]{24})$/i

// id -> Promise<objectURL>, compartido por toda la app para no descargar dos veces
const cache = new Map()

const getRecursoId = (src) => PATRON_RECURSO.exec(src ?? '')?.[1] ?? null

const esRecursoSrc = (src) => getRecursoId(src) !== null

const crearRecursoSrc = (recursoId) => `recurso:${recursoId}`

// la descarga requiere el token, por lo que el src se convierte en un objectURL del blob
const resolverRecursoSrc = (src) => {
  const recursoId = getRecursoId(src)
  if (!recursoId) return Promise.resolve(src)

  if (!cache.has(recursoId)) {
    const promesa = fetchRecursoBlob(recursoId)
      .then((blob) => URL.createObjectURL(blob))
      .catch((error) => {
        // si falla se elimina para poder reintentar en el siguiente render
        cache.delete(recursoId)
        throw error
      })
    cache.set(recursoId, promesa)
  }
  return cache.get(recursoId)
}

const limpiarImagenesRecurso = () => {
  cache.forEach((promesa) => promesa.then(URL.revokeObjectURL, () => {}))
  cache.clear()
}

/**
 * Resuelve un src que puede ser recurso:<id> a una URL mostrable.
 * @returns {{ url: string|null, estado: 'cargando'|'listo'|'error' }}
 */
const useRecursoSrc = (src) => {
  const esRecurso = esRecursoSrc(src)
  // se guarda el src de origen para descartar resultados de un src anterior
  const [resultado, setResultado] = useState({ src: null, url: null, error: false })

  useEffect(() => {
    if (!esRecurso) return undefined

    let activo = true
    resolverRecursoSrc(src)
      .then((url) => activo && setResultado({ src, url, error: false }))
      .catch(() => activo && setResultado({ src, url: null, error: true }))
    return () => {
      activo = false
    }
  }, [src, esRecurso])

  if (!esRecurso) return { url: src, estado: 'listo' }
  if (resultado.src !== src) return { url: null, estado: 'cargando' }
  return resultado.error ? { url: null, estado: 'error' } : { url: resultado.url, estado: 'listo' }
}

export {
  getRecursoId,
  esRecursoSrc,
  crearRecursoSrc,
  resolverRecursoSrc,
  limpiarImagenesRecurso,
  useRecursoSrc,
}
