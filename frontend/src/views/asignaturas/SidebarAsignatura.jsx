import {
  CBadge,
  CButton,
  CCloseButton,
  CNav,
  CNavItem,
  CNavLink,
  CSidebar,
  CSidebarHeader,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import PropTypes from 'prop-types'
import { NavLink } from 'react-router-dom'
import { insigniaTarea } from 'src/components/tareas/tareaFechas'

const SidebarAsignatura = ({
  headings = [],
  actions = [],
  tareas = null,
  onTareaSelect = () => {},
  onNuevaTarea,
  onHeadingSelect = () => {},
  mobileVisible = false,
  onMobileVisibleChange = () => {},
}) => {
  const content = (
    <div className="asignatura-sidebar-content">
      {actions.length > 0 && (
        <CNav className="flex-column gap-1 mb-3" aria-label="Acciones de la asignatura">
          {actions.map((action) => (
            <CNavItem key={action.name}>
              <CNavLink
                {...(action.to ? { as: NavLink, to: action.to } : { href: action.href || '#' })}
                onClick={action.onClick}
                className="d-flex align-items-center gap-2"
              >
                {action.icon && <CIcon icon={action.icon} />}
                {action.name}
              </CNavLink>
            </CNavItem>
          ))}
        </CNav>
      )}

      {/* lista de todas las tareas: los enlaces del markup son atajos, esta es la referencia */}
      {tareas && (tareas.length > 0 || onNuevaTarea) && (
        <>
          {actions.length > 0 && <hr />}
          <div className="d-flex align-items-center justify-content-between mb-2">
            <p className="small fw-semibold text-body-secondary mb-0">Tareas</p>
            {onNuevaTarea && (
              <CButton color="primary" variant="ghost" size="sm" onClick={onNuevaTarea}>
                + Nueva
              </CButton>
            )}
          </div>
          {tareas.length === 0 ? (
            <p className="small text-body-secondary mb-3">Aún no hay tareas.</p>
          ) : (
            <CNav className="flex-column gap-1 mb-3" aria-label="Tareas de la asignatura">
              {tareas.map((tarea) => {
                const insignia = insigniaTarea(tarea)
                return (
                  <CNavItem key={tarea._id}>
                    <CNavLink
                      as="button"
                      type="button"
                      onClick={() => onTareaSelect(tarea._id)}
                      className="asignatura-tarea-link w-100 text-start border-0 bg-transparent"
                    >
                      <span className="d-block text-break">{tarea.titulo}</span>
                      <CBadge color={insignia.color} className="fw-normal">
                        {insignia.texto}
                      </CBadge>
                    </CNavLink>
                  </CNavItem>
                )
              })}
            </CNav>
          )}
        </>
      )}

      {headings.length > 0 && (
        <>
          {(actions.length > 0 || tareas?.length > 0 || onNuevaTarea) && <hr />}
          <p className="small fw-semibold text-body-secondary mb-2">Contenido</p>
          <CNav
            className="asignatura-heading-nav flex-column gap-1"
            aria-label="Índice del contenido"
          >
            {headings.map((heading) => (
              <CNavItem key={heading.id}>
                <CNavLink
                  as="button"
                  type="button"
                  onClick={() => onHeadingSelect(heading.id)}
                  className={`asignatura-heading-link level-${Math.min(heading.level, 6)} w-100 text-start border-0 bg-transparent`}
                >
                  <span className="asignatura-heading-marker" aria-hidden="true" />
                  {heading.label}
                </CNavLink>
              </CNavItem>
            ))}
          </CNav>
        </>
      )}
    </div>
  )

  return (
    <>
      <aside
        className="asignatura-sidebar d-none d-lg-block"
        aria-label="Navegación de la asignatura"
      >
        <div className="border rounded p-3 bg-body">{content}</div>
      </aside>
      <CSidebar
        className="asignatura-mobile-sidebar d-lg-none"
        position="fixed"
        placement="end"
        visible={mobileVisible}
        onVisibleChange={onMobileVisibleChange}
      >
        <CSidebarHeader className="border-bottom justify-content-end">
          <CCloseButton
            aria-label="Cerrar menú de la asignatura"
            onClick={() => onMobileVisibleChange(false)}
          />
        </CSidebarHeader>
        <div className="asignatura-mobile-sidebar-content border p-3">{content}</div>
      </CSidebar>
    </>
  )
}

SidebarAsignatura.propTypes = {
  headings: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      level: PropTypes.number.isRequired,
    }),
  ),
  actions: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string.isRequired,
      icon: PropTypes.any,
      to: PropTypes.string,
      href: PropTypes.string,
      onClick: PropTypes.func,
    }),
  ),
  /** Tareas de la lista (con estado); null mientras cargan */
  tareas: PropTypes.arrayOf(PropTypes.object),
  onTareaSelect: PropTypes.func,
  /** Solo docentes: muestra el botón para crear una tarea */
  onNuevaTarea: PropTypes.func,
  onHeadingSelect: PropTypes.func,
  mobileVisible: PropTypes.bool,
  onMobileVisibleChange: PropTypes.func,
}

export default SidebarAsignatura
