import { CAlert, CButton, CCard, CCardBody, CCardHeader, CCol, CRow, CSpinner } from '@coreui/react'
import PropTypes from 'prop-types'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import AddUserToAsignModal from '../../components/modals/addUserToAsignModal'
import TablaIntegrantes from 'src/components/integrantes/TablaIntegrantes'
import asignServices from '../../services/asignServices'
import { getAuthUser } from 'src/services/authServices'

const UsuariosAsignatura = ({ asignaturaId: propAsignaturaId }) => {
  const { id } = useParams()
  const navigate = useNavigate()
  const authUser = useMemo(() => getAuthUser(), [])
  const asignaturaId = propAsignaturaId || id

  const [loadingUsers, setLoadingUsers] = useState(false)
  const [userData, setUserData] = useState(null)
  const [showAddUserModal, setShowAddUserModal] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [uniendose, setUniendose] = useState(false)
  const [errorUnirse, setErrorUnirse] = useState('')

  useEffect(() => {
    if (!asignaturaId) return undefined

    const controller = new AbortController()
    const obtenerUsuarios = async () => {
      setLoadingUsers(true)
      try {
        const data = await asignServices.getAsignUsers(asignaturaId, controller.signal)
        setUserData(data)
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('Error al cargar integrantes:', err)
        }
      } finally {
        setLoadingUsers(false)
      }
    }

    obtenerUsuarios()
    return () => controller.abort()
  }, [asignaturaId, refreshKey])

  const teachers = userData?.teachers || []
  const users = userData?.users || []
  const integrantes = [
    ...teachers.map((u) => ({ ...u, rol: 'profesor', acceso: u.ultimo_acceso ?? null })),
    ...users.map((u) => ({ ...u, rol: 'alumno', acceso: u.ultimo_acceso ?? null })),
  ]

  // la asignatura nunca queda sin docentes (el backend también lo valida)
  const puedeQuitar = (integrante) =>
    Boolean(userData?.puedeQuitar) && (integrante.rol !== 'profesor' || teachers.length > 1)

  // administrador de la organización que no participa: ve los integrantes, pero para ver el
  // contenido y las entregas debe unirse como docente (queda en la lista y en la actividad)
  const sinParticipar = Boolean(userData) && userData.esIntegrante === false

  const handleUnirse = async () => {
    setUniendose(true)
    setErrorUnirse('')
    try {
      await asignServices.addUsersToAsignBatch(asignaturaId, [
        { _id: authUser?._id, rol: 'profesor' },
      ])
      navigate(`/asignaturas/${asignaturaId}`, { state: { nombre: userData?.nombre } })
    } catch (err) {
      setErrorUnirse(err.message || 'No se pudo unir a la asignatura.')
      setUniendose(false)
    }
  }

  const handleQuitar = async (integrante) => {
    await asignServices.quitarUsuarioDeAsign(asignaturaId, integrante._id)
    if (String(integrante._id) === String(authUser?._id)) {
      navigate('/asignaturas')
      return
    }
    setRefreshKey((k) => k + 1)
  }

  return (
    <div className="mb-4">
      <CRow>
        <CCol xs={12}>
          {loadingUsers ? (
            <div className="text-center py-5">
              <CSpinner color="primary" />
              <p className="mt-2 text-body-secondary small">Cargando usuarios...</p>
            </div>
          ) : (
            <CCard className="mb-4 shadow-sm border-0">
              <CCardHeader className="d-flex flex-wrap justify-content-between align-items-center gap-2">
                <p className="text-body-secondary mb-0">Usuarios en la asignatura:</p>
                {/* docentes de la asignatura y administradores de la organización */}
                {userData?.puedeAgregar && (
                  <div className="d-flex flex-wrap gap-2">
                    <CButton
                      color="secondary"
                      variant="outline"
                      onClick={() =>
                        navigate(`/asignaturas/${asignaturaId}/configuracion`, {
                          state: { nombre: userData?.nombre },
                        })
                      }
                    >
                      Configuración
                    </CButton>
                    {!sinParticipar && (
                      <CButton color="primary" onClick={() => setShowAddUserModal(true)}>
                        Agregar usuarios
                      </CButton>
                    )}
                  </div>
                )}
              </CCardHeader>
              <CCardBody>
                {sinParticipar && (
                  <CAlert
                    color="info"
                    className="d-flex flex-column flex-sm-row gap-2 align-items-sm-center"
                  >
                    <span className="flex-grow-1">
                      No participas en esta asignatura. Como administrador puedes gestionar sus
                      integrantes; para ver su contenido y entregas, únete como docente.
                    </span>
                    <CButton color="primary" size="sm" onClick={handleUnirse} disabled={uniendose}>
                      {uniendose ? 'Uniéndote...' : 'Unirme como docente'}
                    </CButton>
                  </CAlert>
                )}
                {errorUnirse && <CAlert color="danger">{errorUnirse}</CAlert>}
                <TablaIntegrantes
                  integrantes={integrantes}
                  idUsuarioActual={authUser?._id}
                  etiquetaAcceso={userData?.puedeQuitar ? 'Último acceso' : undefined}
                  puedeQuitar={puedeQuitar}
                  onQuitar={handleQuitar}
                  describirQuitar={(integrante) =>
                    String(integrante._id) === String(authUser?._id)
                      ? 'Dejarás de pertenecer a esta asignatura y perderás acceso a su contenido. Tus entregas se conservan.'
                      : `${integrante.nombre} dejará de pertenecer a esta asignatura. Sus entregas y calificaciones se conservan, y puedes volver a agregarlo después.`
                  }
                  textoVacio="No hay usuarios asignados a esta asignatura."
                />
              </CCardBody>
            </CCard>
          )}

          <AddUserToAsignModal
            visible={showAddUserModal}
            onClose={() => setShowAddUserModal(false)}
            asignaturaId={asignaturaId}
            onSuccess={() => setRefreshKey((k) => k + 1)}
          />
        </CCol>
      </CRow>
    </div>
  )
}

UsuariosAsignatura.propTypes = {
  asignaturaId: PropTypes.string,
}

export default UsuariosAsignatura
