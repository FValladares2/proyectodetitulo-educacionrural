import { apiFetch, esAbortError } from './apiClient'

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
    // 'acceso' ordena por el último acceso del usuario; 'creado' por fecha de creación
    const ORDENES = {
      acceso: ['ultimoAcceso', 'desc'],
      creado: ['creado_en', 'desc'],
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

    const data = await apiFetch(`/api/asign/user?${params.toString()}`, {
      signal: controller.signal,
      mensajeError: 'Error al obtener las asignaturas.',
    })

    setAsignaturas(data.data || [])
    setTotal(data.total || 0)
    setTotalPages(data.totalPages || 1)
  } catch (err) {
    if (esAbortError(err)) return
    console.error('Error al consultar asignaturas:', err)
    setError(err.message || 'No se pudieron cargar las asignaturas.')
    setAsignaturas([])
  } finally {
    setLoading(false)
  }
}

// lista sin paginar (hasta `limit`) de las asignaturas activas del usuario en la organización
const fetchAsignaturasUsuario = async (id_organizacion, signal = undefined, limit = 100) => {
  const params = new URLSearchParams({
    id_organizacion,
    page: '1',
    limit: String(limit),
    sortBy: 'nombre',
    order: 'asc',
  })
  const data = await apiFetch(`/api/asign/user?${params.toString()}`, {
    signal,
    mensajeError: 'Error al obtener las asignaturas.',
  })
  return data.data || []
}

const fetchAsignaturaById = async (id, signal = undefined) => {
  try {
    return await apiFetch(`/api/asign/${id}`, {
      signal,
      mensajeError: 'Error al obtener la asignatura.',
    })
  } catch (error) {
    console.error('Error al obtener la asignatura:', error)
    return null
  }
}

const updateAsignaturaById = async (id, asignatura, signal = undefined) => {
  try {
    return await apiFetch(`/api/asign/${id}`, {
      method: 'PUT',
      body: asignatura,
      signal,
      mensajeError: 'Error al actualizar la asignatura.',
    })
  } catch (error) {
    if (esAbortError(error)) return null
    console.error('Error al actualizar la asignatura:', error)
    return null
  }
}

const getAsignUsers = async (id, signal = undefined) => {
  try {
    return await apiFetch(`/api/asign/${id}/users`, { signal })
  } catch (error) {
    if (esAbortError(error)) return null
    // si la sesión es válida pero el endpoint falla, se muestra la lista vacía
    if (error.status) return { teachers: [], users: [] }
    console.warn('Endpoint de usuarios de asignatura no disponible aún:', error)
    return { admins: [], teachers: [], users: [] }
  }
}

const addUsersToAsignBatch = async (id_asignatura, usuarios, signal = undefined) => {
  try {
    return await apiFetch('/api/asign/users/batch', {
      method: 'POST',
      body: { id_asignatura, usuarios },
      signal,
      mensajeError: 'No se pudieron agregar los usuarios a la asignatura.',
    })
  } catch (error) {
    if (esAbortError(error)) return null
    throw error
  }
}

// img es "recurso:<id>" con una imagen de la asignatura, o null para volver al banner por defecto
const updateAsignaturaImg = (id, img) =>
  apiFetch(`/api/asign/${id}/img`, {
    method: 'PUT',
    body: { img },
    mensajeError: 'No se pudo actualizar la imagen de la asignatura.',
  })

const createAsignatura = (asignatura) =>
  apiFetch('/api/asign/create', {
    method: 'POST',
    body: asignatura,
    mensajeError: 'No se pudo crear la asignatura.',
  })

const asignServices = {
  fetchAsignaturas,
  fetchAsignaturasUsuario,
  fetchAsignaturaById,
  updateAsignaturaById,
  updateAsignaturaImg,
  createAsignatura,
  getAsignUsers,
  addUsersToAsignBatch,
}

export {
  fetchAsignaturas,
  fetchAsignaturasUsuario,
  fetchAsignaturaById,
  updateAsignaturaById,
  updateAsignaturaImg,
  createAsignatura,
  getAsignUsers,
  addUsersToAsignBatch,
}
export default asignServices
