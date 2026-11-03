import { useState } from 'react'
import PropTypes from 'prop-types'
import {
  CAlert,
  CBadge,
  CButton,
  CModal,
  CModalBody,
  CModalFooter,
  CModalHeader,
  CModalTitle,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilTrash } from '@coreui/icons'
import { tiempoRelativo } from 'src/components/notificaciones/textoNotificacion'

const ROLES = {
  admin: { etiqueta: 'Admin', color: 'primary' },
  profesor: { etiqueta: 'Docente', color: 'info' },
  alumno: { etiqueta: 'Alumno', color: 'secondary' },
}

const textoAcceso = (fecha) => (fecha ? tiempoRelativo(fecha) : 'Nunca')

/**
 * Tabla de integrantes de una organización o asignatura. En pantallas pequeñas la columna de
 * último acceso pasa a una línea bajo el correo para dejar espacio al rol y las acciones.
 */
const TablaIntegrantes = ({
  integrantes,
  idUsuarioActual,
  etiquetaAcceso,
  puedeQuitar,
  onQuitar,
  describirQuitar,
  textoVacio,
}) => {
  const [aQuitar, setAQuitar] = useState(null)
  const [quitando, setQuitando] = useState(false)
  const [error, setError] = useState('')

  const conAcceso = Boolean(etiquetaAcceso)
  const conAcciones = integrantes.some((i) => puedeQuitar?.(i))
  const columnas = 2 + (conAcceso ? 1 : 0) + (conAcciones ? 1 : 0)

  const cerrar = () => {
    if (quitando) return
    setAQuitar(null)
    setError('')
  }

  const confirmar = async () => {
    setQuitando(true)
    setError('')
    try {
      await onQuitar(aQuitar)
      setAQuitar(null)
    } catch (err) {
      setError(err.message || 'No se pudo quitar al usuario.')
    } finally {
      setQuitando(false)
    }
  }

  return (
    <>
      <CTable hover responsive align="middle" className="tabla-integrantes border mb-0 mt-2">
        <CTableHead color="light">
          <CTableRow>
            <CTableHeaderCell scope="col">Usuario</CTableHeaderCell>
            <CTableHeaderCell scope="col">Rol</CTableHeaderCell>
            {conAcceso && (
              <CTableHeaderCell scope="col" className="d-none d-md-table-cell">
                {etiquetaAcceso}
              </CTableHeaderCell>
            )}
            {conAcciones && (
              <CTableHeaderCell scope="col" className="text-end">
                <span className="visually-hidden">Acciones</span>
              </CTableHeaderCell>
            )}
          </CTableRow>
        </CTableHead>
        <CTableBody>
          {integrantes.map((integrante) => {
            const rol = ROLES[integrante.rol] ?? ROLES.alumno
            const esActual = String(integrante._id) === String(idUsuarioActual)
            return (
              <CTableRow key={integrante._id}>
                <CTableDataCell className="tabla-integrantes-usuario">
                  <div className="fw-semibold text-truncate" title={integrante.nombre}>
                    {integrante.nombre}
                    {esActual && <span className="fw-normal text-body-secondary"> (tú)</span>}
                  </div>
                  <div
                    className="small text-body-secondary text-truncate"
                    title={integrante.correo}
                  >
                    {integrante.correo}
                  </div>
                  {conAcceso && (
                    <div className="small text-body-secondary d-md-none">
                      {etiquetaAcceso}: {textoAcceso(integrante.acceso)}
                    </div>
                  )}
                </CTableDataCell>
                <CTableDataCell>
                  <CBadge color={rol.color} shape="rounded-pill">
                    {rol.etiqueta}
                  </CBadge>
                </CTableDataCell>
                {conAcceso && (
                  <CTableDataCell className="d-none d-md-table-cell small text-body-secondary text-nowrap">
                    {textoAcceso(integrante.acceso)}
                  </CTableDataCell>
                )}
                {conAcciones && (
                  <CTableDataCell className="text-end">
                    {puedeQuitar(integrante) && (
                      <CButton
                        color="danger"
                        variant="ghost"
                        size="sm"
                        title={esActual ? 'Salir' : 'Quitar'}
                        aria-label={`${esActual ? 'Salir' : 'Quitar a'} ${integrante.nombre}`}
                        onClick={() => setAQuitar(integrante)}
                      >
                        <CIcon icon={cilTrash} />
                      </CButton>
                    )}
                  </CTableDataCell>
                )}
              </CTableRow>
            )
          })}
          {integrantes.length === 0 && (
            <CTableRow>
              <CTableDataCell colSpan={columnas} className="text-center py-4 text-body-secondary">
                {textoVacio}
              </CTableDataCell>
            </CTableRow>
          )}
        </CTableBody>
      </CTable>

      <CModal visible={Boolean(aQuitar)} onClose={cerrar} alignment="center">
        <CModalHeader>
          <CModalTitle>
            {String(aQuitar?._id) === String(idUsuarioActual) ? 'Salir' : 'Quitar usuario'}
          </CModalTitle>
        </CModalHeader>
        <CModalBody>
          {aQuitar && <p className="mb-0">{describirQuitar(aQuitar)}</p>}
          {error && (
            <CAlert color="danger" className="mt-3 mb-0">
              {error}
            </CAlert>
          )}
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" variant="ghost" onClick={cerrar} disabled={quitando}>
            Cancelar
          </CButton>
          <CButton color="danger" onClick={confirmar} disabled={quitando}>
            {quitando && <CSpinner size="sm" className="me-1" />}
            {String(aQuitar?._id) === String(idUsuarioActual) ? 'Salir' : 'Quitar'}
          </CButton>
        </CModalFooter>
      </CModal>
    </>
  )
}

TablaIntegrantes.propTypes = {
  // rol: 'admin' | 'profesor' | 'alumno'; acceso: fecha del último acceso, o null
  integrantes: PropTypes.arrayOf(
    PropTypes.shape({
      _id: PropTypes.string.isRequired,
      nombre: PropTypes.string,
      correo: PropTypes.string,
      rol: PropTypes.string.isRequired,
      acceso: PropTypes.string,
    }),
  ).isRequired,
  idUsuarioActual: PropTypes.string,
  // sin etiqueta no se muestra la columna (quien consulta no tiene permiso para verla)
  etiquetaAcceso: PropTypes.string,
  puedeQuitar: PropTypes.func,
  onQuitar: PropTypes.func,
  describirQuitar: PropTypes.func,
  textoVacio: PropTypes.string,
}

export default TablaIntegrantes
