import { CAlert, CButton } from '@coreui/react'
import { useSyncExternalStore } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

const suscribirConexion = (avisar) => {
  window.addEventListener('online', avisar)
  window.addEventListener('offline', avisar)
  return () => {
    window.removeEventListener('online', avisar)
    window.removeEventListener('offline', avisar)
  }
}

const estaEnLinea = () => navigator.onLine

/**
 * Avisos globales: falta de conexión y nueva versión disponible del service worker.
 * Se muestran fijos abajo para no desplazar el contenido.
 */
const EstadoConexion = () => {
  const enLinea = useSyncExternalStore(suscribirConexion, estaEnLinea, () => true)
  const {
    needRefresh: [hayActualizacion, setHayActualizacion],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(error) {
      console.error('No se pudo registrar el service worker:', error)
    },
  })

  if (enLinea && !hayActualizacion) return null

  return (
    <div className="estado-conexion" role="status">
      {!enLinea && (
        <CAlert color="warning" className="mb-2 shadow-sm small">
          <strong>Sin conexión.</strong> Se muestra lo que ya habías abierto; los cambios no se
          pueden guardar hasta que vuelva la conexión.
        </CAlert>
      )}
      {hayActualizacion && (
        <CAlert
          color="info"
          dismissible
          onClose={() => setHayActualizacion(false)}
          className="mb-2 shadow-sm small d-flex align-items-center gap-2"
        >
          <span className="me-auto">Hay una nueva versión de la plataforma.</span>
          <CButton color="info" size="sm" onClick={() => updateServiceWorker(true)}>
            Actualizar
          </CButton>
        </CAlert>
      )}
    </div>
  )
}

export default EstadoConexion
