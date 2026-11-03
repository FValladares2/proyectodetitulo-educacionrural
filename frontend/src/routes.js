import React from 'react'
import Logout from './views/authentication/logout/Logout'

// Application Views
const Dashboard = React.lazy(() => import('./views/dashboard/Dashboard'))
const Archivos = React.lazy(() => import('./views/archivos/Archivos'))
const Organizacion = React.lazy(() => import('./views/organizacion/Organizacion'))
const Asignaturas = React.lazy(() => import('./views/asignaturas/Asignaturas'))
const Configuracion = React.lazy(() => import('./views/configuracion/Configuracion'))
const DetalleAsignatura = React.lazy(() => import('./views/asignaturas/DetalleAsignatura'))
const UsuariosAsignatura = React.lazy(() => import('./views/asignaturas/UsuariosAsignatura'))
const ConfiguracionAsignatura = React.lazy(
  () => import('./views/asignaturas/ConfiguracionAsignatura'),
)
const RevisionTarea = React.lazy(() => import('./views/asignaturas/RevisionTarea'))

export const routes = [
  { path: '/', exact: true, name: 'Hogar' },
  { path: '/hogar', name: 'Hogar', element: Dashboard },
  { path: '/dashboard', name: 'Hogar', element: Dashboard },
  { path: '/archivos', name: 'Archivos', element: Archivos },
  { path: '/organizacion', name: 'Organización', element: Organizacion },
  { path: '/asignaturas', name: 'Asignaturas', element: Asignaturas },
  { path: '/configuracion', name: 'Configuración', element: Configuracion },
  { path: '/logout', name: 'Cerrar Sesión', element: Logout },
  { path: '/asignaturas/:id/integrantes', name: 'Integrantes', element: UsuariosAsignatura },
  {
    path: '/asignaturas/:id/configuracion',
    name: 'Configuración',
    element: ConfiguracionAsignatura,
  },
  { path: '/asignaturas/:id/tareas/:idTarea', name: 'Revisión de tarea', element: RevisionTarea },
  { path: '/asignaturas/:id', name: 'Asignatura', element: DetalleAsignatura },
  { path: '/archivos/:id', name: 'Carpeta', element: Archivos },
]

export default routes
