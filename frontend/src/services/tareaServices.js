import { apiFetch } from './apiClient'
import { MAX_TAMANO_ARCHIVO } from './recursoServices'

// --- tareas ---

// sin descripciones; los docentes reciben `entregas` (cantidad) y los estudiantes `enviada_en`
const fetchTareasByAsignatura = (id_asignatura, signal = undefined) =>
  apiFetch(`/api/tarea/asignatura/${id_asignatura}`, {
    signal,
    mensajeError: 'No se pudieron obtener las tareas.',
  })

const fetchTarea = (id, signal = undefined) =>
  apiFetch(`/api/tarea/${id}`, { signal, mensajeError: 'No se pudo obtener la tarea.' })

// { id_asignatura, titulo, descripcion, apertura, limite } con fechas ISO
const crearTarea = (tarea) =>
  apiFetch('/api/tarea', {
    method: 'POST',
    body: tarea,
    mensajeError: 'No se pudo crear la tarea.',
  })

const actualizarTarea = (id, cambios) =>
  apiFetch(`/api/tarea/${id}`, {
    method: 'PUT',
    body: cambios,
    mensajeError: 'No se pudo editar la tarea.',
  })

// elimina también las entregas y sus archivos
const eliminarTarea = (id) =>
  apiFetch(`/api/tarea/${id}`, { method: 'DELETE', mensajeError: 'No se pudo eliminar la tarea.' })

// --- entrega propia ---

// { estado, entrega | null, archivos, puedeEditarArchivos }
const fetchMiEntrega = (id_tarea, signal = undefined) =>
  apiFetch(`/api/tarea/${id_tarea}/mi-entrega`, {
    signal,
    mensajeError: 'No se pudo obtener tu entrega.',
  })

// los archivos de la entrega se suben como recursos de la tarea, privados para el estudiante
const subirArchivoEntrega = (id_tarea, archivo) => {
  if (archivo.size > MAX_TAMANO_ARCHIVO) {
    return Promise.reject(new Error('El archivo supera el tamaño máximo de 10MB.'))
  }
  const datos = new FormData()
  datos.append('id_tarea', id_tarea)
  datos.append('file', archivo)
  return apiFetch('/api/recurso/upload', {
    method: 'POST',
    body: datos,
    mensajeError: 'No se pudo subir el archivo.',
  })
}

const enviarEntrega = (id_tarea) =>
  apiFetch(`/api/tarea/${id_tarea}/entrega`, {
    method: 'POST',
    mensajeError: 'No se pudo enviar la entrega.',
  })

// la entrega se elimina y sus archivos quedan como borrador para editarlos
const retirarEntrega = (id_tarea) =>
  apiFetch(`/api/tarea/${id_tarea}/entrega`, {
    method: 'DELETE',
    mensajeError: 'No se pudo retirar la entrega.',
  })

// --- revisión docente ---

const fetchEntregas = (id_tarea, signal = undefined) =>
  apiFetch(`/api/tarea/${id_tarea}/entregas`, {
    signal,
    mensajeError: 'No se pudieron obtener las entregas.',
  })

// { calificacion: número | null, comentario }
const calificarEntrega = (id_tarea, id_usuario, calificacion) =>
  apiFetch(`/api/tarea/${id_tarea}/entregas/${id_usuario}`, {
    method: 'PUT',
    body: calificacion,
    mensajeError: 'No se pudo guardar la calificación.',
  })

export {
  fetchTareasByAsignatura,
  fetchTarea,
  crearTarea,
  actualizarTarea,
  eliminarTarea,
  fetchMiEntrega,
  subirArchivoEntrega,
  enviarEntrega,
  retirarEntrega,
  fetchEntregas,
  calificarEntrega,
}
