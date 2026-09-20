import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
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
  CInputGroup,
  CInputGroupText,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CRow,
  CTooltip,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { eye } from 'src/assets/icons/eye'
import { registerUser } from 'src/services/authServices'

const Register = () => {
  const navigate = useNavigate()

  const [formData, setFormData] = useState({
    nombre: '',
    correo: '',
    contrasena: '',
    repetirContrasena: '',
    organizacion: '',
  })
  const [modalVisible, setModalVisible] = useState(false)
  const [modalMessage, setModalMessage] = useState('')
  const [isSuccess, setIsSuccess] = useState(false)

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleSubmit = (event) => {
    event.preventDefault()

    if (!formData.nombre || !formData.correo || !formData.contrasena) {
      setModalMessage('Por favor completa todos los campos obligatorios.')
      setIsSuccess(false)
      setModalVisible(true)
      return
    }

    if (formData.contrasena !== formData.repetirContrasena) {
      setModalMessage('Las contraseñas no coinciden. Por favor, verifica e intenta de nuevo.')
      setIsSuccess(false)
      setModalVisible(true)
      return
    }

    registerUser({
      nombre: formData.nombre,
      correo: formData.correo,
      contrasena: formData.contrasena,
      nombre_organizacion: formData.organizacion,
    })
      .then(() => {
        setIsSuccess(true)
        setModalMessage('Cuenta de Administrador creada exitosamente.')
        setModalVisible(true)
      })
      .catch((error) => {
        setIsSuccess(false)
        setModalMessage(error.message || 'Error al registrar el usuario.')
        setModalVisible(true)
      })
  }

  const handleModalClose = () => {
    setModalVisible(false)
    if (isSuccess) {
      navigate('/authentication/login')
    }
  }

  return (
    <div className="bg-body-tertiary min-vh-100 d-flex flex-row align-items-center py-5">
      <CContainer>
        <CRow className="justify-content-center">
          <CCol md={8} lg={6} xl={5}>
            <div className="d-flex flex-column gap-4">
              <CAlert
                className="text-center text-white border-0 py-3 px-4 mb-0"
                style={{
                  backgroundColor: '#ea7e7e',
                  borderRadius: 'var(--cui-border-radius, 12px)',
                  fontSize: '0.95rem',
                  lineHeight: '1.45',
                }}
              >
                IMPORTANTE: Profesores y Estudiantes NO NECESITAN CREAR CUENTAS: cada administrador
                debería crear y entregar sus cuentas directamente.
              </CAlert>

              <CCard className="p-4">
                <CCardBody className="d-flex flex-column gap-4">
                  <h2 className="h5 text-center mb-0">Crear una Cuenta de Administrador</h2>

                  <CForm className="row gy-3" onSubmit={handleSubmit}>
                    <CCol xs={12}>
                      <CFormLabel htmlFor="nombre">Nombre de Usuario</CFormLabel>
                      <CFormInput
                        id="nombre"
                        name="nombre"
                        type="text"
                        value={formData.nombre}
                        onChange={handleChange}
                        placeholder="Nombre Apellido"
                        autoComplete="name"
                        required
                      />
                    </CCol>

                    <CCol xs={12}>
                      <CFormLabel htmlFor="correo">Correo</CFormLabel>
                      <CFormInput
                        id="correo"
                        name="correo"
                        type="email"
                        value={formData.correo}
                        onChange={handleChange}
                        placeholder="correo@institucion.com"
                        autoComplete="email"
                        required
                      />
                    </CCol>

                    <CCol xs={12}>
                      <CFormLabel htmlFor="contrasena">Contraseña</CFormLabel>
                      <CFormInput
                        id="contrasena"
                        name="contrasena"
                        type="password"
                        value={formData.contrasena}
                        onChange={handleChange}
                        placeholder="Contraseña"
                        autoComplete="new-password"
                        required
                      />
                    </CCol>

                    <CCol xs={12}>
                      <CFormInput
                        id="repetirContrasena"
                        name="repetirContrasena"
                        type="password"
                        value={formData.repetirContrasena}
                        onChange={handleChange}
                        placeholder="Repetir contraseña"
                        autoComplete="new-password"
                        required
                      />
                    </CCol>

                    <CCol xs={12}>
                      <CFormLabel htmlFor="organizacion">Organización</CFormLabel>
                      <CFormInput
                        id="organizacion"
                        name="organizacion"
                        type="text"
                        value={formData.organizacion}
                        onChange={handleChange}
                        placeholder="Nombre de nueva organización"
                        required
                      />
                    </CCol>

                    <CCol xs={12}>
                      <CButton color="primary" type="submit" className="w-100">
                        Crear Cuenta
                      </CButton>
                    </CCol>
                  </CForm>
                </CCardBody>
              </CCard>

              <div className="text-center text-body-secondary">
                ¿Ya tienes una cuenta? <Link to="/authentication/login">Inicia sesión</Link>
              </div>
            </div>
          </CCol>
        </CRow>
      </CContainer>

      <CModal
        visible={modalVisible}
        onClose={handleModalClose}
        aria-labelledby="ModalRegisterTitle"
        alignment="center"
      >
        <CModalHeader>
          <CModalTitle id="ModalRegisterTitle">
            {isSuccess ? 'Cuenta creada con éxito' : 'Error al registrar'}
          </CModalTitle>
        </CModalHeader>
        <CModalBody>{modalMessage}</CModalBody>
        <CModalFooter>
          <CButton color={isSuccess ? 'primary' : 'secondary'} onClick={handleModalClose}>
            {isSuccess ? 'Iniciar sesión' : 'Volver'}
          </CButton>
        </CModalFooter>
      </CModal>
    </div>
  )
}

export default Register
