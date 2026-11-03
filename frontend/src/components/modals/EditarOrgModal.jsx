import { useState } from 'react'
import PropTypes from 'prop-types'
import {
  CAlert,
  CButton,
  CForm,
  CFormInput,
  CFormLabel,
  CFormTextarea,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CSpinner,
} from '@coreui/react'
import { actualizarOrg } from 'src/services/orgServices'

// mismos límites que el backend (orgRoutes, CAMPOS_ORGANIZACION)
const CAMPOS = [
  { campo: 'nombre', etiqueta: 'Nombre', max: 120, obligatorio: true },
  { campo: 'descripcion', etiqueta: 'Descripción', max: 1000, multilinea: true },
  { campo: 'direccion', etiqueta: 'Dirección', max: 200 },
  {
    campo: 'informacion_contacto',
    etiqueta: 'Información de contacto',
    max: 300,
    ayuda: 'Por ejemplo, un teléfono o correo para comunicarse con la organización.',
  },
]

const valoresDe = (organizacion) =>
  Object.fromEntries(CAMPOS.map(({ campo }) => [campo, organizacion?.[campo] || '']))

/**
 * Edición de los datos visibles de una organización (solo administradores). Se monta al
 * abrirse, así el formulario empieza siempre con los datos actuales.
 */
const EditarOrgModal = ({ organizacion, onClose, onGuardada }) => {
  const [valores, setValores] = useState(() => valoresDe(organizacion))
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (event) => {
    event.preventDefault()
    setGuardando(true)
    setError('')
    try {
      onGuardada(await actualizarOrg(organizacion._id, valores))
      onClose()
    } catch (err) {
      setError(err.message)
      setGuardando(false)
    }
  }

  return (
    <CModal
      visible
      onClose={() => !guardando && onClose()}
      alignment="center"
      size="lg"
      fullscreen="sm"
    >
      <CForm onSubmit={handleSubmit}>
        <CModalHeader>
          <CModalTitle>Editar organización</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {error && <CAlert color="danger">{error}</CAlert>}
          {CAMPOS.map(({ campo, etiqueta, max, obligatorio, multilinea, ayuda }) => {
            const Control = multilinea ? CFormTextarea : CFormInput
            return (
              <div key={campo} className="mb-3">
                <CFormLabel htmlFor={`org-${campo}`}>{etiqueta}</CFormLabel>
                <Control
                  id={`org-${campo}`}
                  value={valores[campo]}
                  maxLength={max}
                  required={obligatorio}
                  rows={multilinea ? 4 : undefined}
                  text={ayuda}
                  onChange={(e) => setValores({ ...valores, [campo]: e.target.value })}
                />
              </div>
            )
          })}
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" variant="ghost" onClick={onClose} disabled={guardando}>
            Cancelar
          </CButton>
          <CButton type="submit" color="primary" disabled={guardando || !valores.nombre.trim()}>
            {guardando && <CSpinner size="sm" className="me-1" />}
            Guardar
          </CButton>
        </CModalFooter>
      </CForm>
    </CModal>
  )
}

EditarOrgModal.propTypes = {
  organizacion: PropTypes.shape({ _id: PropTypes.string.isRequired }).isRequired,
  onClose: PropTypes.func.isRequired,
  onGuardada: PropTypes.func.isRequired,
}

export default EditarOrgModal
