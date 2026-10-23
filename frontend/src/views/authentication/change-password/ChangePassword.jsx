import React, { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CCol,
  CContainer,
  CForm,
  CFormInput,
  CFormLabel,
  CRow,
  CSpinner,
} from '@coreui/react'
import { establecerContrasena } from 'src/services/authServices'

/**
 * Página del enlace de invitación (#/authentication/change-password?token=...): un usuario
 * creado por un administrador define aquí su contraseña. El enlace se usa una sola vez.
 */
const ChangePassword = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const [contrasena, setContrasena] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (contrasena.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (contrasena !== confirmacion) {
      setError('Las contraseñas no coinciden.')
      return
    }
    setGuardando(true)
    setError('')
    try {
      await establecerContrasena(token, contrasena)
      navigate('/authentication/password-changed', { replace: true })
    } catch (err) {
      setError(err.message)
      setGuardando(false)
    }
  }

  return (
    <div className="bg-body-tertiary min-vh-100 d-flex flex-row align-items-center">
      <CContainer>
        <CRow className="justify-content-center">
          <CCol md={6}>
            <CCard className="mx-4">
              <CCardBody className="p-4">
                {!token ? (
                  <>
                    <h1>Enlace incompleto</h1>
                    <p className="text-body-secondary">
                      Abre el enlace completo que recibiste por correo, o pide uno nuevo a tu
                      administrador.
                    </p>
                    <Link to="/authentication/login">Ir al inicio de sesión</Link>
                  </>
                ) : (
                  <CForm onSubmit={handleSubmit}>
                    <h1>Define tu contraseña</h1>
                    <p className="text-body-secondary">
                      Elige una contraseña de al menos 8 caracteres y confírmala.
                    </p>
                    {error && <CAlert color="danger">{error}</CAlert>}
                    <div className="mb-3">
                      <CFormLabel htmlFor="new-password">Nueva contraseña</CFormLabel>
                      <CFormInput
                        id="new-password"
                        type="password"
                        placeholder="Nueva contraseña"
                        autoComplete="new-password"
                        value={contrasena}
                        onChange={(event) => setContrasena(event.target.value)}
                        minLength={8}
                        required
                      />
                    </div>
                    <div className="mb-4">
                      <CFormLabel htmlFor="confirm-password">Confirmar contraseña</CFormLabel>
                      <CFormInput
                        id="confirm-password"
                        type="password"
                        placeholder="Reescribe tu contraseña"
                        autoComplete="new-password"
                        value={confirmacion}
                        onChange={(event) => setConfirmacion(event.target.value)}
                        required
                      />
                    </div>
                    <div className="d-grid">
                      <CButton color="primary" type="submit" disabled={guardando}>
                        {guardando && <CSpinner size="sm" className="me-2" />}
                        Guardar contraseña
                      </CButton>
                    </div>
                  </CForm>
                )}
              </CCardBody>
            </CCard>
          </CCol>
        </CRow>
      </CContainer>
    </div>
  )
}

export default ChangePassword
