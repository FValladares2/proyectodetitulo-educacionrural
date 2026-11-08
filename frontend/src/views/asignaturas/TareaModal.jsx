import {
  CAlert,
  CBadge,
  CButton,
  CListGroup,
  CListGroupItem,
  CModal,
  CModalBody,
  CModalHeader,
  CModalTitle,
  CSpinner,
} from '@coreui/react'
import PropTypes from 'prop-types'
import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { useNavigate } from 'react-router-dom'
import IconoRecurso from 'src/components/recursos/IconoRecurso'
import { formatearFecha, insigniaTarea } from 'src/components/tareas/tareaFechas'
import { descargarRecurso, eliminarRecurso, formatearTamano } from 'src/services/recursoServices'
import {
  eliminarTarea,
  enviarEntrega,
  fetchMiEntrega,
  fetchTarea,
  retirarEntrega,
  subirArchivoEntrega,
} from 'src/services/tareaServices'
import EnlaceMarkdown from './EnlaceMarkdown'
import ImagenMarkdown from './ImagenMarkdown'
import { urlTransform } from './recursoMarkdown'

const componentesDescripcion = { img: ImagenMarkdown, a: EnlaceMarkdown }

// --- vista del estudiante: sus archivos, enviar y retirar ---

const EntregaEstudiante = ({ tarea, onCambio }) => {
  const [mia, setMia] = useState(null)
  const [error, setError] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const [recargas, setRecargas] = useState(0)
  const inputArchivo = useRef(null)

  useEffect(() => {
    const controller = new AbortController()
    fetchMiEntrega(tarea._id, controller.signal)
      .then(setMia)
      .catch((err) => err.name !== 'AbortError' && setError(err.message))
    return () => controller.abort()
  }, [tarea._id, recargas])

  // ejecuta una acción, muestra su error y vuelve a cargar la entrega
  const ejecutar = async (accion, { avisar = false } = {}) => {
    setOcupado(true)
    setError('')
    try {
      await accion()
      if (avisar) onCambio()
    } catch (err) {
      setError(err.message)
    } finally {
      setOcupado(false)
      setRecargas((r) => r + 1)
    }
  }

  const handleArchivos = (event) => {
    const archivos = [...event.target.files]
    event.target.value = ''
    if (archivos.length === 0) return
    ejecutar(async () => {
      for (const archivo of archivos) {
        await subirArchivoEntrega(tarea._id, archivo)
      }
    })
  }

  if (!mia) {
    return error ? (
      <CAlert color="danger">{error}</CAlert>
    ) : (
      <div className="text-center py-3">
        <CSpinner size="sm" />
      </div>
    )
  }

  const { entrega, archivos, puedeEditarArchivos, estado, asignaturaInactiva } = mia
  const tieneNota = entrega && (entrega.calificacion !== null || entrega.comentario)

  return (
    <div className="tarea-entrega">
      <h6 className="fw-semibold">Tu entrega</h6>
      {error && <CAlert color="danger">{error}</CAlert>}

      <p className="small mb-2">
        {entrega ? (
          <>
            <CBadge color="primary" className="me-2">
              Entregada
            </CBadge>
            Enviada el {formatearFecha(entrega.enviada_en)}
          </>
        ) : archivos.length > 0 ? (
          <span className="text-body-secondary">Borrador: tus archivos aún no se han enviado.</span>
        ) : (
          <span className="text-body-secondary">Aún no has subido archivos.</span>
        )}
      </p>

      {tieneNota && (
        <CAlert color="info" className="py-2">
          {entrega.calificacion !== null && (
            <div>
              <strong>Calificación:</strong> {entrega.calificacion}
            </div>
          )}
          {entrega.comentario && (
            <div style={{ whiteSpace: 'pre-wrap' }}>
              <strong>Comentario:</strong> {entrega.comentario}
            </div>
          )}
        </CAlert>
      )}

      {archivos.length > 0 && (
        <CListGroup className="mb-3">
          {archivos.map((archivo) => (
            <CListGroupItem key={archivo._id} className="d-flex align-items-center gap-2">
              <IconoRecurso nombre={archivo.nombre} aria-hidden="true" />
              <span className="text-break me-auto">{archivo.nombre}</span>
              <span className="text-body-secondary small text-nowrap">
                {formatearTamano(archivo.tamano)}
              </span>
              <CButton
                color="secondary"
                variant="ghost"
                size="sm"
                onClick={() => ejecutar(() => descargarRecurso(archivo))}
                disabled={ocupado}
              >
                Descargar
              </CButton>
              {puedeEditarArchivos && (
                <CButton
                  color="danger"
                  variant="ghost"
                  size="sm"
                  onClick={() => ejecutar(() => eliminarRecurso(archivo._id))}
                  disabled={ocupado}
                >
                  Quitar
                </CButton>
              )}
            </CListGroupItem>
          ))}
        </CListGroup>
      )}

      {asignaturaInactiva ? (
        <p className="text-body-secondary small mb-0">
          La asignatura está inactiva: puedes ver tu entrega, pero no enviarla ni modificarla.
        </p>
      ) : estado === 'abierta' ? (
        <div className="d-flex flex-wrap gap-2 align-items-center">
          {puedeEditarArchivos && (
            <>
              <input
                ref={inputArchivo}
                type="file"
                multiple
                className="d-none"
                onChange={handleArchivos}
              />
              <CButton
                color="secondary"
                variant="outline"
                onClick={() => inputArchivo.current?.click()}
                disabled={ocupado}
              >
                Subir archivos
              </CButton>
            </>
          )}
          {entrega ? (
            <CButton
              color="warning"
              variant="outline"
              onClick={() => ejecutar(() => retirarEntrega(tarea._id), { avisar: true })}
              disabled={ocupado}
            >
              Retirar entrega
            </CButton>
          ) : (
            <CButton
              color="primary"
              onClick={() => ejecutar(() => enviarEntrega(tarea._id), { avisar: true })}
              disabled={ocupado || archivos.length === 0}
            >
              Enviar entrega
            </CButton>
          )}
          {ocupado && <CSpinner size="sm" />}
          {entrega && (
            <p className="text-body-secondary small w-100 mb-0">
              Para modificar tus archivos, retira la entrega y envíala de nuevo
              {tieneNota ? '; la calificación actual se perderá' : ''}.
            </p>
          )}
        </div>
      ) : (
        <p className="text-body-secondary small mb-0">
          {estado === 'pendiente'
            ? `Podrás entregar desde el ${formatearFecha(tarea.apertura)}.`
            : 'El plazo de entrega terminó.'}
        </p>
      )}
    </div>
  )
}

EntregaEstudiante.propTypes = {
  tarea: PropTypes.object.isRequired,
  onCambio: PropTypes.func.isRequired,
}

// --- vista docente: resumen, editar, eliminar y acceso a la revisión ---

const GestionDocente = ({ tarea, resumen, idAsignatura, soloLectura, onEditar, onEliminada }) => {
  const navigate = useNavigate()
  const [confirmando, setConfirmando] = useState(false)
  const [error, setError] = useState('')
  const [eliminando, setEliminando] = useState(false)
  const totalEntregas = resumen?.entregas ?? 0

  const handleEliminar = async () => {
    setEliminando(true)
    setError('')
    try {
      await eliminarTarea(tarea._id)
      onEliminada()
    } catch (err) {
      setError(err.message)
      setEliminando(false)
    }
  }

  return (
    <div className="tarea-gestion">
      {error && <CAlert color="danger">{error}</CAlert>}
      <p className="mb-3">
        <strong>{totalEntregas}</strong>{' '}
        {totalEntregas === 1 ? 'entrega recibida' : 'entregas recibidas'}
      </p>
      <div className="d-flex flex-wrap gap-2">
        <CButton
          color="primary"
          onClick={() =>
            navigate(`/asignaturas/${idAsignatura}/tareas/${tarea._id}`, {
              state: { nombre: tarea.titulo },
            })
          }
        >
          Revisar entregas
        </CButton>
        {/* en una asignatura inactiva se puede revisar y calificar, pero no editar ni eliminar */}
        {!soloLectura && (
          <CButton color="secondary" variant="outline" onClick={() => onEditar(tarea)}>
            Editar
          </CButton>
        )}
        {!soloLectura && !confirmando && (
          <CButton color="danger" variant="ghost" onClick={() => setConfirmando(true)}>
            Eliminar
          </CButton>
        )}
      </div>

      {confirmando && (
        <CAlert color="danger" className="mt-3 mb-0">
          <p className="mb-2">
            Se eliminará la tarea
            {totalEntregas > 0 ? ` junto con sus ${totalEntregas} entregas y sus archivos` : ''}.
            Esta acción no se puede deshacer.
          </p>
          <div className="d-flex gap-2">
            <CButton color="danger" size="sm" onClick={handleEliminar} disabled={eliminando}>
              {eliminando && <CSpinner size="sm" className="me-1" />}
              Eliminar definitivamente
            </CButton>
            <CButton
              color="secondary"
              variant="ghost"
              size="sm"
              onClick={() => setConfirmando(false)}
              disabled={eliminando}
            >
              Cancelar
            </CButton>
          </div>
        </CAlert>
      )}
    </div>
  )
}

GestionDocente.propTypes = {
  tarea: PropTypes.object.isRequired,
  resumen: PropTypes.object,
  idAsignatura: PropTypes.string.isRequired,
  soloLectura: PropTypes.bool,
  onEditar: PropTypes.func.isRequired,
  onEliminada: PropTypes.func.isRequired,
}

// --- contenido: se monta por tarea para que su estado se reinicie al cambiar de tarea ---

const ContenidoTarea = ({
  tareaId,
  idAsignatura,
  esDocente,
  soloLectura,
  resumen,
  onCambio,
  onEditar,
  onClose,
}) => {
  const [tarea, setTarea] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    fetchTarea(tareaId, controller.signal)
      .then(setTarea)
      .catch((err) => err.name !== 'AbortError' && setError(err.message))
    return () => controller.abort()
  }, [tareaId])

  if (!tarea) {
    return (
      <>
        <CModalHeader>
          <CModalTitle>Tarea</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {error ? (
            <CAlert color="danger">{error}</CAlert>
          ) : (
            <div className="text-center py-4">
              <CSpinner />
            </div>
          )}
        </CModalBody>
      </>
    )
  }

  // la insignia del estudiante considera si ya entregó (dato de la lista)
  const insignia = insigniaTarea({ ...tarea, enviada_en: esDocente ? null : resumen?.enviada_en })

  return (
    <>
      <CModalHeader>
        <CModalTitle className="d-flex flex-wrap align-items-center gap-2">
          {tarea.titulo}
          <CBadge color={insignia.color} className="fs-6 fw-normal">
            {insignia.texto}
          </CBadge>
        </CModalTitle>
      </CModalHeader>
      <CModalBody>
        <p className="small text-body-secondary mb-3">
          Abre: {formatearFecha(tarea.apertura)} · Límite: {formatearFecha(tarea.limite)}
        </p>

        {tarea.descripcion ? (
          <div className="asignatura-markdown mb-4">
            <ReactMarkdown components={componentesDescripcion} urlTransform={urlTransform}>
              {tarea.descripcion}
            </ReactMarkdown>
          </div>
        ) : (
          <p className="text-body-secondary fst-italic mb-4">Sin instrucciones adicionales.</p>
        )}

        <hr />
        {esDocente ? (
          <GestionDocente
            tarea={tarea}
            resumen={resumen}
            idAsignatura={idAsignatura}
            soloLectura={soloLectura}
            onEditar={onEditar}
            onEliminada={() => {
              onCambio()
              onClose()
            }}
          />
        ) : (
          <EntregaEstudiante tarea={tarea} onCambio={onCambio} />
        )}
      </CModalBody>
    </>
  )
}

ContenidoTarea.propTypes = {
  tareaId: PropTypes.string.isRequired,
  idAsignatura: PropTypes.string.isRequired,
  esDocente: PropTypes.bool.isRequired,
  soloLectura: PropTypes.bool,
  resumen: PropTypes.object,
  onCambio: PropTypes.func.isRequired,
  onEditar: PropTypes.func.isRequired,
  onClose: PropTypes.func.isRequired,
}

/**
 * Modal de una tarea. Los estudiantes ven las instrucciones y gestionan su entrega; los
 * docentes ven un resumen y acceden a editar, eliminar o revisar las entregas (en su propia
 * página), sin opciones para entregar.
 * `resumen` es la tarea tal como viene en la lista (cantidad de entregas o enviada_en).
 * Editar se delega a la página (onEditar) para no abrir un modal dentro de otro.
 */
const TareaModal = ({
  tareaId,
  onClose,
  idAsignatura,
  esDocente,
  soloLectura,
  resumen,
  onCambio,
  onEditar,
}) => (
  <CModal
    visible={Boolean(tareaId)}
    onClose={onClose}
    size="lg"
    alignment="center"
    scrollable
    fullscreen="sm"
  >
    {tareaId && (
      <ContenidoTarea
        key={tareaId}
        tareaId={tareaId}
        idAsignatura={idAsignatura}
        esDocente={esDocente}
        soloLectura={soloLectura}
        resumen={resumen}
        onCambio={onCambio}
        onEditar={onEditar}
        onClose={onClose}
      />
    )}
  </CModal>
)

TareaModal.propTypes = {
  /** Tarea abierta; null cierra el modal */
  tareaId: PropTypes.string,
  onClose: PropTypes.func.isRequired,
  idAsignatura: PropTypes.string.isRequired,
  esDocente: PropTypes.bool.isRequired,
  /** Asignatura inactiva: los docentes pueden revisar, pero no editar ni eliminar */
  soloLectura: PropTypes.bool,
  resumen: PropTypes.object,
  /** Se llama cuando cambia algo que afecta a la lista (envío, retiro, eliminación) */
  onCambio: PropTypes.func.isRequired,
  /** Docentes: recibe la tarea a editar; la página cierra este modal y abre el formulario */
  onEditar: PropTypes.func.isRequired,
}

export default TareaModal
