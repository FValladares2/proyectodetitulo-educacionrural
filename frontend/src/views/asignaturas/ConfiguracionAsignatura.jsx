import { useEffect, useState } from 'react'
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
import PropTypes from 'prop-types'
import { useParams } from 'react-router-dom'
import { actualizarConfigAsignatura, fetchConfigAsignatura } from 'src/services/asignServices'
import { formatearTamano } from 'src/services/recursoServices'

const MAX_NOMBRE = 120

const cantidadArchivos = (n) => `${n} ${n === 1 ? 'archivo' : 'archivos'}`

// espacio que ocupan los archivos de la asignatura: material del docente y entregas
const AlmacenamientoAsignatura = ({ almacenamiento }) => {
  const { material, entregas } = almacenamiento
  const tamano = material.tamano + entregas.tamano
  return (
    <CCard className="mb-4 shadow-sm border-0">
      <CCardHeader className="bg-transparent border-bottom">
        <h5 className="mb-0 fw-semibold">Almacenamiento</h5>
      </CCardHeader>
      <CCardBody>
        <p className="mb-2">
          Esta asignatura usa <strong>{formatearTamano(tamano)}</strong> en{' '}
          {cantidadArchivos(material.archivos + entregas.archivos)}:
        </p>
        <ul className="mb-2">
          <li>
            Material de la asignatura: {formatearTamano(material.tamano)} (
            {cantidadArchivos(material.archivos)})
          </li>
          <li>
            Entregas de estudiantes: {formatearTamano(entregas.tamano)} (
            {cantidadArchivos(entregas.archivos)})
          </li>
        </ul>
        <CFormText>
          Tamaño original de los archivos. Para liberar espacio, elimina archivos que ya no se usen
          o tareas antiguas junto con sus entregas.
        </CFormText>
      </CCardBody>
    </CCard>
  )
}
AlmacenamientoAsignatura.propTypes = {
  almacenamiento: PropTypes.shape({
    material: PropTypes.shape({ archivos: PropTypes.number, tamano: PropTypes.number }),
    entregas: PropTypes.shape({ archivos: PropTypes.number, tamano: PropTypes.number }),
  }).isRequired,
}

// nombre y estado de la asignatura; para docentes y administradores de la organización
const ConfiguracionAsignatura = () => {
  const { id } = useParams()
  const [guardada, setGuardada] = useState(null)
  const [form, setForm] = useState({ nombre: '', activo: true })
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState(null)
  // solo viene al cargar; guardar el nombre o el estado no lo cambia
  const [almacenamiento, setAlmacenamiento] = useState(null)

  useEffect(() => {
    const controller = new AbortController()
    fetchConfigAsignatura(id, controller.signal)
      .then((config) => {
        setGuardada(config)
        setForm({ nombre: config.nombre, activo: config.activo })
        setAlmacenamiento(config.almacenamiento ?? null)
      })
      .catch(
        (err) => err.name !== 'AbortError' && setMensaje({ color: 'danger', texto: err.message }),
      )
      .finally(() => !controller.signal.aborted && setCargando(false))
    return () => controller.abort()
  }, [id])

  const sinCambios =
    !guardada || (form.nombre.trim() === guardada.nombre && form.activo === guardada.activo)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setGuardando(true)
    setMensaje(null)
    try {
      const config = await actualizarConfigAsignatura(id, {
        nombre: form.nombre,
        activo: form.activo,
      })
      setGuardada(config)
      setForm({ nombre: config.nombre, activo: config.activo })
      setMensaje({ color: 'success', texto: 'Configuración guardada.' })
    } catch (err) {
      setMensaje({ color: 'danger', texto: err.message })
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="mb-4">
      <CCard className="mb-4 shadow-sm border-0">
        <CCardHeader className="bg-transparent border-bottom">
          <h5 className="mb-0 fw-semibold">Configuración de la asignatura</h5>
        </CCardHeader>
        <CCardBody>
          {mensaje && <CAlert color={mensaje.color}>{mensaje.texto}</CAlert>}
          {cargando ? (
            <div className="text-center py-3">
              <CSpinner size="sm" />
            </div>
          ) : (
            guardada && (
              <CForm onSubmit={handleSubmit}>
                <CRow className="g-3">
                  <CCol xs={12} md={8}>
                    <CFormLabel htmlFor="asignatura-nombre">Nombre</CFormLabel>
                    <CFormInput
                      id="asignatura-nombre"
                      value={form.nombre}
                      maxLength={MAX_NOMBRE}
                      required
                      onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                    />
                  </CCol>
                  <CCol xs={12}>
                    <CFormSwitch
                      id="asignatura-activo"
                      label="Asignatura activa"
                      checked={form.activo}
                      onChange={(e) => setForm({ ...form, activo: e.target.checked })}
                    />
                    <CFormText>
                      Una asignatura inactiva queda de solo lectura: sus integrantes pueden ver el
                      contenido, los archivos y las tareas, pero no se puede editar ni entregar. Los
                      docentes aún pueden revisar y calificar las entregas, y reactivarla aquí.
                    </CFormText>
                  </CCol>
                </CRow>
                <CButton
                  type="submit"
                  color="primary"
                  className="mt-3"
                  disabled={guardando || sinCambios || !form.nombre.trim()}
                >
                  {guardando ? 'Guardando...' : 'Guardar cambios'}
                </CButton>
              </CForm>
            )
          )}
        </CCardBody>
      </CCard>
      {almacenamiento && <AlmacenamientoAsignatura almacenamiento={almacenamiento} />}
    </div>
  )
}

export default ConfiguracionAsignatura
