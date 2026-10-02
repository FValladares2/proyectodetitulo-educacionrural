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
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
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
import { getAuthUser } from 'src/services/authServices'
import { getInitialOrgId, getOrgById, getUserBatchBasicInfo } from 'src/services/orgServices'
import asignServices, { fetchAsignaturaById } from 'src/services/asignServices'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const ROLE_OPTIONS = [
  { value: 'alumno', label: 'Alumno' },
  { value: 'profesor', label: 'Profesor' },
]

const getEmptyForm = () => ({ correo: '', rol: 'alumno' })

const AddUserToAsignModal = ({
  visible = false,
  onClose = () => {},
  asignaturaId = '',
  onSuccess = () => {},
}) => {
  const [form, setForm] = useState(getEmptyForm)
  const [pendingUsers, setPendingUsers] = useState([])
  const [asignatura, setAsignatura] = useState(null)
  const [organization, setOrganization] = useState(null)
  const [orgUsers, setOrgUsers] = useState([])
  const [loadingContext, setLoadingContext] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [formError, setFormError] = useState('')

  useEffect(() => {
    if (!visible || !asignaturaId) return undefined

    const controller = new AbortController()

    const loadContext = async () => {
      setLoadingContext(true)
      setErrorMessage('')
      try {
        const asigData = await fetchAsignaturaById(asignaturaId, controller.signal)
        if (!asigData) throw new Error('No se pudo obtener la información de la asignatura.')
        setAsignatura(asigData)

        const orgId = asigData.id_organizacion || getInitialOrgId() || getAuthUser()?.org_principal
        if (orgId) {
          const [orgData, usersData] = await Promise.all([
            getOrgById(orgId, controller.signal),
            getUserBatchBasicInfo(orgId, controller.signal),
          ])

          if (orgData) setOrganization(orgData)

          const allUsers = [
            ...(usersData?.admins || []),
            ...(usersData?.teachers || []),
            ...(usersData?.users || []),
          ]
          setOrgUsers(allUsers)
        }
      } catch (error) {
        if (error.name !== 'AbortError') {
          setErrorMessage(error.message || 'Error al cargar los datos de la asignatura.')
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoadingContext(false)
        }
      }
    }

    loadContext()
    return () => controller.abort()
  }, [visible, asignaturaId])

  const resetModal = () => {
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
    const correo = form.correo.trim().toLowerCase()

    if (!correo || !EMAIL_REGEX.test(correo)) {
      setFormError('Ingresa un correo electrónico válido.')
      return
    }

    // Validate that the user exists and belongs to the organization
    const foundUser = orgUsers.find((user) => user.correo?.trim().toLowerCase() === correo)
    if (!foundUser) {
      setFormError('El usuario no fue encontrado o no pertenece a esta organización.')
      return
    }

    // Validate not already in pending list
    if (
      pendingUsers.some(
        (user) =>
          user.correo?.toLowerCase() === correo || String(user._id) === String(foundUser._id),
      )
    ) {
      setFormError('Este usuario ya está en la lista de pendientes.')
      return
    }

    // Validate not already in asignatura
    const alreadyInAsign = (asignatura?.usuarios || []).some(
      (uid) => String(uid) === String(foundUser._id),
    )
    if (alreadyInAsign) {
      setFormError('Este usuario ya está asignado a esta asignatura.')
      return
    }

    setPendingUsers((current) => [
      ...current,
      {
        _id: foundUser._id,
        nombre: foundUser.nombre,
        correo: foundUser.correo,
        rol: form.rol,
      },
    ])
    setForm((current) => ({ ...current, correo: '' }))
    setFormError('')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!asignaturaId) {
      setErrorMessage('No se pudo identificar la asignatura.')
      return
    }
    if (pendingUsers.length === 0) {
      setErrorMessage('Agrega al menos un usuario antes de guardar.')
      return
    }

    setLoading(true)
    setErrorMessage('')
    try {
      await asignServices.addUsersToAsignBatch(asignaturaId, pendingUsers)
      onSuccess?.()
      handleClose()
    } catch (error) {
      setErrorMessage(error.message || 'Ocurrió un error al agregar los usuarios a la asignatura.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <CModal visible={visible} onClose={handleClose} alignment="center" backdrop="static" size="lg">
      <CModalHeader closeButton>
        <CModalTitle className="fw-semibold">Agregar integrantes a la asignatura</CModalTitle>
      </CModalHeader>
      <CForm onSubmit={handleSubmit} autoComplete="off" noValidate>
        <CModalBody>
          {errorMessage && <CAlert color="danger">{errorMessage}</CAlert>}

          <div className="mb-3 d-flex flex-wrap gap-4 text-body-secondary small border-bottom pb-2">
            <div>
              Asignatura:{' '}
              <span className="fw-semibold text-body">
                {loadingContext ? 'Cargando...' : asignatura?.nombre || 'No disponible'}
              </span>
            </div>
            <div>
              Organización:{' '}
              <span className="fw-semibold text-body">
                {loadingContext ? 'Cargando...' : organization?.nombre || 'No disponible'}
              </span>
            </div>
          </div>

          <div className="row g-3 align-items-end">
            <div className="col-md-6">
              <CFormLabel htmlFor="usuarioAsignCorreo">Correo del usuario existente</CFormLabel>
              <CFormInput
                id="usuarioAsignCorreo"
                name="correo"
                type="email"
                list="orgUsersDatalist"
                placeholder="ejemplo@correo.com"
                value={form.correo}
                onChange={handleFieldChange}
                disabled={loading || loadingContext}
                autoComplete="off"
              />
              <datalist id="orgUsersDatalist">
                {orgUsers.map((user) => (
                  <option key={user._id || user.correo} value={user.correo}>
                    {user.nombre} ({user.rol || 'usuario'})
                  </option>
                ))}
              </datalist>
            </div>
            <div className="col-md-4">
              <CFormLabel htmlFor="usuarioAsignRol">Rol en la asignatura</CFormLabel>
              <CFormSelect
                id="usuarioAsignRol"
                name="rol"
                value={form.rol}
                onChange={handleFieldChange}
                disabled={loading || loadingContext}
              >
                {ROLE_OPTIONS.map((role) => (
                  <option value={role.value} key={role.value}>
                    {role.label}
                  </option>
                ))}
              </CFormSelect>
            </div>
            <div className="col-md-2">
              <CButton
                type="button"
                color="secondary"
                variant="outline"
                className="w-100"
                onClick={handleAddUser}
                disabled={loading || loadingContext}
              >
                Agregar
              </CButton>
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
                  <CTableHeaderCell aria-label="Acciones" />
                </CTableRow>
              </CTableHead>
              <CTableBody>
                {pendingUsers.map((user, index) => (
                  <CTableRow key={`${user._id || user.correo}-${index}`}>
                    <CTableDataCell>{user.nombre}</CTableDataCell>
                    <CTableDataCell>{user.correo}</CTableDataCell>
                    <CTableDataCell>
                      <CBadge color={user.rol === 'profesor' ? 'info' : 'secondary'}>
                        {ROLE_OPTIONS.find((role) => role.value === user.rol)?.label}
                      </CBadge>
                    </CTableDataCell>
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

AddUserToAsignModal.propTypes = {
  visible: PropTypes.bool,
  onClose: PropTypes.func,
  asignaturaId: PropTypes.string,
  onSuccess: PropTypes.func,
}

export default AddUserToAsignModal
