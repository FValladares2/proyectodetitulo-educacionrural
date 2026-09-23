import React from 'react'
import { Link } from 'react-router-dom'
import { CButton, CCard, CCardBody, CCol, CContainer, CRow } from '@coreui/react'

const CheckEmail = () => {
  return (
    <div className="bg-body-tertiary min-vh-100 d-flex flex-row align-items-center">
      <CContainer>
        <CRow className="justify-content-center">
          <CCol md={6}>
            <CCard className="mx-4 text-center">
              <CCardBody className="p-4">
                <h1>Revisa tu correo</h1>
                <p className="text-body-secondary">
                  Se ha enviado un correo a <span className="fw-semibold">your@email.com</span>
                  para verificar tu cuenta. ¡Gracias!
                </p>
                <div className="d-grid">
                  <Link to="/">
                    <CButton color="primary" className="w-100">
                      Volver al inicio de sesión
                    </CButton>
                  </Link>
                </div>
                <p className="text-body-secondary mt-3 mb-0">
                  ¿No recibiste el correo? <Link to="/authentication/login">Reenviar</Link>
                </p>
              </CCardBody>
            </CCard>
          </CCol>
        </CRow>
      </CContainer>
    </div>
  )
}

export default CheckEmail
