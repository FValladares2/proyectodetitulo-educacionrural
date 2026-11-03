import React, { useState, useEffect, useCallback } from 'react'
import PropTypes from 'prop-types'
import {
  CAlert,
  CBadge,
  CButton,
  CCol,
  CForm,
  CFormInput,
  CFormLabel,
  CInputGroup,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CRow,
  CSpinner,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilEnvelopeClosed, cilPlus } from '@coreui/icons'
import { createAsignatura } from 'src/services/asignServices'
import { getAuthToken, getAuthUser } from 'src/services/authServices'
import { getOrgsWithUser } from 'src/services/orgServices'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const getInitialOrgId = () => {
  const storedOrg = localStorage.getItem('userOrg') || sessionStorage.getItem('userOrg')
  if (storedOrg && storedOrg !== 'undefined' && storedOrg !== 'null') {
    return storedOrg
  }
  const authUser = getAuthUser()
  return authUser?.org_principal || authUser?.id_organizacion || ''
}

const NewAsignModal = ({ visible, onClose, onSuccess }) => {
  const [nombre, setNombre] = useState('')
  const [emailInput, setEmailInput] = useState('')
  const [emails, setEmails] = useState([])
  const [emailError, setEmailError] = useState('')
  const [mainOrgId, setMainOrgId] = useState(getInitialOrgId)
  const [orgName, setOrgName] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const resetForm = useCallback(() => {
    setNombre('')
    setEmailInput('')
    setEmails([])
    setEmailError('')
    setErrorMessage('')
  }, [])

  const handleCloseModal = () => {
    resetForm()
    onClose()
  }

  // Verify and fetch updated organization details when modal opens
  useEffect(() => {
    let isMounted = true

    if (visible) {
      const fetchOrgDetails = async () => {
        try {
          if (!getAuthToken()) return

          const orgs = await getOrgsWithUser()
          if (orgs && isMounted) {
            if (Array.isArray(orgs) && orgs.length > 0) {
              const currentOrgId = getInitialOrgId()
              const matchedOrg = currentOrgId
                ? orgs.find((o) => String(o._id) === String(currentOrgId)) || orgs[0]
                : orgs[0]

              setMainOrgId(matchedOrg._id)
              setOrgName(matchedOrg.nombre || '')
              localStorage.setItem('userOrg', matchedOrg._id)
            }
          }
        } catch (err) {
          console.error('Error al resolver organización del usuario:', err)
        }
      }

      fetchOrgDetails()
    }

    return () => {
      isMounted = false
    }
  }, [visible])

  const handleAddEmail = () => {
    const trimmed = emailInput.trim().toLowerCase()
    if (!trimmed) return

    if (!EMAIL_REGEX.test(trimmed)) {
      setEmailError('Por favor ingresa un correo electrónico válido.')
      return
    }

    if (emails.includes(trimmed)) {
      setEmailError('Este correo ya ha sido agregado.')
      return
    }

    setEmails((prev) => [...prev, trimmed])
    setEmailInput('')
    setEmailError('')
  }

  const handleKeyDownEmail = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddEmail()
    }
  }

  const handleRemoveEmail = (indexToRemove) => {
    setEmails((prev) => prev.filter((_, idx) => idx !== indexToRemove))
  }

  const handleSubmit = async (e) => {
    if (e) e.preventDefault()
    setErrorMessage('')

    const trimmedNombre = nombre.trim()
    if (!trimmedNombre) {
      setErrorMessage('Debes ingresar el nombre de la asignatura.')
      return
    }

    const orgIdToUse = mainOrgId || getInitialOrgId()
    if (!orgIdToUse) {
      setErrorMessage(
        'No se pudo determinar tu organización principal. Asegúrate de pertenecer a una organización.',
      )
      return
    }

    // Automatically include any pending email typed in the input if valid
    let finalEmails = [...emails]
    const pendingEmail = emailInput.trim().toLowerCase()
    if (pendingEmail && EMAIL_REGEX.test(pendingEmail) && !finalEmails.includes(pendingEmail)) {
      finalEmails.push(pendingEmail)
    }

    setLoading(true)
    try {
      const data = await createAsignatura({
        nombre: trimmedNombre,
        id_organizacion: orgIdToUse,
        correos: finalEmails,
      })

      resetForm()
      if (onSuccess) {
        onSuccess(data)
      }
      onClose()
    } catch (err) {
      console.error('Error al crear asignatura:', err)
      setErrorMessage(err.message || 'Ocurrió un error al crear la asignatura.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <CModal
      visible={visible}
      onClose={handleCloseModal}
      alignment="center"
      backdrop="static"
      fullscreen="sm"
    >
      <CModalHeader closeButton>
        <CModalTitle className="fw-semibold">Nueva Asignatura</CModalTitle>
      </CModalHeader>

      <CModalBody>
        {errorMessage && (
          <CAlert color="danger" dismissible onClose={() => setErrorMessage('')}>
            {errorMessage}
          </CAlert>
        )}

        {orgName && (
          <div className="mb-3 text-body-secondary small">
            Organización: <span className="fw-semibold text-body">{orgName}</span>
          </div>
        )}

        {!mainOrgId && (
          <CAlert color="warning" className="small">
            No se detectó una organización activa. Verifica tus permisos de administrador.
          </CAlert>
        )}

        <CForm onSubmit={handleSubmit}>
          <div className="mb-3">
            <CFormLabel htmlFor="nombreAsignatura" className="fw-semibold">
              Nombre de la Asignatura <span className="text-danger">*</span>
            </CFormLabel>
            <CFormInput
              id="nombreAsignatura"
              type="text"
              placeholder="Ej: Matemáticas 5° Básico"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              disabled={loading}
              autoFocus
              required
            />
          </div>

          {/*<div className="mb-3">
            <div className="d-flex justify-content-between align-items-center mb-1">
              <CFormLabel htmlFor="correoInput" className="fw-semibold mb-0">
                Correos de Participantes
              </CFormLabel>
              <CBadge color={emails.length > 0 ? 'primary' : 'secondary'} shape="rounded-pill">
                {emails.length} {emails.length === 1 ? 'correo' : 'correos'}
              </CBadge>
            </div>
            <p className="text-body-secondary small mb-2">
              Ingresa de 0 a n correos de usuarios o alumnos para asociar a la asignatura.
            </p>

            <CInputGroup>
              <CFormInput
                id="correoInput"
                type="email"
                placeholder="alumno@ejemplo.com"
                value={emailInput}
                onChange={(e) => {
                  setEmailInput(e.target.value)
                  if (emailError) setEmailError('')
                }}
                onKeyDown={handleKeyDownEmail}
                disabled={loading}
                invalid={!!emailError}
              />
              <CButton
                type="button"
                color="secondary"
                variant="outline"
                onClick={handleAddEmail}
                disabled={loading || !emailInput.trim()}
              >
                <CIcon icon={cilPlus} className="me-1" />
                Agregar
              </CButton>
            </CInputGroup>
            {emailError && <div className="text-danger small mt-1">{emailError}</div>}
          </div>

          {emails.length > 0 && (
            <div className="mb-2">
              <div
                className="p-2 border rounded bg-body-tertiary"
                style={{ maxHeight: '160px', overflowY: 'auto' }}
              >
                <CRow className="g-2">
                  {emails.map((email, idx) => (
                    <CCol xs="auto" key={`${email}-${idx}`}>
                      <span className="badge bg-light text-dark border d-inline-flex align-items-center gap-1 py-1 px-2 fw-normal">
                        <CIcon icon={cilEnvelopeClosed} size="sm" className="text-secondary" />
                        <span>{email}</span>
                        <button
                          type="button"
                          className="btn-close ms-1"
                          style={{ fontSize: '0.65rem' }}
                          aria-label={`Eliminar ${email}`}
                          onClick={() => handleRemoveEmail(idx)}
                          disabled={loading}
                        />
                      </span>
                    </CCol>
                  ))}
                </CRow>
              </div>
            </div>
          )}*/}
        </CForm>
      </CModalBody>

      <CModalFooter>
        <CButton color="secondary" variant="ghost" onClick={handleCloseModal} disabled={loading}>
          Cancelar
        </CButton>
        <CButton
          color="primary"
          onClick={handleSubmit}
          disabled={loading || !nombre.trim() || !mainOrgId}
        >
          {loading ? (
            <>
              <CSpinner size="sm" className="me-2" />
              Creando...
            </>
          ) : (
            'Crear Asignatura'
          )}
        </CButton>
      </CModalFooter>
    </CModal>
  )
}

NewAsignModal.propTypes = {
  visible: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSuccess: PropTypes.func,
}

export default NewAsignModal
