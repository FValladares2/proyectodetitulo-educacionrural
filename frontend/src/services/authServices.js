import { limpiarImagenesRecurso } from 'src/components/recursos/recursoSrc'
import { apiFetch } from './apiClient'
import { limpiarCacheOffline } from './offlineCache'

const loginUser = (credentials) =>
  apiFetch('/api/auth/login', {
    method: 'POST',
    body: credentials,
    auth: false,
    mensajeError: 'Error al iniciar sesión',
  })

const registerUser = (userData) =>
  apiFetch('/api/auth/register', {
    method: 'POST',
    body: userData,
    auth: false,
    mensajeError: 'Error al registrar el usuario',
  })

// con el token del enlace de invitación que recibe por correo un usuario nuevo
const establecerContrasena = (token, contrasena) =>
  apiFetch('/api/auth/establecer-contrasena', {
    method: 'POST',
    body: { token, contrasena },
    auth: false,
    mensajeError: 'No se pudo definir la contraseña.',
  })

const getAuthToken = () => {
  return localStorage.getItem('authToken') || sessionStorage.getItem('authToken')
}

const getAuthUser = () => {
  const user = localStorage.getItem('authUser') || sessionStorage.getItem('authUser')
  return user ? JSON.parse(user) : null
}

const clearAuthSession = () => {
  limpiarImagenesRecurso()
  // en equipos compartidos, el siguiente usuario no debe ver datos guardados sin conexión
  limpiarCacheOffline()
  localStorage.removeItem('authToken')
  localStorage.removeItem('authUser')
  localStorage.removeItem('userId')
  sessionStorage.removeItem('authToken')
  sessionStorage.removeItem('authUser')
  sessionStorage.removeItem('userId')
}

const authServices = {
  loginUser,
  registerUser,
  establecerContrasena,
  getAuthToken,
  getAuthUser,
  clearAuthSession,
}
export {
  loginUser,
  registerUser,
  establecerContrasena,
  getAuthToken,
  getAuthUser,
  clearAuthSession,
}
export default authServices
