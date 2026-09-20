import React from 'react'
import { CCard, CCardBody, CCardHeader, CCol, CRow } from '@coreui/react'

const Configuracion = () => {
  return (
    <div className="mb-4">
      <CRow>
        <CCol xs={12}>
          <CCard className="mb-4 shadow-sm border-0">
            <CCardHeader className="bg-transparent border-bottom">
              <h4 className="mb-0 fw-semibold">Configuración</h4>
            </CCardHeader>
            <CCardBody>
              <p className="text-body-secondary mb-0">
                Ajustes del sistema, preferencias y configuración de la plataforma.
              </p>
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>
    </div>
  )
}

export default Configuracion
