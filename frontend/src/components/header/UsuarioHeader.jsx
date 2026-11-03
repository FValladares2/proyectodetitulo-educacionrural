import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CAvatar,
  CBadge,
  CDropdown,
  CDropdownDivider,
  CDropdownItem,
  CDropdownMenu,
  CDropdownToggle,
  CSpinner,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilAccountLogout, cilSettings, cilUser } from '@coreui/icons'
import { getAuthUser } from 'src/services/authServices'
import { getInitialOrgId, getOrgsWithUser } from 'src/services/orgServices'

const ROLES = {
  admin: { etiqueta: 'Administrador', color: 'primary' },
  profesor: { etiqueta: 'Docente', color: 'info' },
  alumno: { etiqueta: 'Alumno', color: 'secondary' },
}

const iniciales = (nombre = '') =>
  nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0].toUpperCase())
    .join('') || '?'

/**
 * Menú del usuario en el encabezado: nombre, correo, organización actual y su rol en ella, con
 * accesos a Configuración y a cerrar sesión. Los datos se leen al abrirlo, así refleja los
 * cambios del perfil o de organización sin recargar.
 */
const UsuarioHeader = () => {
  const navigate = useNavigate()
  const [usuario, setUsuario] = useState(null)
  const [organizacion, setOrganizacion] = useState({ estado: 'cargando', datos: null })

  const handleAbrir = async () => {
    setUsuario(getAuthUser())
    const orgId = getInitialOrgId()
    const orgs = await getOrgsWithUser()
    const actual = (orgs || []).find((o) => String(o._id) === String(orgId))
    setOrganizacion({ estado: orgs ? 'lista' : 'error', datos: actual ?? null })
  }

  const rol = ROLES[organizacion.datos?.rol]

  return (
    <CDropdown variant="nav-item" placement="bottom-end" onShow={handleAbrir}>
      <CDropdownToggle caret={false} aria-label="Menú del usuario">
        <CIcon icon={cilUser} size="lg" />
      </CDropdownToggle>
      <CDropdownMenu className="usuario-menu pt-0">
        <div className="d-flex align-items-center gap-3 px-3 py-3 border-bottom">
          <CAvatar color="primary" textColor="white" size="md" className="flex-shrink-0">
            {iniciales(usuario?.nombre)}
          </CAvatar>
          <div className="min-w-0">
            <div className="fw-semibold text-truncate" title={usuario?.nombre}>
              {usuario?.nombre || 'Usuario'}
            </div>
            <div className="small text-body-secondary text-truncate" title={usuario?.correo}>
              {usuario?.correo}
            </div>
          </div>
        </div>

        <div className="px-3 py-2 border-bottom small">
          <div className="text-body-secondary">Organización actual</div>
          {organizacion.estado === 'cargando' ? (
            <CSpinner size="sm" className="mt-1" />
          ) : organizacion.datos ? (
            <div className="d-flex align-items-center gap-2 mt-1">
              <span className="fw-semibold text-truncate" title={organizacion.datos.nombre}>
                {organizacion.datos.nombre}
              </span>
              {rol && (
                <CBadge color={rol.color} shape="rounded-pill" className="flex-shrink-0">
                  {rol.etiqueta}
                </CBadge>
              )}
            </div>
          ) : (
            <div className="mt-1">
              {organizacion.estado === 'error' ? 'No disponible sin conexión.' : 'Ninguna'}
            </div>
          )}
        </div>

        <CDropdownItem
          as="button"
          type="button"
          className="d-flex align-items-center mt-2"
          onClick={() => navigate('/configuracion')}
        >
          <CIcon icon={cilSettings} className="me-2" /> Configuración
        </CDropdownItem>
        <CDropdownDivider />
        <CDropdownItem
          as="button"
          type="button"
          className="d-flex align-items-center"
          onClick={() => navigate('/logout')}
        >
          <CIcon icon={cilAccountLogout} className="me-2" /> Cerrar sesión
        </CDropdownItem>
      </CDropdownMenu>
    </CDropdown>
  )
}

export default UsuarioHeader
