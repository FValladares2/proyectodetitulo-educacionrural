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
  setDocenteEnAlguna = undefined,
  todas = false,
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

    // todas las de la organización, no solo las propias (solo administradores)
    if (todas) {
      params.append('todas', 'true')
    }

    // sin el parámetro el backend devuelve solo las activas; un valor vacío no filtra por estado
    params.append('activo', activoFilter === 'all' ? '' : activoFilter)

    const data = await apiFetch(`/api/asign/user?${params.toString()}`, {
      signal: controller.signal,
      mensajeError: 'Error al obtener las asignaturas.',
    })

    setAsignaturas(data.data || [])
    setTotal(data.total || 0)
    setTotalPages(data.totalPages || 1)
    setDocenteEnAlguna?.(Boolean(data.docenteEnAlguna))
  } catch (err) {
    if (esAbortError(err)) return
    console.error('Error al consultar asignaturas:', err)
    setError(err.message || 'No se pudieron cargar las asignaturas.')
    setAsignaturas([])
  } finally {
    setLoading(false)
  }
}

// lista sin paginar (hasta `limit`) de las asignaturas del usuario en la organización; con
// incluirInactivas también las inactivas, que son de solo lectura (para ver sus archivos)
const fetchAsignaturasUsuario = async (
  id_organizacion,
  signal = undefined,
  limit = 100,
  { incluirInactivas = false } = {},
) => {
  const params = new URLSearchParams({
    id_organizacion,
    page: '1',
    limit: String(limit),
    sortBy: 'nombre',
    order: 'asc',
  })
  // el backend filtra activas por defecto; un valor vacío no filtra por estado
  if (incluirInactivas) params.append('activo', '')
  const data = await apiFetch(`/api/asign/user?${params.toString()}`, {
    signal,
    mensajeError: 'Error al obtener las asignaturas.',
  })
  return data.data || []
}

// nombre y estado; solo docentes de la asignatura y administradores de la organización
const fetchConfigAsignatura = (id, signal = undefined) =>
  apiFetch(`/api/asign/${id}/config`, {
    signal,
    mensajeError: 'No se pudo obtener la configuración de la asignatura.',
  })

const actualizarConfigAsignatura = (id, cambios) =>
  apiFetch(`/api/asign/${id}/config`, {
    method: 'PUT',
    body: cambios,
    mensajeError: 'No se pudo guardar la configuración de la asignatura.',
  })

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

const quitarUsuarioDeAsign = (id_asignatura, id_usuario) =>
  apiFetch(`/api/asign/${id_asignatura}/users/${id_usuario}`, {
    method: 'DELETE',
    mensajeError: 'No se pudo quitar al usuario.',
  })

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
  fetchConfigAsignatura,
  actualizarConfigAsignatura,
  quitarUsuarioDeAsign,
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
  fetchConfigAsignatura,
  actualizarConfigAsignatura,
  quitarUsuarioDeAsign,
  addUsersToAsignBatch,
}
export default asignServices
