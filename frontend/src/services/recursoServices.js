import { apiBase, apiFetch, encabezadosDeTunel } from './apiClient'
import { getAuthToken } from './authServices'

const MAX_TAMANO_ARCHIVO = 10 * 1024 * 1024

const formatoDecimal = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 1 })

// "850 KB", "12,3 MB"; 0 bytes se muestra como "0 KB"
const formatearTamano = (bytes = 0) =>
  bytes >= 1024 * 1024
    ? `${formatoDecimal.format(bytes / 1024 / 1024)} MB`
    : `${Math.ceil(bytes / 1024)} KB`

const fetchRecursosByAsignatura = (id_asignatura, signal = undefined) =>
  apiFetch(`/api/recurso/asignatura/${id_asignatura}`, {
    signal,
    mensajeError: 'No se pudieron obtener los recursos.',
  })

// recursos generales de una organización, como los banners
const fetchRecursosByOrganizacion = (id_organizacion, signal = undefined) =>
  apiFetch(`/api/recurso/organizacion/${id_organizacion}`, {
    signal,
    mensajeError: 'No se pudieron obtener los recursos.',
  })

// el contenido requiere el token, por lo que no se puede usar un <a href> directo
const fetchRecursoBlob = (id, signal = undefined) =>
  apiFetch(`/api/recurso/${id}/descarga`, {
    signal,
    respuesta: 'blob',
    mensajeError: 'No se pudo descargar el recurso.',
  })

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

const renombrarRecurso = (id, nombre) =>
  apiFetch(`/api/recurso/${id}`, {
    method: 'PATCH',
    body: { nombre },
    mensajeError: 'No se pudo renombrar el recurso.',
  })

const eliminarRecurso = (id) =>
  apiFetch(`/api/recurso/${id}`, {
    method: 'DELETE',
    mensajeError: 'No se pudo eliminar el recurso.',
  })

// configuración para la subida multipart que realiza el propio file manager (campo "file")
const getUploadConfig = () => ({
  url: `${apiBase}/api/recurso/upload`,
  method: 'POST',
  headers: { ...encabezadosDeTunel(), Authorization: `Bearer ${getAuthToken()}` },
})

const recursoServices = {
  MAX_TAMANO_ARCHIVO,
  formatearTamano,
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
  formatearTamano,
  fetchRecursosByAsignatura,
  fetchRecursosByOrganizacion,
  fetchRecursoBlob,
  descargarRecurso,
  renombrarRecurso,
  eliminarRecurso,
  getUploadConfig,
}
export default recursoServices
