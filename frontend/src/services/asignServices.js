import { getAuthToken } from './authServices'
const apiBase = import.meta.env.VITE_API_BASE_URL || ''

const fetchAsignaturas = async (
  controller,
  page = 1,
  limit = 10,
  sortOption = 'reciente',
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

    const [sortByField, sortOrder] =
      sortOption === 'reciente'
        ? ['createdAt', 'desc']
        : sortOption === 'nombre_desc'
          ? ['nombre', 'desc']
          : ['nombre', 'asc']

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

const getInitialOrgId = () => {
  const storedOrg = localStorage.getItem('userOrg') || sessionStorage.getItem('userOrg')
  if (storedOrg && storedOrg !== 'undefined' && storedOrg !== 'null') {
    return storedOrg
  }
  const authUser = getAuthUser()
  return authUser?.org_principal || authUser?.id_organizacion || ''
}

const fetchAsignaturaById = async (id) => {
  try {
    const token = getAuthToken()
    if (!token) {
      throw new Error('Sesión no válida o expirada.')
    }
    const response = await fetch(`${apiBase}/api/asign/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
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

export { fetchAsignaturas, getInitialOrgId, fetchAsignaturaById }
