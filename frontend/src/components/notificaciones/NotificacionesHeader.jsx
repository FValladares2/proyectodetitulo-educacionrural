import {
  CBadge,
  CButton,
  CDropdown,
  CDropdownItem,
  CDropdownMenu,
  CDropdownToggle,
  CSpinner,
} from '@coreui/react'
import { useCallback, useEffect, useState } from 'react'
import { FaRegBell } from 'react-icons/fa6'
import { Link, useNavigate } from 'react-router-dom'
import {
  fetchCantidadNoLeidas,
  fetchNotificaciones,
  marcarNotificacionLeida,
  marcarTodasLeidas,
} from 'src/services/notificacionServices'
import { describirNotificacion, tiempoRelativo } from './textoNotificacion'

// el contador se actualiza cada este tiempo, al volver a la pestaña y al recuperar la conexión
const INTERVALO_CONTADOR_MS = 90 * 1000

/**
 * Campana del encabezado: muestra cuántas notificaciones no se han leído y, al abrirla, las
 * más recientes. Al elegir una se marca como leída y se navega a su destino.
 */
const NotificacionesHeader = () => {
  const navigate = useNavigate()
  const [noLeidas, setNoLeidas] = useState(0)
  const [lista, setLista] = useState(null)
  const [abierto, setAbierto] = useState(false)
  const [error, setError] = useState('')

  const actualizarContador = useCallback(() => {
    if (document.visibilityState === 'hidden') return
    fetchCantidadNoLeidas()
      .then(setNoLeidas)
      .catch(() => {
        // sin conexión o sesión vencida: se mantiene el último valor conocido
      })
  }, [])

  useEffect(() => {
    actualizarContador()
    const intervalo = setInterval(actualizarContador, INTERVALO_CONTADOR_MS)
    window.addEventListener('focus', actualizarContador)
    window.addEventListener('online', actualizarContador)
    document.addEventListener('visibilitychange', actualizarContador)
    return () => {
      clearInterval(intervalo)
      window.removeEventListener('focus', actualizarContador)
      window.removeEventListener('online', actualizarContador)
      document.removeEventListener('visibilitychange', actualizarContador)
    }
  }, [actualizarContador])

  const handleAbrir = () => {
    setAbierto(true)
    setError('')
    fetchNotificaciones()
      .then((data) => {
        setLista(data.notificaciones)
        setNoLeidas(data.noLeidas)
      })
      .catch((err) => setError(err.message))
  }

  const handleElegir = (notificacion) => {
    setAbierto(false)
    if (!notificacion.leida) {
      setNoLeidas((n) => Math.max(0, n - 1))
      setLista((actual) =>
        actual?.map((n) => (n._id === notificacion._id ? { ...n, leida: true } : n)),
      )
      marcarNotificacionLeida(notificacion._id).catch(() => {})
    }
    navigate(notificacion.ruta || '/hogar')
  }

  const handleMarcarTodas = () => {
    setNoLeidas(0)
    setLista((actual) => actual?.map((n) => ({ ...n, leida: true })))
    marcarTodasLeidas().catch(() => actualizarContador())
  }

  const etiqueta = noLeidas > 0 ? `Notificaciones, ${noLeidas} sin leer` : 'Notificaciones'

  return (
    // "outside": marcar todas no cierra el panel; elegir una notificación sí (setAbierto)
    <CDropdown
      variant="nav-item"
      placement="bottom-end"
      autoClose="outside"
      visible={abierto}
      onShow={handleAbrir}
      onHide={() => setAbierto(false)}
    >
      <CDropdownToggle caret={false} className="position-relative" aria-label={etiqueta}>
        <FaRegBell size={18} aria-hidden="true" />
        {noLeidas > 0 && (
          <CBadge
            color="danger"
            shape="rounded-pill"
            className="position-absolute top-0 start-100 translate-middle notificaciones-contador"
          >
            {noLeidas > 99 ? '99+' : noLeidas}
          </CBadge>
        )}
      </CDropdownToggle>

      <CDropdownMenu className="notificaciones-menu p-0">
        <div className="d-flex align-items-center justify-content-between px-3 py-2 border-bottom">
          <span className="fw-semibold">Notificaciones</span>
          {noLeidas > 0 && (
            <CButton color="link" size="sm" className="p-0" onClick={handleMarcarTodas}>
              Marcar todas como leídas
            </CButton>
          )}
        </div>

        <div className="notificaciones-lista">
          {error ? (
            <p className="text-danger small px-3 py-3 mb-0">{error}</p>
          ) : !lista ? (
            <div className="text-center py-4">
              <CSpinner size="sm" />
            </div>
          ) : lista.length === 0 ? (
            <p className="text-body-secondary small px-3 py-4 mb-0 text-center">
              No tienes notificaciones.
            </p>
          ) : (
            lista.map((notificacion) => {
              const { Icono, texto } = describirNotificacion(notificacion)
              return (
                <CDropdownItem
                  key={notificacion._id}
                  as="button"
                  type="button"
                  onClick={() => handleElegir(notificacion)}
                  className={`notificacion-item ${notificacion.leida ? '' : 'no-leida'}`}
                >
                  <Icono className="notificacion-icono" aria-hidden="true" />
                  <span className="notificacion-cuerpo">
                    <span className="notificacion-texto">{texto}</span>
                    <span className="notificacion-fecha">
                      {tiempoRelativo(notificacion.creado_en)}
                    </span>
                  </span>
                  {!notificacion.leida && (
                    <span className="notificacion-punto" aria-label="Sin leer" />
                  )}
                </CDropdownItem>
              )
            })
          )}
        </div>

        <div className="border-top px-3 py-2 small">
          <Link to="/configuracion" onClick={() => setAbierto(false)}>
            Configurar avisos por correo
          </Link>
        </div>
      </CDropdownMenu>
    </CDropdown>
  )
}

export default NotificacionesHeader
