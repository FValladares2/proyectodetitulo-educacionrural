import { useState, useEffect, useMemo } from 'react'
import {
  CCard,
  CCardBody,
  CCardHeader,
  CCardImage,
  CCol,
  CRow,
  CSpinner,
  CButton,
  CPagination,
  CPaginationItem,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { useNavigate } from 'react-router-dom'
import { cilBook, cilPlus } from '@coreui/icons'
import { fetchAsignaturas, getInitialOrgId } from 'src/services/asignServices'
import { getAuthToken, getAuthUser } from 'src/services/authServices'
import placeholderImage from 'src/assets/images/react.jpg'

const Dashboard = () => {
  const navigate = useNavigate()
  // Modal visibility state
  const [modalVisible, setModalVisible] = useState(false)

  // Data states
  const [asignaturas, setAsignaturas] = useState([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Organization state
  const [orgId, setOrgId] = useState(getInitialOrgId)

  // Filter & pagination states
  const search = ''
  const soloDocente = false
  const activoFilter = 'all' // 'all', 'true', 'false'
  const sortOption = 'reciente' // 'nombre_asc', 'nombre_desc', 'reciente'
  const [page, setPage] = useState(1)
  const limit = 12

  // Incrementing this key manually triggers a refetch (e.g. after creating an asignatura)
  const [refetchKey, setRefetchKey] = useState(0)

  // Current authenticated user
  const authUser = useMemo(() => getAuthUser(), [])

  // Resolve user organization if not found in storage
  useEffect(() => {
    let isMounted = true
    const resolveOrg = async () => {
      try {
        const token = getAuthToken()
        if (!token) return

        const response = await fetch(`${apiBase}/api/org/user`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })

        if (response.ok && isMounted) {
          const orgs = await response.json()
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

  return (
    <div className="mb-4">
      <CRow>
        <CCol xs={12}>
          <CCard className="mb-4 shadow-sm border-0">
            <CCardHeader className="bg-transparent border-bottom">
              <h4 className="mb-0 fw-semibold">Hogar</h4>
            </CCardHeader>
            <CCardBody>
              <p className="text-body-secondary mb-0">
                Bienvenido al panel principal del sistema de Educación Rural.
              </p>
            </CCardBody>
          </CCard>

          <CCard className="mb-4 shadow-sm border-0">
            <CCardHeader className="bg-transparent border-bottom">
              <h4 className="mb-0 fw-semibold">Asignaturas Recientes:</h4>
            </CCardHeader>
            <CCardBody>
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
                    Aún no perteneces a ninguna asignatura en esta organización.
                  </p>
                  <div className="d-flex justify-content-center gap-2">
                    <CButton color="primary" size="sm" onClick={() => navigate('/asignaturas')}>
                      <CIcon icon={cilPlus} className="me-1" />
                      Crear la primera
                    </CButton>
                  </div>
                </div>
              ) : (
                <CRow>
                  {asignaturas.map((asignatura) => (
                    <CCol key={asignatura._id} xs={6} md={4} lg={3} className="mb-4">
                      <CCard
                        style={{ cursor: 'pointer' }}
                        className="mb-4 shadow-sm border-0 h-100"
                        onClick={() => irAAsignatura(asignatura._id, asignatura.nombre)}
                      >
                        <CCardImage
                          orientation="top"
                          src={asignatura.img || placeholderImage}
                          className="p-2"
                        />
                        <CCardBody>
                          <p className="text-body-secondary mb-0">{asignatura.nombre}</p>
                        </CCardBody>
                      </CCard>
                    </CCol>
                  ))}
                </CRow>
              )}

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
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>
    </div>
  )
}

export default Dashboard
