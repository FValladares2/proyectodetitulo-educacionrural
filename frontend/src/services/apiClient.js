// Cliente HTTP común para todos los servicios: dirección del backend, token, formato de errores
// y detección de falta de conexión en un solo lugar. Las respuestas GET de /api pueden venir
// del caché del service worker cuando no hay red (ver vite.config.mjs).

const apiBase = import.meta.env.VITE_API_BASE_URL || ''

const MENSAJE_SIN_CONEXION =
  'Sin conexión a internet. Los cambios no se pueden guardar hasta que vuelva la conexión.'

/**
 * Error de una llamada a la API.
 * - status: código HTTP (0 si la solicitud no llegó al servidor)
 * - sinConexion: true si no hubo red, para distinguirlo de un rechazo del servidor
 * - data: cuerpo JSON de la respuesta, si lo había
 */
class ApiError extends Error {
  constructor(message, { status = 0, sinConexion = false, data = null } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.sinConexion = sinConexion
    this.data = data
  }
}

const esAbortError = (error) => error?.name === 'AbortError'

// el token se lee aquí y no desde authServices para evitar una dependencia circular
const getAuthToken = () => localStorage.getItem('authToken') || sessionStorage.getItem('authToken')

const leerJson = async (response) => {
  try {
    return await response.json()
  } catch {
    return null
  }
}

/**
 * Realiza una solicitud a la API.
 * @param {string} ruta - ruta desde la raíz de la API, por ejemplo "/api/asign/123"
 * @param {object} [opciones]
 * @param {string} [opciones.method] - GET por defecto
 * @param {object|FormData} [opciones.body] - los objetos se envían como JSON
 * @param {AbortSignal} [opciones.signal]
 * @param {boolean} [opciones.auth] - envía el token (true por defecto); sin token falla con 401
 * @param {'json'|'blob'} [opciones.respuesta] - cómo leer una respuesta exitosa
 * @param {string} [opciones.mensajeError] - mensaje si el servidor no entrega uno
 * @returns {Promise<any>}
 * @throws {ApiError} si no hay sesión, no hay conexión o el servidor responde con error;
 *   las cancelaciones se relanzan tal cual (AbortError)
 */
const apiFetch = async (
  ruta,
  {
    method = 'GET',
    body,
    signal,
    auth = true,
    respuesta = 'json',
    mensajeError = 'Ocurrió un error al comunicarse con el servidor.',
  } = {},
) => {
  const headers = {}
  if (auth) {
    const token = getAuthToken()
    if (!token) {
      throw new ApiError('Sesión no válida o expirada.', { status: 401 })
    }
    headers.Authorization = `Bearer ${token}`
  }

  let cuerpo = body
  if (body !== undefined && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
    cuerpo = JSON.stringify(body)
  }

  let response
  try {
    response = await fetch(`${apiBase}${ruta}`, { method, headers, body: cuerpo, signal })
  } catch (error) {
    if (esAbortError(error)) throw error
    // fetch solo falla sin respuesta: sin red, servidor caído o CORS
    const sinConexion = typeof navigator !== 'undefined' && navigator.onLine === false
    throw new ApiError(
      sinConexion ? MENSAJE_SIN_CONEXION : 'No se pudo conectar con el servidor.',
      { sinConexion: true },
    )
  }

  if (!response.ok) {
    const data = await leerJson(response)
    throw new ApiError(data?.message || mensajeError, { status: response.status, data })
  }

  if (respuesta === 'blob') return response.blob()
  return leerJson(response)
}

export { apiBase, apiFetch, ApiError, esAbortError, MENSAJE_SIN_CONEXION }
