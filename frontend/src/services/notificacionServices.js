import { apiFetch } from './apiClient'

// { notificaciones: [...con `ruta`], noLeidas }
const fetchNotificaciones = (limit = 15, signal = undefined) =>
  apiFetch(`/api/notificaciones?limit=${limit}`, {
    signal,
    mensajeError: 'No se pudieron obtener las notificaciones.',
  })

const fetchCantidadNoLeidas = (signal = undefined) =>
  apiFetch('/api/notificaciones/no-leidas', { signal }).then((data) => data.cantidad)

const marcarNotificacionLeida = (id) =>
  apiFetch(`/api/notificaciones/${id}/leida`, { method: 'PUT' })

const marcarTodasLeidas = () => apiFetch('/api/notificaciones/leidas', { method: 'PUT' })

// { tipo: boolean } para cada aviso que puede enviarse por correo
const fetchPreferenciasCorreo = (signal = undefined) =>
  apiFetch('/api/notificaciones/preferencias', {
    signal,
    mensajeError: 'No se pudieron obtener tus preferencias.',
  })

const actualizarPreferenciasCorreo = (cambios) =>
  apiFetch('/api/notificaciones/preferencias', {
    method: 'PUT',
    body: cambios,
    mensajeError: 'No se pudo guardar la preferencia.',
  })

export {
  fetchNotificaciones,
  fetchCantidadNoLeidas,
  marcarNotificacionLeida,
  marcarTodasLeidas,
  fetchPreferenciasCorreo,
  actualizarPreferenciasCorreo,
}
