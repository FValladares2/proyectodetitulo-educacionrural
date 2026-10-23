import React, { useEffect, useState } from 'react'
import {
  CAlert,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CFormSwitch,
  CRow,
  CSpinner,
} from '@coreui/react'
import {
  actualizarPreferenciasCorreo,
  fetchPreferenciasCorreo,
} from 'src/services/notificacionServices'

// avisos que pueden enviarse por correo; en la campana de la plataforma aparecen siempre
const AVISOS_CORREO = [
  {
    tipo: 'tarea_creada',
    titulo: 'Nuevas tareas',
    descripcion: 'Cuando un docente publica una tarea en una de tus asignaturas.',
  },
  {
    tipo: 'tarea_por_cerrar',
    titulo: 'Tareas por cerrar',
    descripcion: 'Un día antes del límite, si aún no has enviado la tarea.',
  },
  {
    tipo: 'entrega_calificada',
    titulo: 'Entregas revisadas',
    descripcion: 'Cuando un docente califica o comenta tu entrega.',
  },
  {
    tipo: 'agregado_asignatura',
    titulo: 'Nuevas asignaturas',
    descripcion: 'Cuando te agregan a una asignatura.',
  },
  {
    tipo: 'agregado_organizacion',
    titulo: 'Nuevas organizaciones',
    descripcion: 'Cuando te agregan a una organización.',
  },
]

const PreferenciasCorreo = () => {
  const [preferencias, setPreferencias] = useState(null)
  const [guardando, setGuardando] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    fetchPreferenciasCorreo(controller.signal)
      .then(setPreferencias)
      .catch((err) => err.name !== 'AbortError' && setError(err.message))
    return () => controller.abort()
  }, [])

  // se guarda al cambiar; si falla, el interruptor vuelve a su valor anterior
  const handleCambio = async (tipo, activo) => {
    const anterior = preferencias
    setPreferencias({ ...preferencias, [tipo]: activo })
    setGuardando(tipo)
    setError('')
    try {
      setPreferencias(await actualizarPreferenciasCorreo({ [tipo]: activo }))
    } catch (err) {
      setPreferencias(anterior)
      setError(err.message)
    } finally {
      setGuardando(null)
    }
  }

  return (
    <CCard className="mb-4 shadow-sm border-0">
      <CCardHeader className="bg-transparent border-bottom">
        <h5 className="mb-0 fw-semibold">Avisos por correo</h5>
      </CCardHeader>
      <CCardBody>
        <p className="text-body-secondary small">
          Elige qué avisos quieres recibir también en tu correo. Todos aparecen siempre en la
          campana de notificaciones de la plataforma.
        </p>
        {error && <CAlert color="danger">{error}</CAlert>}
        {!preferencias ? (
          !error && (
            <div className="text-center py-3">
              <CSpinner size="sm" />
            </div>
          )
        ) : (
          <div className="d-flex flex-column gap-3">
            {AVISOS_CORREO.map(({ tipo, titulo, descripcion }) => (
              <div key={tipo} className="d-flex align-items-start gap-3">
                <CFormSwitch
                  id={`aviso-${tipo}`}
                  checked={Boolean(preferencias[tipo])}
                  onChange={(event) => handleCambio(tipo, event.target.checked)}
                  disabled={guardando !== null}
                  className="mt-1"
                />
                <label htmlFor={`aviso-${tipo}`} className="flex-grow-1">
                  <span className="d-block fw-semibold">{titulo}</span>
                  <span className="d-block small text-body-secondary">{descripcion}</span>
                </label>
                {guardando === tipo && <CSpinner size="sm" className="mt-1" />}
              </div>
            ))}
          </div>
        )}
      </CCardBody>
    </CCard>
  )
}

const Configuracion = () => {
  return (
    <div className="mb-4">
      <CRow>
        <CCol xs={12}>
          <PreferenciasCorreo />
        </CCol>
      </CRow>
    </div>
  )
}

export default Configuracion
