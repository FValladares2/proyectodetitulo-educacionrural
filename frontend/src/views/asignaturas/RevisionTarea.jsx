import {
  CAlert,
  CBadge,
  CButton,
  CButtonGroup,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CFormInput,
  CFormLabel,
  CFormTextarea,
  CListGroup,
  CListGroupItem,
  CRow,
  CSpinner,
} from '@coreui/react'
import PropTypes from 'prop-types'
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import IconoRecurso from 'src/components/recursos/IconoRecurso'
import { formatearFecha, insigniaTarea } from 'src/components/tareas/tareaFechas'
import { getAsignUsers } from 'src/services/asignServices'
import { descargarRecurso } from 'src/services/recursoServices'
import { calificarEntrega, fetchEntregas, fetchTarea } from 'src/services/tareaServices'

const FILTROS = [
  { valor: 'todos', texto: 'Todos' },
  { valor: 'entregadas', texto: 'Entregadas' },
  { valor: 'pendientes', texto: 'Sin entrega' },
  { valor: 'sin_calificar', texto: 'Sin calificar' },
]

const estaCalificada = (entrega) =>
  entrega?.calificacion !== null && entrega?.calificacion !== undefined

// --- una fila por estudiante: estado, archivos y calificación ---

const FilaEstudiante = ({ estudiante, entrega, idTarea, onCalificada }) => {
  const [calificacion, setCalificacion] = useState(
    estaCalificada(entrega) ? String(entrega.calificacion) : '',
  )
  const [comentario, setComentario] = useState(entrega?.comentario || '')
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState(null)

  const handleDescargar = async (archivo) => {
    setMensaje(null)
    try {
      await descargarRecurso(archivo)
    } catch (err) {
      setMensaje({ color: 'danger', texto: err.message })
    }
  }

  const handleGuardar = async (event) => {
    event.preventDefault()
    const numero = calificacion.trim() === '' ? null : Number(calificacion.replace(',', '.'))
    if (numero !== null && !Number.isFinite(numero)) {
      setMensaje({ color: 'danger', texto: 'La calificación debe ser un número.' })
      return
    }
    setGuardando(true)
    setMensaje(null)
    try {
      const actualizada = await calificarEntrega(idTarea, estudiante._id, {
        calificacion: numero,
        comentario,
      })
      onCalificada(actualizada)
      setMensaje({ color: 'success', texto: 'Calificación guardada.' })
    } catch (err) {
      setMensaje({ color: 'danger', texto: err.message })
    } finally {
      setGuardando(false)
    }
  }

  return (
    <CListGroupItem className="py-3">
      <CRow className="g-3">
        <CCol xs={12} md={4}>
          <div className="fw-semibold text-break">{estudiante.nombre}</div>
          <div className="small text-body-secondary text-break">{estudiante.correo}</div>
          <div className="mt-1">
            {entrega ? (
              <CBadge color="primary" className="fw-normal">
                Entregada el {formatearFecha(entrega.enviada_en)}
              </CBadge>
            ) : (
              <CBadge color="secondary" className="fw-normal">
                Sin entrega
              </CBadge>
            )}
          </div>
        </CCol>

        <CCol xs={12} md={4}>
          {entrega?.archivos?.length > 0 ? (
            <div className="d-flex flex-column gap-1">
              {entrega.archivos.map((archivo) => (
                <button
                  key={archivo._id}
                  type="button"
                  className="recurso-enlace text-start"
                  onClick={() => handleDescargar(archivo)}
                  title={`Descargar ${archivo.nombre}`}
                >
                  <IconoRecurso nombre={archivo.nombre} aria-hidden="true" />
                  <span className="text-break">{archivo.nombre}</span>
                </button>
              ))}
            </div>
          ) : (
            <span className="small text-body-secondary">Sin archivos</span>
          )}
        </CCol>

        <CCol xs={12} md={4}>
          {entrega ? (
            <form onSubmit={handleGuardar}>
              <CFormLabel htmlFor={`nota-${estudiante._id}`} className="small mb-1">
                Calificación
              </CFormLabel>
              <CFormInput
                id={`nota-${estudiante._id}`}
                inputMode="decimal"
                size="sm"
                value={calificacion}
                onChange={(event) => setCalificacion(event.target.value)}
                placeholder="Sin calificar"
                className="mb-2"
              />
              <CFormTextarea
                size="sm"
                rows={2}
                value={comentario}
                onChange={(event) => setComentario(event.target.value)}
                placeholder="Comentario para el estudiante (opcional)"
                maxLength={2000}
                className="mb-2"
                aria-label={`Comentario para ${estudiante.nombre}`}
              />
              <CButton type="submit" color="primary" size="sm" disabled={guardando}>
                {guardando && <CSpinner size="sm" className="me-1" />}
                Guardar
              </CButton>
            </form>
          ) : (
            <span className="small text-body-secondary">
              Se podrá calificar cuando envíe su entrega.
            </span>
          )}
          {mensaje && (
            <div className={`small mt-2 text-${mensaje.color}`} role="status">
              {mensaje.texto}
            </div>
          )}
        </CCol>
      </CRow>
    </CListGroupItem>
  )
}

FilaEstudiante.propTypes = {
  estudiante: PropTypes.object.isRequired,
  entrega: PropTypes.object,
  idTarea: PropTypes.string.isRequired,
  onCalificada: PropTypes.func.isRequired,
}

/**
 * Página de revisión de una tarea, solo para docentes: lista a cada estudiante de la
 * asignatura con su entrega, sus archivos y la calificación.
 */
const RevisionTarea = () => {
  const { id, idTarea } = useParams()
  const [tarea, setTarea] = useState(null)
  const [entregas, setEntregas] = useState(null)
  const [estudiantes, setEstudiantes] = useState([])
  const [error, setError] = useState('')
  const [filtro, setFiltro] = useState('todos')

  useEffect(() => {
    const controller = new AbortController()
    Promise.all([
      fetchTarea(idTarea, controller.signal),
      fetchEntregas(idTarea, controller.signal),
      getAsignUsers(id, controller.signal),
    ])
      .then(([tareaCargada, entregasCargadas, integrantes]) => {
        setTarea(tareaCargada)
        setEntregas(entregasCargadas)
        setEstudiantes(integrantes?.users || [])
      })
      .catch((err) => err.name !== 'AbortError' && setError(err.message))
    return () => controller.abort()
  }, [id, idTarea])

  // estudiantes de la asignatura más quienes entregaron sin estar en la lista (por ejemplo,
  // si se retiraron de la asignatura después de entregar)
  const filas = useMemo(() => {
    if (!entregas) return []
    const porUsuario = new Map(entregas.map((e) => [String(e.id_usuario), e]))
    const lista = estudiantes.map((estudiante) => ({
      estudiante,
      entrega: porUsuario.get(String(estudiante._id)) || null,
    }))
    const enLista = new Set(estudiantes.map((e) => String(e._id)))
    for (const entrega of entregas) {
      if (!enLista.has(String(entrega.id_usuario))) {
        lista.push({
          estudiante: entrega.usuario || { _id: entrega.id_usuario, nombre: 'Usuario', correo: '' },
          entrega,
        })
      }
    }
    return lista.sort((a, b) =>
      (a.estudiante.nombre || '').localeCompare(b.estudiante.nombre || '', 'es'),
    )
  }, [entregas, estudiantes])

  const filasVisibles = filas.filter(({ entrega }) => {
    if (filtro === 'entregadas') return Boolean(entrega)
    if (filtro === 'pendientes') return !entrega
    if (filtro === 'sin_calificar') return entrega && !estaCalificada(entrega)
    return true
  })

  const handleCalificada = (actualizada) =>
    setEntregas((actuales) =>
      actuales.map((e) =>
        String(e.id_usuario) === String(actualizada.id_usuario) ? { ...e, ...actualizada } : e,
      ),
    )

  const volver = (
    <Link to={`/asignaturas/${id}`} className="small">
      ← Volver a la asignatura
    </Link>
  )

  if (error) {
    return (
      <div className="mb-4">
        <div className="mb-3">{volver}</div>
        <CAlert color="danger">{error}</CAlert>
      </div>
    )
  }

  if (!tarea || !entregas) {
    return (
      <div className="text-center py-5">
        <CSpinner color="primary" />
        <p className="mt-2 text-body-secondary small">Cargando entregas...</p>
      </div>
    )
  }

  const insignia = insigniaTarea(tarea)
  const totalEntregadas = filas.filter((f) => f.entrega).length
  const totalCalificadas = filas.filter((f) => estaCalificada(f.entrega)).length

  return (
    <div className="mb-4">
      <div className="mb-3">{volver}</div>
      <CCard className="mb-4 shadow-sm border-0">
        <CCardHeader>
          <div className="d-flex flex-wrap align-items-center gap-2">
            <h4 className="mb-0 fw-semibold fs-5 text-break">{tarea.titulo}</h4>
            <CBadge color={insignia.color} className="fw-normal">
              {insignia.texto}
            </CBadge>
          </div>
          <div className="small text-body-secondary fw-normal mt-1">
            Abre: {formatearFecha(tarea.apertura)} · Límite: {formatearFecha(tarea.limite)}
          </div>
        </CCardHeader>
        <CCardBody>
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
            <p className="mb-0">
              <strong>{totalEntregadas}</strong> de {filas.length} entregadas ·{' '}
              <strong>{totalCalificadas}</strong> calificadas
            </p>
            <CButtonGroup size="sm" role="group" aria-label="Filtrar estudiantes">
              {FILTROS.map(({ valor, texto }) => (
                <CButton
                  key={valor}
                  color="secondary"
                  variant={filtro === valor ? undefined : 'outline'}
                  onClick={() => setFiltro(valor)}
                >
                  {texto}
                </CButton>
              ))}
            </CButtonGroup>
          </div>

          {filasVisibles.length === 0 ? (
            <p className="text-body-secondary mb-0">No hay estudiantes en esta categoría.</p>
          ) : (
            <CListGroup>
              {filasVisibles.map(({ estudiante, entrega }) => (
                <FilaEstudiante
                  // se remonta si la entrega cambia (otra entrega reemplaza a la anterior)
                  key={`${estudiante._id}-${entrega?._id ?? 'sin'}`}
                  estudiante={estudiante}
                  entrega={entrega}
                  idTarea={idTarea}
                  onCalificada={handleCalificada}
                />
              ))}
            </CListGroup>
          )}
        </CCardBody>
      </CCard>
    </div>
  )
}

export default RevisionTarea
