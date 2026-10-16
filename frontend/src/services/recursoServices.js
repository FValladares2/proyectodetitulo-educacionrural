import { getAuthToken } from './authServices'
const apiBase = import.meta.env.VITE_API_BASE_URL || ''

const MAX_TAMANO_ARCHIVO = 10 * 1024 * 1024

const getTokenOrThrow = () => {
  const token = getAuthToken()
  if (!token) {
    throw new Error('Sesión no válida o expirada.')
  }
  return token
}

const leerError = async (response, mensajePorDefecto) => {
  try {
    const data = await response.json()
    return data.message || mensajePorDefecto
  } catch {
    return mensajePorDefecto
  }
}

const fetchRecursosByAsignatura = async (id_asignatura, signal = undefined) => {
  const token = getTokenOrThrow()
  const response = await fetch(`${apiBase}/api/recurso/asignatura/${id_asignatura}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal,
  })
  if (!response.ok) {
    throw new Error(await leerError(response, 'No se pudieron obtener los recursos.'))
  }
  return response.json()
}

// recursos generales de una organización, como los banners
const fetchRecursosByOrganizacion = async (id_organizacion, signal = undefined) => {
  const token = getTokenOrThrow()
  const response = await fetch(`${apiBase}/api/recurso/organizacion/${id_organizacion}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal,
  })
  if (!response.ok) {
    throw new Error(await leerError(response, 'No se pudieron obtener los recursos.'))
  }
  return response.json()
}

// el contenido requiere el token, por lo que no se puede usar un <a href> directo
const fetchRecursoBlob = async (id, signal = undefined) => {
  const token = getTokenOrThrow()
  const response = await fetch(`${apiBase}/api/recurso/${id}/descarga`, {
    headers: { Authorization: `Bearer ${token}` },
    signal,
  })
  if (!response.ok) {
    throw new Error(await leerError(response, 'No se pudo descargar el recurso.'))
  }
  return response.blob()
}

const descargarRecurso = async (recurso) => {
  const blob = await fetchRecursoBlob(recurso._id)
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = recurso.nombre
  document.body.appendChild(enlace)
  enlace.click()
  enlace.remove()
  URL.revokeObjectURL(url)
}

const renombrarRecurso = async (id, nombre) => {
  const token = getTokenOrThrow()
  const response = await fetch(`${apiBase}/api/recurso/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ nombre }),
  })
  if (!response.ok) {
    throw new Error(await leerError(response, 'No se pudo renombrar el recurso.'))
  }
  return response.json()
}

const eliminarRecurso = async (id) => {
  const token = getTokenOrThrow()
  const response = await fetch(`${apiBase}/api/recurso/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!response.ok) {
    throw new Error(await leerError(response, 'No se pudo eliminar el recurso.'))
  }
  return response.json()
}

// configuración para la subida multipart que realiza el propio file manager (campo "file")
const getUploadConfig = () => ({
  url: `${apiBase}/api/recurso/upload`,
  method: 'POST',
  headers: { Authorization: `Bearer ${getAuthToken()}` },
})

const recursoServices = {
  MAX_TAMANO_ARCHIVO,
  fetchRecursosByAsignatura,
  fetchRecursosByOrganizacion,
  fetchRecursoBlob,
  descargarRecurso,
  renombrarRecurso,
  eliminarRecurso,
  getUploadConfig,
}

export {
  MAX_TAMANO_ARCHIVO,
  fetchRecursosByAsignatura,
  fetchRecursosByOrganizacion,
  fetchRecursoBlob,
  descargarRecurso,
  renombrarRecurso,
  eliminarRecurso,
  getUploadConfig,
}
export default recursoServices
