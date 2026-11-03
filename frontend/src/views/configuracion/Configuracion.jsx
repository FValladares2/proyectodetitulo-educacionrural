import React, { useEffect, useState } from 'react'
import {
  CAlert,
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CForm,
  CFormInput,
  CFormLabel,
  CFormSwitch,
  CFormText,
  CRow,
  CSpinner,
} from '@coreui/react'
import { actualizarPerfil, cambiarContrasena, fetchPerfil } from 'src/services/authServices'
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

const MIN_CONTRASENA = 8

const Perfil = () => {
  const [perfil, setPerfil] = useState(null)
  const [nombre, setNombre] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState(null)

  useEffect(() => {
    const controller = new AbortController()
    fetchPerfil(controller.signal)
      .then((datos) => {
        setPerfil(datos)
        setNombre(datos.nombre || '')
      })
      .catch(
        (err) => err.name !== 'AbortError' && setMensaje({ color: 'danger', texto: err.message }),
      )
    return () => controller.abort()
  }, [])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setGuardando(true)
    setMensaje(null)
    try {
      const actualizado = await actualizarPerfil({ nombre })
      setPerfil(actualizado)
      setNombre(actualizado.nombre)
      setMensaje({ color: 'success', texto: 'Perfil actualizado.' })
    } catch (err) {
      setMensaje({ color: 'danger', texto: err.message })
    } finally {
      setGuardando(false)
    }
  }

  const sinCambios = !perfil || nombre.trim() === perfil.nombre

  return (
    <CCard className="mb-4 shadow-sm border-0">
      <CCardHeader className="bg-transparent border-bottom">
        <h5 className="mb-0 fw-semibold">Perfil</h5>
      </CCardHeader>
      <CCardBody>
        {mensaje && <CAlert color={mensaje.color}>{mensaje.texto}</CAlert>}
        {!perfil ? (
          !mensaje && (
            <div className="text-center py-3">
              <CSpinner size="sm" />
            </div>
          )
        ) : (
          <CForm onSubmit={handleSubmit}>
            <CRow className="g-3">
              <CCol xs={12} md={6}>
                <CFormLabel htmlFor="perfil-nombre">Nombre</CFormLabel>
                <CFormInput
                  id="perfil-nombre"
                  value={nombre}
                  maxLength={100}
                  required
                  onChange={(e) => setNombre(e.target.value)}
                />
              </CCol>
              <CCol xs={12} md={6}>
                <CFormLabel htmlFor="perfil-correo">Correo</CFormLabel>
                <CFormInput id="perfil-correo" value={perfil.correo || ''} disabled readOnly />
                <CFormText>Tu correo identifica tu cuenta y no se puede cambiar.</CFormText>
              </CCol>
            </CRow>
            <CButton
              type="submit"
              color="primary"
              className="mt-3"
              disabled={guardando || sinCambios || !nombre.trim()}
            >
              {guardando ? 'Guardando...' : 'Guardar cambios'}
            </CButton>
          </CForm>
        )}
      </CCardBody>
    </CCard>
  )
}

const CambioContrasena = () => {
  const [form, setForm] = useState({ actual: '', nueva: '', confirmacion: '' })
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState(null)

  const cambiar = (campo) => (e) => setForm({ ...form, [campo]: e.target.value })
  const noCoinciden = form.confirmacion && form.nueva !== form.confirmacion

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (form.nueva.length < MIN_CONTRASENA || form.nueva !== form.confirmacion) return
    setGuardando(true)
    setMensaje(null)
    try {
      const { message } = await cambiarContrasena(form.actual, form.nueva)
      setForm({ actual: '', nueva: '', confirmacion: '' })
      setMensaje({ color: 'success', texto: message })
    } catch (err) {
      setMensaje({ color: 'danger', texto: err.message })
    } finally {
      setGuardando(false)
    }
  }

  return (
    <CCard className="mb-4 shadow-sm border-0">
      <CCardHeader className="bg-transparent border-bottom">
        <h5 className="mb-0 fw-semibold">Contraseña</h5>
      </CCardHeader>
      <CCardBody>
        <p className="text-body-secondary small">
          Al cambiarla se cerrarán tus sesiones abiertas en otros equipos.
        </p>
        {mensaje && <CAlert color={mensaje.color}>{mensaje.texto}</CAlert>}
        <CForm onSubmit={handleSubmit}>
          <CRow className="g-3">
            <CCol xs={12} md={4}>
              <CFormLabel htmlFor="contrasena-actual">Contraseña actual</CFormLabel>
              <CFormInput
                id="contrasena-actual"
                type="password"
                autoComplete="current-password"
                value={form.actual}
                required
                onChange={cambiar('actual')}
              />
            </CCol>
            <CCol xs={12} md={4}>
              <CFormLabel htmlFor="contrasena-nueva">Nueva contraseña</CFormLabel>
              <CFormInput
                id="contrasena-nueva"
                type="password"
                autoComplete="new-password"
                minLength={MIN_CONTRASENA}
                value={form.nueva}
                required
                onChange={cambiar('nueva')}
              />
              <CFormText>Al menos {MIN_CONTRASENA} caracteres.</CFormText>
            </CCol>
            <CCol xs={12} md={4}>
              <CFormLabel htmlFor="contrasena-confirmacion">Repite la nueva contraseña</CFormLabel>
              <CFormInput
                id="contrasena-confirmacion"
                type="password"
                autoComplete="new-password"
                value={form.confirmacion}
                invalid={Boolean(noCoinciden)}
                feedbackInvalid="Las contraseñas no coinciden."
                required
                onChange={cambiar('confirmacion')}
              />
            </CCol>
          </CRow>
          <CButton
            type="submit"
            color="primary"
            className="mt-3"
            disabled={
              guardando ||
              !form.actual ||
              form.nueva.length < MIN_CONTRASENA ||
              form.nueva !== form.confirmacion
            }
          >
            {guardando ? 'Guardando...' : 'Cambiar contraseña'}
          </CButton>
        </CForm>
      </CCardBody>
    </CCard>
  )
}

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
          <Perfil />
          <CambioContrasena />
          <PreferenciasCorreo />
        </CCol>
      </CRow>
    </div>
  )
}

export default Configuracion
