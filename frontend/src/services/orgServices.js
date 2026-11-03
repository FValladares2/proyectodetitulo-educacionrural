import { apiFetch } from './apiClient'
import { getAuthUser } from './authServices'

const getInitialOrgId = () => {
  const storedOrg = localStorage.getItem('userOrg') || sessionStorage.getItem('userOrg')
  if (storedOrg && storedOrg !== 'undefined' && storedOrg !== 'null') {
    return storedOrg
  }
  const authUser = getAuthUser()
  return authUser?.org_principal || authUser?.id_organizacion || ''
}

const getOrgById = async (id, signal = undefined) => {
  try {
    return await apiFetch(`/api/org/${id}`, {
      signal,
      mensajeError: 'Error al obtener la organización.',
    })
  } catch (error) {
    console.error('Error al obtener la organización:', error)
    return null
  }
}

const getOrgsWithUser = async (signal = undefined) => {
  try {
    return await apiFetch('/api/org/user', {
      signal,
      mensajeError: 'Error al obtener organizaciones con usuario.',
    })
  } catch (error) {
    console.error('Error al obtener organizaciones con usuario:', error)
    return null
  }
}

const getUserBatchBasicInfo = async (id_organizacion, signal = undefined) => {
  try {
    return await apiFetch(`/api/users/batch/${id_organizacion}`, {
      signal,
      mensajeError: 'Error al obtener la información de los usuarios.',
    })
  } catch (error) {
    console.error('Error al obtener la información de los usuarios:', error)
    return null
  }
}

const updateInitialOrgId = async (id_organizacion) => {
  try {
    const data = await apiFetch('/api/org/user/update', {
      method: 'PUT',
      body: { id_organizacion },
      mensajeError: 'Error al cambiar de organización.',
    })
    localStorage.setItem('userOrg', id_organizacion)
    return data
  } catch (error) {
    console.error('Error al cambiar de organización:', error)
    return null
  }
}

// img es "recurso:<id>" con una imagen de la organización, o null para volver al banner por defecto
const updateOrgImg = (id, img) =>
  apiFetch(`/api/org/${id}/img`, {
    method: 'PUT',
    body: { img },
    mensajeError: 'No se pudo actualizar la imagen de la organización.',
  })

const addUsersToOrgBatch = (id_organizacion, usuarios) =>
  apiFetch('/api/org/users/batch', {
    method: 'POST',
    body: { id_organizacion, usuarios },
    mensajeError: 'No se pudieron agregar los usuarios.',
  })

const quitarUsuarioDeOrg = (id_organizacion, id_usuario) =>
  apiFetch(`/api/org/${id_organizacion}/users/${id_usuario}`, {
    method: 'DELETE',
    mensajeError: 'No se pudo quitar al usuario.',
  })

// { nombre, descripcion, direccion, informacion_contacto }; devuelve la organización actualizada
const actualizarOrg = (id_organizacion, datos) =>
  apiFetch(`/api/org/${id_organizacion}`, {
    method: 'PUT',
    body: datos,
    mensajeError: 'No se pudo guardar la organización.',
  })

const orgServices = {
  actualizarOrg,
  getInitialOrgId,
  getOrgById,
  getOrgsWithUser,
  getUserBatchBasicInfo,
  updateInitialOrgId,
  updateOrgImg,
  addUsersToOrgBatch,
  quitarUsuarioDeOrg,
}

export {
  actualizarOrg,
  getInitialOrgId,
  getOrgById,
  getOrgsWithUser,
  getUserBatchBasicInfo,
  updateInitialOrgId,
  updateOrgImg,
  addUsersToOrgBatch,
  quitarUsuarioDeOrg,
}
export default orgServices
