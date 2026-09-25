import { getAuthToken, getAuthUser } from './authServices'
const apiBase = process.env.REACT_APP_API_URL || 'http://localhost:8064'

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
    const token = getAuthToken()
    if (!token) {
      throw new Error('Sesión no válida o expirada.')
    }
    const response = await fetch(`${apiBase}/api/org/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: signal,
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.message || 'Error al obtener la organización.')
    }
    return data
  } catch (error) {
    console.error('Error al obtener la organización:', error)
    return null
  }
}

const getOrgsWithUser = async (signal = undefined) => {
  try {
    const token = getAuthToken()
    if (!token) {
      throw new Error('Sesión no válida o expirada.')
    }
    const response = await fetch(`${apiBase}/api/org/user`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: signal,
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.message || 'Error al obtener organizaciones con usuario.')
    }
    return data
  } catch (error) {
    console.error('Error al obtener organizaciones con usuario:', error)
    return null
  }
}

const getUserBatchBasicInfo = async (id_organizacion, signal = undefined) => {
  try {
    const token = getAuthToken()
    if (!token) {
      throw new Error('Sesión no válida o expirada.')
    }
    const response = await fetch(`${apiBase}/api/users/batch/${id_organizacion}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: signal,
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.message || 'Error al obtener la información de los usuarios.')
    }
    return data
  } catch (error) {
    console.error('Error al obtener la información de los usuarios:', error)
    return null
  }
}

const updateInitialOrgId = async (id_organizacion) => {
  try {
    const token = getAuthToken()
    if (!token) {
      throw new Error('Sesión no válida o expirada.')
    }
    const response = await fetch(`${apiBase}/api/org/user/update`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ id_organizacion }),
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.message || 'Error al cambiar de organización.')
    }

    localStorage.setItem('userOrg', id_organizacion)

    return data
  } catch (error) {
    console.error('Error al cambiar de organización:', error)
    return null
  }
}

export { getInitialOrgId, getOrgById, getOrgsWithUser, getUserBatchBasicInfo, updateInitialOrgId }
