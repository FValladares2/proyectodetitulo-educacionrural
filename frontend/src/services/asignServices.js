import { getAuthToken } from './authServices'
const apiBase = import.meta.env.VITE_API_BASE_URL || ''

const fetchAsignaturas = async (
  controller,
  page = 1,
  limit = 10,
  sortOption = 'acceso',
  currentOrg,
  search = '',
  soloDocente = false,
  activoFilter = 'all',
  setAsignaturas,
  setTotal,
  setTotalPages,
  setLoading,
  setError,
) => {
  setLoading(true)
  setError('')

  try {
    const token = getAuthToken()
    if (!token) {
      throw new Error('Sesión no válida o expirada.')
    }

    // 'acceso' ordena por el último acceso del usuario; 'creado' por fecha de creación
    const ORDENES = {
      acceso: ['ultimoAcceso', 'desc'],
      creado: ['createdAt', 'desc'],
      nombre_desc: ['nombre', 'desc'],
      nombre_asc: ['nombre', 'asc'],
    }
    const [sortByField, sortOrder] = ORDENES[sortOption] ?? ORDENES.nombre_asc

    const params = new URLSearchParams({
      id_organizacion: currentOrg,
      page: String(page),
      limit: String(limit),
      sortBy: sortByField,
      order: sortOrder,
    })

    if (search.trim()) {
      params.append('search', search.trim())
    }

    if (soloDocente) {
      params.append('soloDocente', 'true')
    }

    if (activoFilter !== 'all') {
      params.append('activo', activoFilter)
    }

    const response = await fetch(`${apiBase}/api/asign/user?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.message || 'Error al obtener las asignaturas.')
    }

    setAsignaturas(data.data || [])
    setTotal(data.total || 0)
    setTotalPages(data.totalPages || 1)
  } catch (err) {
    if (err.name === 'AbortError') return
    console.error('Error al consultar asignaturas:', err)
    setError(err.message || 'No se pudieron cargar las asignaturas.')
    setAsignaturas([])
  } finally {
    setLoading(false)
  }
}

// lista sin paginar (hasta `limit`) de las asignaturas activas del usuario en la organización
const fetchAsignaturasUsuario = async (id_organizacion, signal = undefined, limit = 100) => {
  const token = getAuthToken()
  if (!token) {
    throw new Error('Sesión no válida o expirada.')
  }
  const params = new URLSearchParams({
    id_organizacion,
    page: '1',
    limit: String(limit),
    sortBy: 'nombre',
    order: 'asc',
  })
  const response = await fetch(`${apiBase}/api/asign/user?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal,
  })
  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.message || 'Error al obtener las asignaturas.')
  }
  return data.data || []
}

const fetchAsignaturaById = async (id, signal = undefined) => {
  try {
    const token = getAuthToken()
    if (!token) {
      throw new Error('Sesión no válida o expirada.')
    }
    const response = await fetch(`${apiBase}/api/asign/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: signal,
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.message || 'Error al obtener la asignatura.')
    }
    return data
  } catch (error) {
    console.error('Error al obtener la asignatura:', error)
    return null
  }
}

const updateAsignaturaById = async (id, asignatura, signal = undefined) => {
  try {
    const token = getAuthToken()
    if (!token) {
      throw new Error('Sesión no válida o expirada.')
    }

    const response = await fetch(`${apiBase}/api/asign/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(asignatura),
      signal,
    })

    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.message || 'Error al actualizar la asignatura.')
    }

    return data
  } catch (error) {
    if (error.name === 'AbortError') return null
    console.error('Error al actualizar la asignatura:', error)
    return null
  }
}

const getAsignUsers = async (id, signal = undefined) => {
  try {
    const token = getAuthToken()
    if (!token) {
      throw new Error('Sesión no válida o expirada.')
    }
    const response = await fetch(`${apiBase}/api/asign/${id}/users`, {
      headers: { Authorization: `Bearer ${token}` },
      signal,
    })
    if (!response.ok) {
      return { teachers: [], users: [] }
    }
    const data = await response.json()
    return data
  } catch (error) {
    if (error.name === 'AbortError') return null
    console.warn('Endpoint de usuarios de asignatura no disponible aún:', error)
    return { admins: [], teachers: [], users: [] }
  }
}

const addUsersToAsignBatch = async (id_asignatura, usuarios, signal = undefined) => {
  try {
    const token = getAuthToken()
    if (!token) {
      throw new Error('Sesión no válida o expirada.')
    }
    const response = await fetch(`${apiBase}/api/asign/users/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        id_asignatura,
        usuarios,
      }),
      signal,
    })
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.message || 'No se pudieron agregar los usuarios a la asignatura.')
    }
    return data
  } catch (error) {
    if (error.name === 'AbortError') return null
    throw error
  }
}

// img es "recurso:<id>" con una imagen de la asignatura, o null para volver al banner por defecto
const updateAsignaturaImg = async (id, img) => {
  const token = getAuthToken()
  if (!token) {
    throw new Error('Sesión no válida o expirada.')
  }
  const response = await fetch(`${apiBase}/api/asign/${id}/img`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ img }),
  })
  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.message || 'No se pudo actualizar la imagen de la asignatura.')
  }
  return data
}

const asignServices = {
  fetchAsignaturas,
  fetchAsignaturasUsuario,
  fetchAsignaturaById,
  updateAsignaturaById,
  updateAsignaturaImg,
  getAsignUsers,
  addUsersToAsignBatch,
}

export {
  fetchAsignaturas,
  fetchAsignaturasUsuario,
  fetchAsignaturaById,
  updateAsignaturaById,
  updateAsignaturaImg,
  getAsignUsers,
  addUsersToAsignBatch,
}
export default asignServices
