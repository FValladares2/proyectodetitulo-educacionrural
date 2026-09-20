import React from 'react'
import { CCard, CCardBody, CCardHeader, CCol, CRow } from '@coreui/react'

const Asignaturas = () => {
  return (
    <div className="mb-4">
      <CRow>
        <CCol xs={12}>
          <CCard className="mb-4 shadow-sm border-0">
            <CCardHeader className="bg-transparent border-bottom">
              <h4 className="mb-0 fw-semibold">Asignaturas</h4>
            </CCardHeader>
            <CCardBody>
              <p className="text-body-secondary mb-0">
                Administración de asignaturas, cursos y planes de estudio.
              </p>
            </CCardBody>
          </CCard>
        </CCol>
      </CRow>
    </div>
  )
}

export default Asignaturas
