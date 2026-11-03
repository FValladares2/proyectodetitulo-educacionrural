import {
  CAlert,
  CButton,
  CCol,
  CForm,
  CFormInput,
  CFormLabel,
  CFormTextarea,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CRow,
  CSpinner,
} from '@coreui/react'
import PropTypes from 'prop-types'
import { useState } from 'react'
import { actualizarTarea, crearTarea } from 'src/services/tareaServices'
import { aInputLocal, desdeInputLocal } from './tareaFechas'

// por defecto abre ahora y cierra en una semana a las 23:59
const formularioInicial = (tarea) => {
  if (tarea) {
    return {
      titulo: tarea.titulo,
      descripcion: tarea.descripcion || '',
      apertura: aInputLocal(tarea.apertura),
      limite: aInputLocal(tarea.limite),
    }
  }
  const limite = new Date()
  limite.setDate(limite.getDate() + 7)
  limite.setHours(23, 59, 0, 0)
  return {
    titulo: '',
    descripcion: '',
    apertura: aInputLocal(new Date()),
    limite: aInputLocal(limite),
  }
}

/**
 * Formulario para crear una tarea (sin `tarea`) o editarla. La tarea se guarda en el servidor
 * al confirmar, y `onGuardada` recibe la tarea resultante.
 */
const TareaFormModal = ({ visible, onClose, idAsignatura, tarea = null, onGuardada }) => {
  const [form, setForm] = useState(() => formularioInicial(tarea))
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  // el formulario se reinicia cada vez que se abre
  const [visiblePrevio, setVisiblePrevio] = useState(visible)
  if (visible !== visiblePrevio) {
    setVisiblePrevio(visible)
    if (visible) {
      setForm(formularioInicial(tarea))
      setError('')
    }
  }

  const cambiar = (campo) => (event) => setForm((f) => ({ ...f, [campo]: event.target.value }))

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!form.titulo.trim()) {
      setError('El título es obligatorio.')
      return
    }
    if (!form.apertura || !form.limite || new Date(form.apertura) >= new Date(form.limite)) {
      setError('La apertura debe ser anterior al límite de entrega.')
      return
    }

    const datos = {
      titulo: form.titulo.trim(),
      descripcion: form.descripcion,
      apertura: desdeInputLocal(form.apertura),
      limite: desdeInputLocal(form.limite),
    }
    setGuardando(true)
    setError('')
    try {
      const guardada = tarea
        ? await actualizarTarea(tarea._id, datos)
        : await crearTarea({ id_asignatura: idAsignatura, ...datos })
      onGuardada(guardada)
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <CModal
      visible={visible}
      onClose={onClose}
      alignment="center"
      size="lg"
      backdrop="static"
      fullscreen="sm"
    >
      <CForm onSubmit={handleSubmit}>
        <CModalHeader>
          <CModalTitle>{tarea ? 'Editar tarea' : 'Nueva tarea'}</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {error && <CAlert color="danger">{error}</CAlert>}
          <div className="mb-3">
            <CFormLabel htmlFor="tarea-titulo">Título</CFormLabel>
            <CFormInput
              id="tarea-titulo"
              value={form.titulo}
              onChange={cambiar('titulo')}
              maxLength={200}
              required
            />
          </div>
          <div className="mb-3">
            <CFormLabel htmlFor="tarea-descripcion">Instrucciones</CFormLabel>
            <CFormTextarea
              id="tarea-descripcion"
              rows={5}
              value={form.descripcion}
              onChange={cambiar('descripcion')}
              placeholder="Detalla lo que deben entregar los estudiantes."
            />
          </div>
          <CRow className="g-3">
            <CCol xs={12} md={6}>
              <CFormLabel htmlFor="tarea-apertura">Apertura</CFormLabel>
              <CFormInput
                id="tarea-apertura"
                type="datetime-local"
                value={form.apertura}
                onChange={cambiar('apertura')}
                required
              />
            </CCol>
            <CCol xs={12} md={6}>
              <CFormLabel htmlFor="tarea-limite">Límite de entrega</CFormLabel>
              <CFormInput
                id="tarea-limite"
                type="datetime-local"
                value={form.limite}
                onChange={cambiar('limite')}
                required
              />
            </CCol>
          </CRow>
          <p className="text-body-secondary small mt-2 mb-0">
            Después del límite no se aceptan entregas, ni se pueden retirar o modificar.
          </p>
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" variant="ghost" onClick={onClose} disabled={guardando}>
            Cancelar
          </CButton>
          <CButton color="primary" type="submit" disabled={guardando}>
            {guardando && <CSpinner size="sm" className="me-2" />}
            {tarea ? 'Guardar cambios' : 'Crear tarea'}
          </CButton>
        </CModalFooter>
      </CForm>
    </CModal>
  )
}

TareaFormModal.propTypes = {
  visible: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  idAsignatura: PropTypes.string.isRequired,
  /** Tarea a editar; sin ella se crea una nueva */
  tarea: PropTypes.object,
  /** Recibe la tarea guardada (con su _id y estado) */
  onGuardada: PropTypes.func.isRequired,
}

export default TareaFormModal
