import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import {
  CAlert,
  CBadge,
  CButton,
  CForm,
  CFormInput,
  CFormLabel,
  CFormSelect,
  CInputGroup,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CNav,
  CNavItem,
  CNavLink,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilTrash } from '@coreui/icons'
import { getAuthToken, getAuthUser } from 'src/services/authServices'
import { getInitialOrgId } from 'src/services/orgServices'

const apiBase = import.meta.env.VITE_API_BASE_URL || ''
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Administrador' },
  { value: 'profesor', label: 'Profesor' },
  { value: 'alumno', label: 'Alumno' },
]

const getEmptyForm = () => ({ nombre: '', correo: '', contrasena: '', rol: 'alumno' })

const AddUserToOrgModal = ({ visible, onClose, onSuccess }) => {
  const [activeTab, setActiveTab] = useState('nuevo')
  const [form, setForm] = useState(getEmptyForm)
  const [pendingUsers, setPendingUsers] = useState([])
  const [organization, setOrganization] = useState(null)
  const [loadingOrganization, setLoadingOrganization] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [formError, setFormError] = useState('')

  const organizationId = getInitialOrgId() || getAuthUser()?.org_principal || ''

  useEffect(() => {
    if (!visible || !organizationId) return undefined

    const controller = new AbortController()
    const fetchOrganization = async () => {
      setLoadingOrganization(true)
      try {
        const response = await fetch(`${apiBase}/api/org/${organizationId}`, {
          headers: { Authorization: `Bearer ${getAuthToken()}` },
          signal: controller.signal,
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.message || 'No se pudo obtener la organización.')
        setOrganization(data)
      } catch (error) {
        if (error.name !== 'AbortError') setErrorMessage(error.message)
      } finally {
        if (!controller.signal.aborted) setLoadingOrganization(false)
      }
    }

    fetchOrganization()
    return () => controller.abort()
  }, [visible, organizationId])

  const resetModal = () => {
    setActiveTab('nuevo')
    setForm(getEmptyForm())
    setPendingUsers([])
    setErrorMessage('')
    setFormError('')
  }

  const handleClose = () => {
    resetModal()
    onClose()
  }

  const handleFieldChange = (event) => {
    const { name, value } = event.target
    setForm((current) => ({ ...current, [name]: value }))
    setFormError('')
  }

  const handleAddUser = () => {
    const nombre = form.nombre.trim()
    const correo = form.correo.trim().toLowerCase()
    const isNewUser = activeTab === 'nuevo'

    if (isNewUser && !nombre) {
      setFormError('Ingresa el nombre del nuevo usuario.')
      return
    }
    if (!EMAIL_REGEX.test(correo)) {
      setFormError('Ingresa un correo electrónico válido.')
      return
    }
    if (isNewUser && form.contrasena.length < 8) {
      setFormError('La contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (pendingUsers.some((user) => user.correo === correo)) {
      setFormError('Este correo ya está en la lista.')
      return
    }

    setPendingUsers((current) => [
      ...current,
      {
        nombre: nombre || 'Usuario existente',
        correo,
        contrasena: isNewUser ? form.contrasena : undefined,
        rol: form.rol,
        esNuevo: isNewUser,
      },
    ])
    setForm(getEmptyForm())
    setFormError('')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!organizationId) {
      setErrorMessage('No se pudo determinar la organización activa.')
      return
    }
    if (pendingUsers.length === 0) {
      setErrorMessage('Agrega al menos un usuario antes de guardar.')
      return
    }

    setLoading(true)
    setErrorMessage('')
    try {
      const response = await fetch(`${apiBase}/api/org/users/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify({
          id_organizacion: organizationId,
          usuarios: pendingUsers,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message || 'No se pudieron agregar los usuarios.')

      onSuccess?.(data)
      handleClose()
    } catch (error) {
      setErrorMessage(error.message || 'Ocurrió un error al agregar los usuarios.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <CModal visible={visible} onClose={handleClose} alignment="center" backdrop="static" size="lg">
      <CModalHeader closeButton>
        <CModalTitle className="fw-semibold">Agregar usuarios a la organización</CModalTitle>
      </CModalHeader>
      <CForm onSubmit={handleSubmit}>
        <CModalBody>
          {errorMessage && <CAlert color="danger">{errorMessage}</CAlert>}
          <div className="mb-3 text-body-secondary">
            Organización activa:{' '}
            <span className="fw-semibold text-body">
              {loadingOrganization ? 'Cargando...' : organization?.nombre || 'No disponible'}
            </span>
          </div>

          <CNav variant="tabs" role="tablist" className="mb-3">
            <CNavItem>
              <CNavLink active={activeTab === 'nuevo'} onClick={() => setActiveTab('nuevo')}>
                Crear usuario
              </CNavLink>
            </CNavItem>
            <CNavItem>
              <CNavLink
                active={activeTab === 'existente'}
                onClick={() => setActiveTab('existente')}
              >
                Usuario existente
              </CNavLink>
            </CNavItem>
          </CNav>

          <div className="row g-3 align-items-end">
            {activeTab === 'nuevo' && (
              <div className="col-md-4">
                <CFormLabel htmlFor="nuevoUsuarioNombre">Nombre</CFormLabel>
                <CFormInput
                  id="nuevoUsuarioNombre"
                  name="nombre"
                  value={form.nombre}
                  onChange={handleFieldChange}
                  disabled={loading}
                />
              </div>
            )}
            <div className={activeTab === 'nuevo' ? 'col-md-4' : 'col-md-6'}>
              <CFormLabel htmlFor="usuarioCorreo">Correo electrónico</CFormLabel>
              <CFormInput
                id="usuarioCorreo"
                name="correo"
                type="email"
                value={form.correo}
                onChange={handleFieldChange}
                disabled={loading}
                required
              />
            </div>
            {activeTab === 'nuevo' && (
              <div className="col-md-4">
                <CFormLabel htmlFor="usuarioContrasena">Contraseña</CFormLabel>
                <CFormInput
                  id="usuarioContrasena"
                  name="contrasena"
                  type="password"
                  value={form.contrasena}
                  onChange={handleFieldChange}
                  disabled={loading}
                  minLength={8}
                />
              </div>
            )}
            <div className="col-md-6">
              <CFormLabel htmlFor="usuarioRol">Rol</CFormLabel>
              <CFormSelect
                id="usuarioRol"
                name="rol"
                value={form.rol}
                onChange={handleFieldChange}
                disabled={loading}
              >
                {ROLE_OPTIONS.map((role) => (
                  <option value={role.value} key={role.value}>
                    {role.label}
                  </option>
                ))}
              </CFormSelect>
            </div>
            <div className="col-md-6">
              <CInputGroup>
                <CButton
                  type="button"
                  color="secondary"
                  variant="outline"
                  onClick={handleAddUser}
                  disabled={loading}
                >
                  Agregar a la lista
                </CButton>
              </CInputGroup>
            </div>
          </div>
          {formError && <div className="text-danger small mt-2">{formError}</div>}

          <div className="d-flex justify-content-between align-items-center mt-4 mb-2">
            <h6 className="mb-0">Usuarios pendientes</h6>
            <CBadge color={pendingUsers.length ? 'primary' : 'secondary'}>
              {pendingUsers.length}
            </CBadge>
          </div>
          {pendingUsers.length === 0 ? (
            <p className="text-body-secondary small mb-0">
              Los usuarios que agregues aparecerán aquí.
            </p>
          ) : (
            <CTable hover responsive align="middle" className="border mb-0">
              <CTableHead>
                <CTableRow>
                  <CTableHeaderCell>Nombre</CTableHeaderCell>
                  <CTableHeaderCell>Correo</CTableHeaderCell>
                  <CTableHeaderCell>Rol</CTableHeaderCell>
                  <CTableHeaderCell>Tipo</CTableHeaderCell>
                  <CTableHeaderCell aria-label="Acciones" />
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {pendingUsers.map((user, index) => (
                  <CTableRow key={`${user.correo}-${index}`}>
                    <CTableDataCell>{user.nombre}</CTableDataCell>
                    <CTableDataCell>{user.correo}</CTableDataCell>
                    <CTableDataCell>
                      {ROLE_OPTIONS.find((role) => role.value === user.rol)?.label}
                    </CTableDataCell>
                    <CTableDataCell>{user.esNuevo ? 'Nuevo' : 'Existente'}</CTableDataCell>
                    <CTableDataCell className="text-end">
                      <CButton
                        type="button"
                        color="danger"
                        variant="ghost"
                        size="sm"
                        aria-label={`Eliminar ${user.correo}`}
                        onClick={() =>
                          setPendingUsers((current) =>
                            current.filter((_, itemIndex) => itemIndex !== index),
                          )
                        }
                        disabled={loading}
                      >
                        <CIcon icon={cilTrash} />
                      </CButton>
                    </CTableDataCell>
                  </CTableRow>
                ))}
              </CTableBody>
            </CTable>
          )}
        </CModalBody>
        <CModalFooter>
          <CButton
            type="button"
            color="secondary"
            variant="ghost"
            onClick={handleClose}
            disabled={loading}
          >
            Cancelar
          </CButton>
          <CButton type="submit" color="primary" disabled={loading || pendingUsers.length === 0}>
            {loading ? (
              <>
                <CSpinner size="sm" className="me-2" />
                Guardando...
              </>
            ) : (
              'Guardar usuarios'
            )}
          </CButton>
        </CModalFooter>
      </CForm>
    </CModal>
  )
}

AddUserToOrgModal.propTypes = {
  visible: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSuccess: PropTypes.func,
}

export default AddUserToOrgModal
