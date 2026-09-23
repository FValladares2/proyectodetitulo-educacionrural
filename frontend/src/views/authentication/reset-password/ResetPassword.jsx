import React from 'react'
import {
  CButton,
  CCard,
  CCardBody,
  CCol,
  CContainer,
  CForm,
  CFormInput,
  CFormLabel,
  CRow,
} from '@coreui/react'

const ResetPassword = () => {
  return (
    <div className="bg-body-tertiary min-vh-100 d-flex flex-row align-items-center">
      <CContainer>
        <CRow className="justify-content-center">
          <CCol md={6}>
            <CCard className="mx-4">
              <CCardBody className="p-4">
                <CForm>
                  <h1>Restablecer contraseña</h1>
                  <p className="text-body-secondary">
                    Ingresa tu correo y te enviaremos un email para restablecer tu contraseña.
                  </p>
                  <div className="mb-4">
                    <CFormLabel htmlFor="email">Correo</CFormLabel>
                    <CFormInput
                      id="email"
                      type="email"
                      placeholder="correo@institucion.com"
                      autoComplete="email"
                    />
                  </div>
                  <div className="d-grid">
                    <CButton color="primary" type="submit">
                      Restablecer contraseña
                    </CButton>
                  </div>
                </CForm>
              </CCardBody>
            </CCard>
          </CCol>
        </CRow>
      </CContainer>
    </div>
  )
}

export default ResetPassword
