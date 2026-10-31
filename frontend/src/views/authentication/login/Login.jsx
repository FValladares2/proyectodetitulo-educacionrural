import React, { useCallback } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CCol,
  CContainer,
  CForm,
  CFormCheck,
  CFormInput,
  CFormLabel,
  CInputGroup,
  CInputGroupText,
  CRow,
  CTooltip,
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { logo } from 'src/assets/brand/logo'
import { eye } from 'src/assets/icons/eye'
import { loginUser } from 'src/services/authServices'
import { asignarCacheOffline } from 'src/services/offlineCache'

const Login = () => {
  const [showPassword, setShowPassword] = React.useState(false)
  const [visibleModal, setVisibleModal] = React.useState(false)
  const [errorLogin, setErrorLogin] = React.useState(null)
  const [staySignedIn, setStaySignedIn] = React.useState(false)
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const navigate = useNavigate()
  const sesionExpirada = Boolean(useLocation().state?.sesionExpirada)

  const handleSubmit = (event) => {
    event.preventDefault()
    loginUser({
      correo: email,
      contrasena: password,
    })
      .then((data) => {
        console.log('Login successful:', data)
        finishLogin(data)
      })
      .catch((error) => {
        console.error('Login failed:', error)
        // la contraseña solo se puede verificar en el servidor: sin conexión no hay forma de
        // entrar, y no se guarda nada en el equipo que permita hacerlo
        setErrorLogin(
          error.sinConexion
            ? {
                titulo: 'Sin conexión con el servidor',
                mensaje: `${error.message} Para iniciar sesión se necesita conexión; si ya tenías la sesión abierta en este equipo, lo que abriste sigue disponible sin conexión.`,
              }
            : error.status === 400 || error.status === 401
              ? {
                  titulo: 'Error al iniciar sesión',
                  mensaje: 'Datos de usuario incorrectos. Por favor, intenta de nuevo.',
                }
              : { titulo: 'Error al iniciar sesión', mensaje: error.message },
        )
        setVisibleModal(true)
      })
  }

  const finishLogin = useCallback(
    async (result) => {
      await asignarCacheOffline(result.user._id)
      if (staySignedIn) {
        localStorage.setItem('authToken', result.token)
        localStorage.setItem('authUser', JSON.stringify(result.user))
        localStorage.setItem('userId', result.user._id)
        localStorage.setItem('userOrg', result.user.org_principal)
      } else {
        sessionStorage.setItem('authToken', result.token)
        sessionStorage.setItem('authUser', JSON.stringify(result.user))
        sessionStorage.setItem('userId', result.user._id)
        sessionStorage.setItem('userOrg', result.user.org_principal)
      }
      navigate('/dashboard')
    },
    [navigate, staySignedIn],
  )

  return (
    <div className="bg-body-tertiary min-vh-100 d-flex flex-row align-items-center">
      <CContainer>
        <CRow className="justify-content-center">
          <CCol md={8} lg={6} xl={5}>
            <div className="d-flex flex-column gap-4">
              <div className="text-center">
                <CIcon icon={logo} height={48} />
              </div>
              <CCard className="p-4">
                <CCardBody className="d-flex flex-column gap-4">
                  <h2 className="h5 text-center mb-0">Inicia sesión con tus datos</h2>
                  {sesionExpirada && (
                    <CAlert color="info" className="mb-0">
                      Tu sesión expiró. Inicia sesión de nuevo para continuar.
                    </CAlert>
                  )}
                  <CForm className="row gy-3">
                    <CCol xs={12}>
                      <CFormLabel htmlFor="email">Correo o Nombre de Usuario</CFormLabel>
                      <CFormInput
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="correo@institucion.com"
                        autoComplete="email"
                      />
                    </CCol>
                    <CCol xs={12}>
                      <div className="d-flex justify-content-between">
                        <CFormLabel htmlFor="password">Contraseña</CFormLabel>
                        <Link to="/authentication/reset-password">No tengo mi contraseña</Link>
                      </div>
                      <CInputGroup>
                        <CFormInput
                          id="password"
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="contraseña"
                          autoComplete="current-password"
                        />
                        <CInputGroupText>
                          <CTooltip content="Ver contraseña">
                            <CButton
                              type="button"
                              color="link"
                              className="p-0 link-secondary"
                              aria-label="Ver contraseña"
                              onClick={() => setShowPassword(!showPassword)}
                            >
                              <CIcon icon={eye} size="sm" />
                            </CButton>
                          </CTooltip>
                        </CInputGroupText>
                      </CInputGroup>
                    </CCol>
                    <CCol xs={12}>
                      <CFormCheck
                        id="staySignedIn"
                        label="Mantener sesión abierta"
                        checked={staySignedIn}
                        onChange={(e) => setStaySignedIn(e.target.checked)}
                      />
                    </CCol>
                    <CCol xs={12}>
                      <CButton
                        color="primary"
                        type="button"
                        className="w-100"
                        onClick={handleSubmit}
                      >
                        Entrar
                      </CButton>
                    </CCol>
                  </CForm>
                </CCardBody>
              </CCard>
              <div className="text-center text-body-secondary">
                Sin cuenta? <Link to="/authentication/register">Crea una cuenta</Link>
              </div>
            </div>
          </CCol>
        </CRow>
        <CModal
          visible={visibleModal}
          onClose={() => setVisibleModal(false)}
          aria-labelledby="ModalErrorLogin"
        >
          <CModalHeader>
            <CModalTitle id="ModalErrorLogin">
              {errorLogin?.titulo || 'Error al iniciar sesión'}
            </CModalTitle>
          </CModalHeader>
          <CModalBody>{errorLogin?.mensaje}</CModalBody>
          <CModalFooter>
            <CButton color="secondary" onClick={() => setVisibleModal(false)}>
              Volver
            </CButton>
          </CModalFooter>
        </CModal>
      </CContainer>
    </div>
  )
}

export default Login
