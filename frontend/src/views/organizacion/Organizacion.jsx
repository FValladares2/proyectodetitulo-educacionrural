import React, { useEffect, useMemo, useState } from 'react'
import {
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCardFooter,
  CCol,
  CRow,
  CSpinner,
} from '@coreui/react'
import AddUserToOrgModal from 'src/components/modals/addUserToOrgModal'
import EditarOrgModal from 'src/components/modals/EditarOrgModal'
import CIcon from '@coreui/icons-react'
import { cilPencil } from '@coreui/icons'
import BannerRecurso from 'src/components/recursos/BannerRecurso'
import TablaIntegrantes from 'src/components/integrantes/TablaIntegrantes'
import { EVENTO_SESION_EXPIRADA } from 'src/services/apiClient'
import { getAuthUser } from 'src/services/authServices'
import {
  getInitialOrgId,
  getOrgById,
  getOrgsWithUser,
  getUserBatchBasicInfo,
  quitarUsuarioDeOrg,
  updateInitialOrgId,
  updateOrgImg,
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
  const [recargasUsuarios, setRecargasUsuarios] = useState(0)
  const [avisoQuitar, setAvisoQuitar] = useState('')
  const [editando, setEditando] = useState(false)
  const [allOrgs, setAllOrgs] = useState([])
  const authUser = useMemo(() => getAuthUser(), [])
  const esAdmin = Boolean(
    authUser && (currentOrg?.administradores || []).some((a) => String(a) === String(authUser._id)),
  )

  const handleCambiarImg = async (img) => {
    await updateOrgImg(currentOrgId, img)
    setCurrentOrg((actual) => ({ ...actual, img }))
  }

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
  }, [currentOrgId, showUserTable, recargasUsuarios])

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

  const admins = userData?.admins || []
  const integrantes = [
    ...admins.map((u) => ({ ...u, rol: 'admin' })),
    ...(userData?.teachers || []).map((u) => ({ ...u, rol: 'profesor' })),
    ...(userData?.users || []).map((u) => ({ ...u, rol: 'alumno' })),
  ].map((u) => ({ ...u, acceso: u.ultima_conexion ?? null }))

  // la organización nunca queda sin administradores (el backend también lo valida)
  const puedeQuitar = (integrante) => esAdmin && (integrante.rol !== 'admin' || admins.length > 1)

  const describirQuitar = (integrante) =>
    String(integrante._id) === String(authUser?._id)
      ? `Dejarás de pertenecer a ${currentOrg?.nombre || 'esta organización'} y a todas sus asignaturas. Si no perteneces a otra organización, tu cuenta se desactivará.`
      : `${integrante.nombre} dejará de pertenecer a la organización y a todas sus asignaturas. Si era el único docente de alguna, quedará a tu cargo. Si no pertenece a otra organización, su cuenta se desactivará hasta que alguna lo vuelva a agregar.`

  const handleQuitar = async (integrante) => {
    const resultado = await quitarUsuarioDeOrg(currentOrgId, integrante._id)
    if (String(integrante._id) === String(authUser?._id)) {
      // sin organizaciones la cuenta queda desactivada: se cierra la sesión
      if (resultado?.cuentaDesactivada) {
        window.dispatchEvent(new Event(EVENTO_SESION_EXPIRADA))
        return
      }
      const otras = (await getOrgsWithUser()) || []
      if (otras.length > 0 && (await updateInitialOrgId(otras[0]._id))) {
        setCurrentOrgId(otras[0]._id)
      }
      return
    }
    const avisos = [`${integrante.nombre} fue quitado de la organización.`]
    if (resultado?.asignaturasTransferidas?.length > 0) {
      avisos.push(`Ahora eres docente de: ${resultado.asignaturasTransferidas.join(', ')}.`)
    }
    if (resultado?.cuentaDesactivada) {
      avisos.push('Su cuenta quedó desactivada porque no pertenece a otra organización.')
    }
    setAvisoQuitar(avisos.join(' '))
    setRecargasUsuarios((n) => n + 1)
  }

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
              <BannerRecurso
                img={currentOrg?.img}
                puedeEditar={esAdmin}
                contenedor={currentOrg}
                ambito="organizacion"
                onCambiar={handleCambiarImg}
              />
              <CCardHeader className="bg-transparent border-bottom d-flex justify-content-between align-items-center gap-2">
                <h4 className="mb-0 fw-semibold text-break">
                  Tu organización actual: {currentOrg?.nombre || 'organizacion'}
                </h4>
                {esAdmin && currentOrg && (
                  <CButton
                    color="primary"
                    variant="outline"
                    size="sm"
                    className="flex-shrink-0"
                    onClick={() => setEditando(true)}
                  >
                    <CIcon icon={cilPencil} /> Editar
                  </CButton>
                )}
              </CCardHeader>
              <CCardBody>
                {currentOrg?.descripcion && (
                  <p className="mb-2" style={{ whiteSpace: 'pre-line' }}>
                    {currentOrg.descripcion}
                  </p>
                )}
                {currentOrg?.direccion && (
                  <p className="text-body-secondary mb-0">Dirección: {currentOrg.direccion}</p>
                )}
                {currentOrg?.informacion_contacto && (
                  <p className="text-body-secondary mb-0">
                    Contacto: {currentOrg.informacion_contacto}
                  </p>
                )}
                {!currentOrg?.descripcion &&
                  !currentOrg?.direccion &&
                  !currentOrg?.informacion_contacto && (
                    <p className="text-body-secondary mb-0">
                      {esAdmin
                        ? 'Aún no hay información de la organización. Usa Editar para agregar una descripción, dirección y contacto.'
                        : 'Aún no hay información de la organización.'}
                    </p>
                  )}
              </CCardBody>
              <CCardFooter>
                <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-0">
                  <p className="text-body-secondary mb-0">Usuarios en la organización:</p>
                  <div className="d-flex flex-wrap gap-2">
                    {esAdmin && (
                      <CButton color="primary" onClick={() => setShowAddUserModal(true)}>
                        Agregar usuarios
                      </CButton>
                    )}
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
                    <>
                      {avisoQuitar && (
                        <CAlert
                          color="info"
                          className="mt-2 mb-0"
                          dismissible
                          onClose={() => setAvisoQuitar('')}
                        >
                          {avisoQuitar}
                        </CAlert>
                      )}
                      <TablaIntegrantes
                        integrantes={integrantes}
                        idUsuarioActual={authUser?._id}
                        etiquetaAcceso={esAdmin ? 'Última conexión' : undefined}
                        puedeQuitar={puedeQuitar}
                        onQuitar={handleQuitar}
                        describirQuitar={describirQuitar}
                        textoVacio="No hay usuarios en esta organización."
                      />
                    </>
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
                          <BannerRecurso img={org.img} />
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

          {editando && currentOrg && (
            <EditarOrgModal
              organizacion={currentOrg}
              onClose={() => setEditando(false)}
              onGuardada={setCurrentOrg}
            />
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
