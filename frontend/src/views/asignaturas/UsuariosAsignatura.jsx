import {
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CRow,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'
import PropTypes from 'prop-types'
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import AddUserToAsignModal from '../../components/modals/addUserToAsignModal'
import asignServices from '../../services/asignServices'

const UsuariosAsignatura = ({ asignaturaId: propAsignaturaId }) => {
  const { id } = useParams()
  const asignaturaId = propAsignaturaId || id

  const [loadingUsers, setLoadingUsers] = useState(false)
  const [userData, setUserData] = useState(null)
  const [showAddUserModal, setShowAddUserModal] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

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

  const admins = userData?.admins || []
  const teachers = userData?.teachers || []
  const users = userData?.users || []

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
              <CCardHeader className="d-flex justify-content-between align-items-center">
                <p className="text-body-secondary mb-0">Usuarios en la asignatura:</p>
                <div className="d-flex gap-2">
                  <CButton color="primary" onClick={() => setShowAddUserModal(true)}>
                    Agregar usuarios
                  </CButton>
                </div>
              </CCardHeader>
              <CCardBody>
                {loadingUsers ? (
                  <div className="text-center py-5">
                    <CSpinner color="primary" />
                    <p className="mt-2 text-body-secondary small">Cargando usuarios...</p>
                  </div>
                ) : (
                  <CTable hover responsive align="middle" className="border mb-0 mt-2">
                    <CTableHead color="light">
                      <CTableRow>
                        <CTableHeaderCell scope="col">#</CTableHeaderCell>
                        <CTableHeaderCell scope="col">Nombre</CTableHeaderCell>
                        <CTableHeaderCell scope="col">Correo</CTableHeaderCell>
                        <CTableHeaderCell scope="col">Rol</CTableHeaderCell>
                      </CTableRow>
                    </CTableHead>
                    <CTableBody>
                      {admins.map((user, index) => (
                        <CTableRow key={user._id || index}>
                          <CTableDataCell>{index + 1}</CTableDataCell>
                          <CTableDataCell>{user.nombre}</CTableDataCell>
                          <CTableDataCell>{user.correo}</CTableDataCell>
                          <CTableDataCell>Administrador</CTableDataCell>
                        </CTableRow>
                      ))}
                      {teachers.map((user, index) => (
                        <CTableRow key={user._id || index}>
                          <CTableDataCell>{admins.length + index + 1}</CTableDataCell>
                          <CTableDataCell>{user.nombre}</CTableDataCell>
                          <CTableDataCell>{user.correo}</CTableDataCell>
                          <CTableDataCell>Profesor</CTableDataCell>
                        </CTableRow>
                      ))}
                      {users.map((user, index) => (
                        <CTableRow key={user._id || index}>
                          <CTableDataCell>
                            {admins.length + teachers.length + index + 1}
                          </CTableDataCell>
                          <CTableDataCell>{user.nombre}</CTableDataCell>
                          <CTableDataCell>{user.correo}</CTableDataCell>
                          <CTableDataCell>Alumno</CTableDataCell>
                        </CTableRow>
                      ))}
                      {admins.length === 0 && teachers.length === 0 && users.length === 0 && (
                        <CTableRow>
                          <CTableDataCell
                            colSpan={4}
                            className="text-center py-4 text-body-secondary"
                          >
                            No hay usuarios asignados a esta asignatura.
                          </CTableDataCell>
                        </CTableRow>
                      )}
                    </CTableBody>
                  </CTable>
                )}
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
