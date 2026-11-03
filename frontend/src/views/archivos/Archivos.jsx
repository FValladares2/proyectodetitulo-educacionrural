import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { CAlert, CButton, CCard, CCardBody, CCardHeader, CSpinner } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilBook } from '@coreui/icons'
import ExploradorRecursos from 'src/components/recursos/ExploradorRecursos'
import { fetchAsignaturaById, fetchAsignaturasUsuario } from 'src/services/asignServices'
import { getInitialOrgId } from 'src/services/orgServices'

const Archivos = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const [asignaturas, setAsignaturas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [idNoEncontrado, setIdNoEncontrado] = useState(null)

  useEffect(() => {
    const controller = new AbortController()
    const orgId = getInitialOrgId()

    const cargar = async () => {
      if (!orgId) {
        setError('No tienes una organización seleccionada.')
        setLoading(false)
        return
      }
      try {
        const lista = await fetchAsignaturasUsuario(orgId, controller.signal, 100, {
          incluirInactivas: true,
        })
        setAsignaturas(lista)
        setError('')
      } catch (err) {
        if (err.name === 'AbortError') return
        setError(err.message || 'No se pudieron cargar las asignaturas.')
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    cargar()
    return () => controller.abort()
  }, [])

  // una asignatura enlazada por URL puede no estar en la lista (inactiva o fuera del límite)
  useEffect(() => {
    if (loading || !id || asignaturas.some((a) => String(a._id) === id)) return
    const controller = new AbortController()
    fetchAsignaturaById(id, controller.signal).then((asignatura) => {
      if (asignatura) {
        setAsignaturas((prev) => [...prev, asignatura])
      } else if (!controller.signal.aborted) {
        setIdNoEncontrado(id)
      }
    })
    return () => controller.abort()
  }, [id, loading, asignaturas])

  const handleAsignaturaChange = useCallback(
    (idAsignatura) => {
      navigate(idAsignatura ? `/archivos/${idAsignatura}` : '/archivos')
    },
    [navigate],
  )

  const asignaturaActual = asignaturas.find((a) => String(a._id) === id)

  return (
    // en pantallas pequeñas se recupera el padding lateral del contenedor de la página
    <div className="archivos-pagina mb-4">
      <CCard className="shadow-sm border-0">
        <CCardHeader className="bg-transparent border-bottom d-flex justify-content-between align-items-center gap-2 flex-wrap px-3">
          <div className="min-w-0">
            <h4 className="mb-0 fw-semibold">Archivos</h4>
            <small className="text-body-secondary text-break">
              {asignaturaActual
                ? asignaturaActual.nombre
                : 'Selecciona una asignatura para ver sus recursos.'}
            </small>
          </div>
          {asignaturaActual && (
            <CButton
              color="secondary"
              variant="outline"
              size="sm"
              onClick={() => navigate(`/asignaturas/${id}`)}
            >
              <CIcon icon={cilBook} className="me-1" />
              Ver asignatura
            </CButton>
          )}
        </CCardHeader>
        <CCardBody className="p-2 p-md-3">
          {error && <CAlert color="danger">{error}</CAlert>}
          {id && idNoEncontrado === id && (
            <CAlert color="warning">No se encontró la asignatura o no tienes acceso a ella.</CAlert>
          )}
          {loading ? (
            <div className="text-center py-5">
              <CSpinner color="primary" />
              <p className="mt-2 text-body-secondary small">Cargando asignaturas...</p>
            </div>
          ) : (
            !error && (
              <ExploradorRecursos
                asignaturas={asignaturas}
                asignaturaId={asignaturaActual ? id : null}
                onAsignaturaChange={handleAsignaturaChange}
              />
            )
          )}
        </CCardBody>
      </CCard>
    </div>
  )
}

export default Archivos
