import React, { useEffect, useState } from 'react'
import {
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCardImage,
  CCardFooter,
  CCol,
  CRow,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
  CSpinner,
} from '@coreui/react'
import placeholderImage from 'src/assets/images/react.jpg'
import AddUserToOrgModal from 'src/components/modals/addUserToOrgModal'
import {
  getInitialOrgId,
  getOrgById,
  getUserBatchBasicInfo,
  getOrgsWithUser,
  updateInitialOrgId,
} from '../../services/orgServices.js'

const Organizacion = () => {
  const [loadingOrg, setLoadingOrg] = useState(false)
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [loadingOrgs, setLoadingOrgs] = useState(false)
  const [showUserTable, setShowUserTable] = useState(false)
  const [showAddUserModal, setShowAddUserModal] = useState(false)
  const [currentOrgId, setCurrentOrgId] = useState(getInitialOrgId)
  const [currentOrg, setCurrentOrg] = useState(null)
  const [userData, setUserData] = useState(null)
  const [allOrgs, setAllOrgs] = useState([])

  useEffect(() => {
    const controller = new AbortController()
    const obtenerOrganizacion = async () => {
      setLoadingOrg(true)
      const currentOrg = await getOrgById(currentOrgId, controller.signal)
      setCurrentOrg(currentOrg)
      setLoadingOrg(false)
    }
    obtenerOrganizacion()
    return () => controller.abort()
  }, [currentOrgId])

  useEffect(() => {
    const controller = new AbortController()
    const obtenerUsuarios = async () => {
      setLoadingUsers(true)
      const userData = await getUserBatchBasicInfo(currentOrgId, controller.signal)
      setUserData(userData)
      setLoadingUsers(false)
    }
    obtenerUsuarios()
    return () => controller.abort()
  }, [currentOrgId, showUserTable])

  useEffect(() => {
    const controller = new AbortController()
    const obtenerOrgs = async () => {
      setLoadingOrgs(true)
      // no incluye organización actual
      const orgs = await getOrgsWithUser(controller.signal)
      setAllOrgs((orgs || []).filter((org) => org._id !== currentOrgId))
      setLoadingOrgs(false)
    }
    obtenerOrgs()
    return () => controller.abort()
  }, [currentOrgId])

  const handleShowUserTable = () => {
    setShowUserTable(!showUserTable)
  }

  const handleOrgClick = async (orgId) => {
    // actualiza organización del usuario actual
    const updatedOrg = await updateInitialOrgId(orgId)
    if (updatedOrg) {
      setCurrentOrgId(orgId)
    }
  }

  return (
    <div className="mb-4">
      <CRow>
        <CCol xs={12}>
          {loadingOrg ? (
            <div className="text-center py-5">
              <CSpinner color="primary" />
              <p className="mt-2 text-body-secondary small">Cargando organización...</p>
            </div>
          ) : (
            <CCard className="mb-4 shadow-sm border-0">
              <CCardImage
                orientation="top"
                src={currentOrg?.img || placeholderImage}
                style={{ height: '160px', objectFit: 'cover', objectPosition: 'center' }}
              />
              <CCardHeader className="bg-transparent border-bottom">
                <h4 className="mb-0 fw-semibold">
                  Tu organización actual: {currentOrg?.nombre || 'organizacion'}
                </h4>
              </CCardHeader>
              <CCardBody>
                <p className="text-body-secondary mb-0">
                  Descripción: {currentOrg?.descripcion || 'N/A'}
                </p>
                <p className="text-body-secondary mb-0">
                  Información de contacto: {currentOrg?.informacionContacto || 'N/A'}
                </p>
                <p className="text-body-secondary mb-0">
                  Dirección: {currentOrg?.direccion || 'N/A'}
                </p>
              </CCardBody>
              <CCardFooter>
                <div className="d-flex justify-content-between align-items-center mb-0">
                  <p className="text-body-secondary mb-0">Usuarios en la organización:</p>
                  <div className="d-flex gap-2">
                    <CButton color="primary" onClick={() => setShowAddUserModal(true)}>
                      Agregar usuarios
                    </CButton>
                    <CButton color="secondary" variant="outline" onClick={handleShowUserTable}>
                      {showUserTable ? 'Ocultar usuarios' : 'Mostrar usuarios'}
                    </CButton>
                  </div>
                </div>
                {showUserTable &&
                  (loadingUsers ? (
                    <div className="text-center py-5">
                      <CSpinner color="primary" />
                      <p className="mt-2 text-body-secondary small">Cargando usuarios...</p>
                    </div>
                  ) : (
                    <CTable hover align="middle" className="border mb-0 mt-2">
                      <CTableHead color="light">
                        <CTableRow>
                          <CTableHeaderCell scope="col">#</CTableHeaderCell>
                          <CTableHeaderCell scope="col">Nombre</CTableHeaderCell>
                          <CTableHeaderCell scope="col">Correo</CTableHeaderCell>
                          <CTableHeaderCell scope="col">Rol</CTableHeaderCell>
                        </CTableRow>
                      </CTableHead>
                      <CTableBody>
                        {userData?.admins.map((user, index) => (
                          <CTableRow key={user._id}>
                            <CTableDataCell>{index + 1}</CTableDataCell>
                            <CTableDataCell>{user.nombre}</CTableDataCell>
                            <CTableDataCell>{user.correo}</CTableDataCell>
                            <CTableDataCell>Administrador</CTableDataCell>
                          </CTableRow>
                        ))}
                        {userData?.teachers.map((user, index) => (
                          <CTableRow key={user._id}>
                            <CTableDataCell>{userData?.admins.length + index + 1}</CTableDataCell>
                            <CTableDataCell>{user.nombre}</CTableDataCell>
                            <CTableDataCell>{user.correo}</CTableDataCell>
                            <CTableDataCell>Profesor</CTableDataCell>
                          </CTableRow>
                        ))}
                        {userData?.users.map((user, index) => (
                          <CTableRow key={user._id}>
                            <CTableDataCell>
                              {userData?.admins.length + userData?.teachers.length + index + 1}
                            </CTableDataCell>
                            <CTableDataCell>{user.nombre}</CTableDataCell>
                            <CTableDataCell>{user.correo}</CTableDataCell>
                            <CTableDataCell>Alumno</CTableDataCell>
                          </CTableRow>
                        ))}
                      </CTableBody>
                    </CTable>
                  ))}
              </CCardFooter>
            </CCard>
          )}

          {loadingOrgs ? (
            <div className="text-center py-5">
              <CSpinner color="primary" />
              <p className="mt-2 text-body-secondary small">Cargando organizaciónes...</p>
            </div>
          ) : (
            <CCard className="mb-4 shadow-sm border-0">
              <CCardHeader className="bg-transparent border-bottom">
                <h4 className="mb-0 fw-semibold">Cambia a otra organización:</h4>
              </CCardHeader>
              <CCardBody>
                <CRow>
                  {allOrgs.length === 0 ? (
                    <p className="text-body-secondary mb-0">
                      No hay otras organizaciones disponibles.
                    </p>
                  ) : (
                    allOrgs.map((org) => (
                      <CCol xs={12} md={6} lg={4} key={org._id}>
                        <CCard
                          className="mb-4 shadow-sm border-0"
                          style={{ cursor: 'pointer' }}
                          onClick={() => handleOrgClick(org._id)}
                        >
                          <CCardImage
                            orientation="top"
                            src={org.img || placeholderImage}
                            style={{
                              height: '160px',
                              objectFit: 'cover',
                              objectPosition: 'center',
                            }}
                          />
                          <CCardBody className="bg-transparent border-bottom">
                            <h4 className="mb-0 fw-semibold">{org.nombre}</h4>
                          </CCardBody>
                        </CCard>
                      </CCol>
                    ))
                  )}
                </CRow>
              </CCardBody>
            </CCard>
          )}

          <AddUserToOrgModal
            visible={showAddUserModal}
            onClose={() => setShowAddUserModal(false)}
            onSuccess={() => setShowUserTable(true)}
          />
        </CCol>
      </CRow>
    </div>
  )
}

export default Organizacion
