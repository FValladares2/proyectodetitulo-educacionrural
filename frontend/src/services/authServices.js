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

// guarda cambios del perfil o un token nuevo en el mismo almacenamiento que la sesión actual
// (localStorage si eligió mantener la sesión, sessionStorage si no)
const actualizarSesion = ({ user, token } = {}) => {
  const almacen = localStorage.getItem('authToken') ? localStorage : sessionStorage
  if (user) almacen.setItem('authUser', JSON.stringify({ ...getAuthUser(), ...user }))
  if (token) almacen.setItem('authToken', token)
}

const fetchPerfil = (signal = undefined) =>
  apiFetch('/api/usuario/perfil', { signal, mensajeError: 'No se pudo obtener el perfil.' })

const actualizarPerfil = async (cambios) => {
  const perfil = await apiFetch('/api/usuario/perfil', {
    method: 'PUT',
    body: cambios,
    mensajeError: 'No se pudo actualizar el perfil.',
  })
  actualizarSesion({ user: { nombre: perfil.nombre } })
  return perfil
}

// el servidor cierra las demás sesiones y devuelve un token nuevo para esta
const cambiarContrasena = async (actual, nueva) => {
  const data = await apiFetch('/api/usuario/contrasena', {
    method: 'PUT',
    body: { actual, nueva },
    mensajeError: 'No se pudo cambiar la contraseña.',
  })
  actualizarSesion({ token: data.token })
  return data
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
  fetchPerfil,
  actualizarPerfil,
  cambiarContrasena,
}
export {
  loginUser,
  registerUser,
  establecerContrasena,
  getAuthToken,
  getAuthUser,
  clearAuthSession,
  fetchPerfil,
  actualizarPerfil,
  cambiarContrasena,
}
export default authServices
