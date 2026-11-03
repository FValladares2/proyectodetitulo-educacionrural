/**
 * AppHeader Component
 *
 * Main application header with navigation, theme switcher, and user menu.
 * Features include:
 * - Sidebar toggle button
 * - Search button with keyboard shortcut and recent searches modal
 * - Primary navigation links
 * - Notification and action icons
 * - Theme switcher (light/dark/auto)
 * - User dropdown menu
 * - Breadcrumb navigation
 * - Sticky positioning with scroll shadow effect
 *
 * @component
 * @example
 * return (
 *   <AppHeader />
 * )
 */

import React, { useEffect, useRef, useState } from 'react'
import { useSelector, useDispatch } from 'react-redux'
import {
  CBadge,
  CContainer,
  CDropdown,
  CDropdownItem,
  CDropdownMenu,
  CDropdownToggle,
  CFormInput,
  CHeader,
  CHeaderNav,
  CHeaderToggler,
  CListGroup,
  CListGroupItem,
  CModal,
  CModalBody,
  CModalHeader,
  CModalTitle,
  CNavLink,
  CNavItem,
  CSearchButton,
  useColorModes,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilContrast, cilMenu, cilMoon, cilSun, cilInfo, cilEducation } from '@coreui/icons'

import { AppBreadcrumb } from './index'
import NotificacionesHeader from './notificaciones/NotificacionesHeader'
import UsuarioHeader from './header/UsuarioHeader'

/**
 * AppHeader functional component
 *
 * Manages header UI including:
 * - Redux integration for sidebar state
 * - Theme management with CoreUI useColorModes hook
 * - Scroll-based shadow effect
 * - Responsive navigation
 *
 * @returns {React.ReactElement} Header component with navigation and controls
 */
// en pantallas bajas (teléfonos en horizontal) solo la barra superior queda fija; las migas
// se desplazan con la página para dejar el alto al contenido
const PANTALLA_BAJA = '(max-height: 500px)'

const AppHeader = () => {
  const headerRef = useRef()
  const migasRef = useRef()
  const { colorMode, setColorMode } = useColorModes('coreui-free-react-admin-template-theme')
  const [searchVisible, setSearchVisible] = useState(false)

  const dispatch = useDispatch()
  const sidebarShow = useSelector((state) => state.sidebarShow)

  // publica el alto de lo que queda fijo arriba (--app-breadcrumb-offset), del que dependen la
  // barra de la asignatura, la barra del editor y el desplazamiento a los títulos
  useEffect(() => {
    const raiz = document.documentElement
    const pantallaBaja = window.matchMedia(PANTALLA_BAJA)

    const actualizar = () => {
      const barra = headerRef.current?.offsetHeight ?? 0
      const migas = pantallaBaja.matches ? 0 : (migasRef.current?.offsetHeight ?? 0)
      raiz.style.setProperty('--app-topbar-alto', `${barra}px`)
      raiz.style.setProperty('--app-breadcrumb-offset', `${barra + migas}px`)
    }
    // la sombra va bajo el último elemento fijo
    const handleScroll = () => {
      const desplazado = raiz.scrollTop > 0
      headerRef.current?.classList.toggle('shadow-sm', desplazado && pantallaBaja.matches)
      migasRef.current?.classList.toggle('shadow-sm', desplazado && !pantallaBaja.matches)
    }
    const alCambiar = () => {
      actualizar()
      handleScroll()
    }

    const observador = new ResizeObserver(actualizar)
    if (headerRef.current) observador.observe(headerRef.current)
    if (migasRef.current) observador.observe(migasRef.current)
    pantallaBaja.addEventListener('change', alCambiar)
    document.addEventListener('scroll', handleScroll)
    alCambiar()
    return () => {
      observador.disconnect()
      pantallaBaja.removeEventListener('change', alCambiar)
      document.removeEventListener('scroll', handleScroll)
    }
  }, [])

  return (
    <>
      <CHeader position="sticky" className="p-0" ref={headerRef}>
        <CContainer className="px-2 px-sm-4" fluid>
          <CHeaderToggler
            onClick={() => dispatch({ type: 'set', sidebarShow: !sidebarShow })}
            style={{ marginInlineStart: '-14px' }}
          >
            <CIcon icon={cilMenu} size="lg" />
          </CHeaderToggler>

          <CHeaderNav className="ms-auto">
            <NotificacionesHeader />
            <CNavItem>
              <CNavLink href="#/organizacion">
                <CIcon icon={cilEducation} size="lg" />
              </CNavLink>
            </CNavItem>
            <UsuarioHeader />
          </CHeaderNav>

          <CHeaderNav>
            <li className="nav-item py-1">
              <div className="vr h-100 mx-2 text-body text-opacity-75"></div>
            </li>
            <CDropdown variant="nav-item" placement="bottom-end">
              <CDropdownToggle caret={false}>
                {colorMode === 'dark' ? (
                  <CIcon icon={cilMoon} size="lg" />
                ) : colorMode === 'auto' ? (
                  <CIcon icon={cilContrast} size="lg" />
                ) : (
                  <CIcon icon={cilSun} size="lg" />
                )}
              </CDropdownToggle>
              <CDropdownMenu>
                <CDropdownItem
                  active={colorMode === 'light'}
                  className="d-flex align-items-center"
                  as="button"
                  type="button"
                  onClick={() => setColorMode('light')}
                >
                  <CIcon className="me-2" icon={cilSun} size="lg" /> Claro
                </CDropdownItem>
                <CDropdownItem
                  active={colorMode === 'dark'}
                  className="d-flex align-items-center"
                  as="button"
                  type="button"
                  onClick={() => setColorMode('dark')}
                >
                  <CIcon className="me-2" icon={cilMoon} size="lg" /> Oscuro
                </CDropdownItem>
                <CDropdownItem
                  active={colorMode === 'auto'}
                  className="d-flex align-items-center"
                  as="button"
                  type="button"
                  onClick={() => setColorMode('auto')}
                >
                  <CIcon className="me-2" icon={cilContrast} size="lg" /> Automático
                </CDropdownItem>
              </CDropdownMenu>
            </CDropdown>
          </CHeaderNav>
        </CContainer>
      </CHeader>
      {/* fuera del encabezado para que pueda dejar de ser fija sin arrastrar la barra superior */}
      <div className="app-migas mb-4" ref={migasRef}>
        <CContainer className="px-2 px-sm-4" fluid>
          <AppBreadcrumb />
        </CContainer>
      </div>
    </>
  )
}

export default AppHeader
