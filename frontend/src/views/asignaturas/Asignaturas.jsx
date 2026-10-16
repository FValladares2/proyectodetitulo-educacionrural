import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  CAlert,
  CBadge,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CFormCheck,
  CFormInput,
  CFormSelect,
  CInputGroup,
  CInputGroupText,
  CPagination,
  CPaginationItem,
  CRow,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilBook, cilPeople, cilPlus, cilReload, cilSearch } from '@coreui/icons'
import NewAsignModal from 'src/components/modals/newAsignModal'
import { useNavigate } from 'react-router-dom'
import { fetchAsignaturas } from 'src/services/asignServices'
import { getAuthToken, getAuthUser } from 'src/services/authServices'
import { getInitialOrgId, getOrgsWithUser } from 'src/services/orgServices'

const apiBase = import.meta.env.VITE_API_BASE_URL || ''

const Asignaturas = () => {
  const navigate = useNavigate()

  // Modal visibility state
  const [modalVisible, setModalVisible] = useState(false)

  // Data states
  const [asignaturas, setAsignaturas] = useState([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  // Organization state
  const [orgId, setOrgId] = useState(getInitialOrgId)

  // Filter & pagination states
  const [search, setSearch] = useState('')
  const [soloDocente, setSoloDocente] = useState(false)
  const [activoFilter, setActivoFilter] = useState('all') // 'all', 'true', 'false'
  const [sortOption, setSortOption] = useState('nombre_asc') // 'nombre_asc', 'nombre_desc', 'acceso', 'creado'
  const [page, setPage] = useState(1)
  const limit = 20

  // Incrementing this key manually triggers a refetch (e.g. after creating an asignatura)
  const [refetchKey, setRefetchKey] = useState(0)

  // Current authenticated user
  const authUser = useMemo(() => getAuthUser(), [])

  // Resolve user organization if not found in storage
  useEffect(() => {
    let isMounted = true
    const resolveOrg = async () => {
      try {
        const response = await getOrgsWithUser()

        if (response && isMounted) {
          const orgs = response
          if (Array.isArray(orgs) && orgs.length > 0) {
            const currentOrgId = getInitialOrgId()
            const matchedOrg = currentOrgId
              ? orgs.find((o) => String(o._id) === String(currentOrgId)) || orgs[0]
              : orgs[0]

            setOrgId(matchedOrg._id)
            localStorage.setItem('userOrg', matchedOrg._id)
          }
        }
      } catch (err) {
        console.error('Error al resolver organización del usuario:', err)
      }
    }

    if (!orgId) {
      resolveOrg()
    }

    return () => {
      isMounted = false
    }
  }, [orgId])

  // Fetch asignaturas from /api/asign/user — inlined into effect to avoid setState-in-effect warning
  useEffect(() => {
    const currentOrg = orgId || getInitialOrgId()
    if (!currentOrg) return

    const controller = new AbortController()

    fetchAsignaturas(
      controller,
      page,
      limit,
      sortOption,
      currentOrg,
      search,
      soloDocente,
      activoFilter,
      setAsignaturas,
      setTotal,
      setTotalPages,
      setLoading,
      setError,
    )

    return () => controller.abort()
  }, [orgId, page, limit, search, soloDocente, activoFilter, sortOption, refetchKey])

  const irAAsignatura = (id, nombre) => {
    navigate(`/asignaturas/${id}`, { state: { nombre } })
  }

  // Filter change handlers that reset to page 1
  const handleSearchChange = (e) => {
    setSearch(e.target.value)
    setPage(1)
  }

  const handleSoloDocenteChange = (e) => {
    setSoloDocente(e.target.checked)
    setPage(1)
  }

  const handleActivoChange = (e) => {
    setActivoFilter(e.target.value)
    setPage(1)
  }

  const handleSortChange = (e) => {
    setSortOption(e.target.value)
    setPage(1)
  }

  const handleResetFilters = () => {
    setSearch('')
    setSoloDocente(false)
    setActivoFilter('all')
    setSortOption('nombre_asc')
    setPage(1)
  }

  const handleAsignaturaCreated = () => {
    setSuccessMessage('¡Asignatura creada con éxito!')
    setRefetchKey((k) => k + 1)
    setTimeout(() => setSuccessMessage(''), 5000)
  }

  return (
    <div className="mb-4">
      {/* Notifications */}
      {successMessage && (
        <CAlert color="success" dismissible onClose={() => setSuccessMessage('')}>
          {successMessage}
        </CAlert>
      )}

      {error && (
        <CAlert color="danger" dismissible onClose={() => setError('')}>
          {error}
        </CAlert>
      )}

      {/* Main Container Card */}
      <CCard className="mb-4 shadow-sm border-0">
        <CCardHeader className="bg-transparent border-bottom py-3">
          <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
            <div>
              <h4 className="mb-1 fw-semibold text-primary">Asignaturas</h4>
              <p className="text-body-secondary mb-0 small">
                Administración de cursos digitales. Selecciona una asignatura para ver detalles.
              </p>
            </div>
            <div>
              <CButton
                color="primary"
                className="d-flex align-items-center gap-2"
                onClick={() => setModalVisible(true)}
              >
                <CIcon icon={cilPlus} />
                <span>Nueva Asignatura</span>
              </CButton>
            </div>
          </div>
        </CCardHeader>

        <CCardBody>
          {/* Filter Controls Bar */}
          <div className="p-3 mb-4 rounded bg-body-tertiary border">
            <CRow className="g-3 align-items-center">
              {/* Search input */}
              <CCol xs={12} md={4}>
                <CInputGroup>
                  <CInputGroupText>
                    <CIcon icon={cilSearch} size="sm" />
                  </CInputGroupText>
                  <CFormInput
                    placeholder="Buscar por nombre..."
                    value={search}
                    onChange={handleSearchChange}
                  />
                </CInputGroup>
              </CCol>

              {/* Status filter */}
              <CCol xs={6} md={3}>
                <CFormSelect value={activoFilter} onChange={handleActivoChange}>
                  <option value="all">Todos los estados</option>
                  <option value="true">Solo activas</option>
                  <option value="false">Solo inactivas</option>
                </CFormSelect>
              </CCol>

              {/* Sorting options */}
              <CCol xs={6} md={3}>
                <CFormSelect value={sortOption} onChange={handleSortChange}>
                  <option value="nombre_asc">Nombre (A - Z)</option>
                  <option value="nombre_desc">Nombre (Z - A)</option>
                  <option value="acceso">Más recientes primero</option>
                  <option value="creado">Creados recientemente</option>
                </CFormSelect>
              </CCol>

              {/* Role & Refresh buttons */}
              <CCol xs={12} md={2} className="d-flex justify-content-md-end gap-2">
                <CButton
                  color="secondary"
                  variant="outline"
                  size="sm"
                  onClick={handleResetFilters}
                  title="Restablecer filtros"
                >
                  <CIcon icon={cilReload} />
                </CButton>
              </CCol>

              {/* Solo docente check */}
              <CCol xs={12}>
                <CFormCheck
                  id="soloDocenteCheck"
                  label="Mostrar solo asignaturas donde soy Docente"
                  checked={soloDocente}
                  onChange={handleSoloDocenteChange}
                />
              </CCol>
            </CRow>
          </div>

          {/* Table Content */}
          {loading ? (
            <div className="text-center py-5">
              <CSpinner color="primary" />
              <p className="mt-2 text-body-secondary small">Cargando asignaturas...</p>
            </div>
          ) : asignaturas.length === 0 ? (
            <div className="text-center py-5 border rounded bg-body-tertiary">
              <CIcon icon={cilBook} size="3xl" className="text-secondary mb-3 opacity-50" />
              <h5 className="fw-semibold">No se encontraron asignaturas</h5>
              <p className="text-body-secondary small mb-3">
                {search || soloDocente || activoFilter !== 'all'
                  ? 'Intenta ajustar o reiniciar los filtros aplicados.'
                  : 'Aún no perteneces a ninguna asignatura en esta organización.'}
              </p>
              <div className="d-flex justify-content-center gap-2">
                {search || soloDocente || activoFilter !== 'all' ? (
                  <CButton
                    color="secondary"
                    variant="outline"
                    size="sm"
                    onClick={handleResetFilters}
                    title="Restablecer filtros"
                  >
                    Limpiar filtros
                  </CButton>
                ) : (
                  <CButton color="primary" size="sm" onClick={() => setModalVisible(true)}>
                    <CIcon icon={cilPlus} className="me-1" />
                    Crear la primera
                  </CButton>
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="table-responsive">
                <CTable hover align="middle" className="border mb-0">
                  <CTableHead color="light">
                    <CTableRow>
                      <CTableHeaderCell scope="col">Nombre</CTableHeaderCell>
                      <CTableHeaderCell scope="col">Estado</CTableHeaderCell>
                      <CTableHeaderCell scope="col">Rol en Clase</CTableHeaderCell>
                      <CTableHeaderCell scope="col">Participantes</CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {asignaturas.map((asign) => {
                      const isTeacher =
                        Array.isArray(asign.docentes) &&
                        (asign.docentes.includes(authUser?.id) ||
                          asign.docentes.includes(authUser?._id))

                      const userCount = Array.isArray(asign.usuarios) ? asign.usuarios.length : 0

                      const createdDate = asign.createdAt
                        ? new Date(asign.createdAt).toLocaleDateString()
                        : '-'

                      return (
                        <CTableRow
                          key={asign._id}
                          style={{ cursor: 'pointer' }}
                          onClick={() => irAAsignatura(asign._id, asign.nombre)}
                        >
                          <CTableDataCell>
                            {/* Nombre */}
                            <div className="d-flex align-items-center gap-2">
                              <div className="p-2 rounded bg-primary-subtle text-primary">
                                <CIcon icon={cilBook} />
                              </div>
                              <div>
                                <span className="fw-semibold text-body">{asign.nombre}</span>
                                {asign.codigo && (
                                  <div className="small text-body-secondary">
                                    Cód: {asign.codigo}
                                  </div>
                                )}
                              </div>
                            </div>
                          </CTableDataCell>

                          <CTableDataCell>
                            {/* Activo o no */}
                            {asign.activo !== false ? (
                              <CBadge color="success" shape="rounded-pill">
                                Activo
                              </CBadge>
                            ) : (
                              <CBadge color="secondary" shape="rounded-pill">
                                Inactivo
                              </CBadge>
                            )}
                          </CTableDataCell>

                          <CTableDataCell>
                            {/* Docente o Alumno */}
                            {isTeacher ? (
                              <CBadge color="info" shape="rounded-pill">
                                Docente
                              </CBadge>
                            ) : (
                              <CBadge color="light" className="text-secondary border">
                                Alumno / Miembro
                              </CBadge>
                            )}
                          </CTableDataCell>

                          <CTableDataCell>
                            {/* Cantidad de participantes */}
                            <div className="d-flex align-items-center gap-1 text-body-secondary small">
                              <CIcon icon={cilPeople} size="sm" />
                              <span>{userCount} usuarios</span>
                            </div>
                          </CTableDataCell>
                        </CTableRow>
                      )
                    })}
                  </CTableBody>
                </CTable>
              </div>

              {/* Pagination and summary footer */}
              <div className="d-flex flex-column flex-sm-row justify-content-between align-items-center mt-3 gap-2">
                <span className="small text-body-secondary">
                  Mostrando {asignaturas.length} de {total} asignaturas
                </span>

                {totalPages > 1 && (
                  <CPagination align="end" aria-label="Navegación de asignaturas" className="mb-0">
                    <CPaginationItem
                      disabled={page <= 1}
                      onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                    >
                      Anterior
                    </CPaginationItem>

                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
                      <CPaginationItem
                        key={pageNum}
                        active={pageNum === page}
                        onClick={() => setPage(pageNum)}
                      >
                        {pageNum}
                      </CPaginationItem>
                    ))}

                    <CPaginationItem
                      disabled={page >= totalPages}
                      onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
                    >
                      Siguiente
                    </CPaginationItem>
                  </CPagination>
                )}
              </div>
            </>
          )}
        </CCardBody>
      </CCard>

      {/* New Asignatura Modal Instance */}
      <NewAsignModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSuccess={handleAsignaturaCreated}
      />
    </div>
  )
}

export default Asignaturas
