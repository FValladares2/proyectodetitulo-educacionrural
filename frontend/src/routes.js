import React from 'react'
import Logout from './views/authentication/logout/Logout'

// Application Views
const Dashboard = React.lazy(() => import('./views/dashboard/Dashboard'))
const Archivos = React.lazy(() => import('./views/archivos/Archivos'))
const Organizacion = React.lazy(() => import('./views/organizacion/Organizacion'))
const Asignaturas = React.lazy(() => import('./views/asignaturas/Asignaturas'))
const Configuracion = React.lazy(() => import('./views/configuracion/Configuracion'))

export const routes = [
  { path: '/', exact: true, name: 'Hogar' },
  { path: '/hogar', name: 'Hogar', element: Dashboard },
  { path: '/dashboard', name: 'Hogar', element: Dashboard },
  { path: '/archivos', name: 'Archivos', element: Archivos },
  { path: '/organizacion', name: 'Organización', element: Organizacion },
  { path: '/asignaturas', name: 'Asignaturas', element: Asignaturas },
  { path: '/configuracion', name: 'Configuración', element: Configuracion },
  { path: '/logout', name: 'Cerrar Sesión', element: Logout },
]

export default routes
