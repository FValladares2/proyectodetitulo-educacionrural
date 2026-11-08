import React, { useEffect, useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import {
  CAlert,
  CBadge,
  CCol,
  CFormInput,
  CFormSelect,
  CInputGroup,
  CInputGroupText,
  CProgress,
  CProgressStacked,
  CRow,
  CSpinner,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
  CTooltip,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilSearch, cilWarning } from '@coreui/icons'
import { getAlmacenamientoOrg } from 'src/services/orgServices'
import { formatearTamano } from 'src/services/recursoServices'

// asignaturas con color propio en la barra; el resto se agrupa en "Otras asignaturas"
const MAX_SEGMENTOS_ASIGNATURA = 5
const UMBRAL_ADVERTENCIA = 0.75
const UMBRAL_CRITICO = 0.9

const formatoPorcentaje = new Intl.NumberFormat('es-CL', {
  style: 'percent',
  maximumFractionDigits: 1,
})

const ORDENES = {
  tamano_desc: (a, b) => b.total.tamano - a.total.tamano,
  tamano_asc: (a, b) => a.total.tamano - b.total.tamano,
  archivos_desc: (a, b) => b.total.archivos - a.total.archivos,
  nombre_asc: (a, b) => a.nombre.localeCompare(b.nombre, 'es'),
}

/**
 * Segmentos de la barra, en este orden: las asignaturas más grandes, los archivos de la
 * organización, las demás asignaturas, la diferencia por codificación y cifrado. Lo que queda
 * hasta el límite es el espacio libre. El orden de los colores está validado para daltonismo.
 */
const armarSegmentos = ({ asignaturas, organizacion, total }) => {
  const conArchivos = asignaturas.filter((a) => a.total.tamano > 0).sort(ORDENES.tamano_desc)
  const segmentos = conArchivos.slice(0, MAX_SEGMENTOS_ASIGNATURA).map((a, i) => ({
    clave: a._id,
    etiqueta: a.nombre,
    bytes: a.total.tamano,
    clase: `almacenamiento-serie-${i + 1}`,
  }))
  if (organizacion.tamano > 0) {
    segmentos.push({
      clave: 'organizacion',
      etiqueta: 'Archivos de la organización',
      bytes: organizacion.tamano,
      clase: 'almacenamiento-organizacion',
    })
  }
  const otras = conArchivos.slice(MAX_SEGMENTOS_ASIGNATURA)
  if (otras.length > 0) {
    segmentos.push({
      clave: 'otras',
      etiqueta: `Otras asignaturas (${otras.length})`,
      bytes: otras.reduce((suma, a) => suma + a.total.tamano, 0),
      clase: 'almacenamiento-otras',
    })
  }
  const sobrecarga = total.almacenado - total.tamano
  if (sobrecarga > 0) {
    segmentos.push({
      clave: 'cifrado',
      etiqueta: 'Codificación y cifrado',
      bytes: sobrecarga,
      clase: 'almacenamiento-cifrado',
    })
  }
  return segmentos
}

const Muestra = ({ clase }) => (
  <span className={`almacenamiento-muestra ${clase}`} aria-hidden="true" />
)
Muestra.propTypes = { clase: PropTypes.string.isRequired }

const BarraAlmacenamiento = ({ datos }) => {
  const { limite, total } = datos
  const segmentos = useMemo(() => armarSegmentos(datos), [datos])
  // si se superó el límite, la barra se escala al total para que todo quepa
  const escala = Math.max(limite, total.almacenado) || 1
  const usado = total.almacenado / limite
  const libre = Math.max(limite - total.almacenado, 0)

  return (
    <>
      <div className="d-flex flex-wrap align-items-baseline justify-content-between gap-2 mb-2">
        <div>
          <span className="fs-4 fw-semibold">{formatearTamano(total.almacenado)}</span>{' '}
          <span className="text-body-secondary">
            usados de {formatearTamano(limite)} ({formatoPorcentaje.format(usado)})
          </span>
        </div>
        <span className="small text-body-secondary">
          {total.archivos} {total.archivos === 1 ? 'archivo' : 'archivos'}
        </span>
      </div>

      {usado >= UMBRAL_ADVERTENCIA && (
        <CAlert
          color={usado >= UMBRAL_CRITICO ? 'danger' : 'warning'}
          className="d-flex align-items-center gap-2 small py-2"
        >
          <CIcon icon={cilWarning} className="flex-shrink-0" />
          <span>
            {usado >= 1
              ? 'Se alcanzó el límite de almacenamiento. Elimina archivos que ya no se usen, por ejemplo de asignaturas inactivas.'
              : 'El almacenamiento está por llenarse. Considera eliminar archivos que ya no se usen, por ejemplo de asignaturas inactivas.'}
          </span>
        </CAlert>
      )}

      <CProgressStacked className="barra-almacenamiento mb-3">
        {segmentos.map((segmento) => (
          <CTooltip
            key={segmento.clave}
            content={`${segmento.etiqueta}: ${formatearTamano(segmento.bytes)}`}
          >
            <CProgress
              value={(segmento.bytes / escala) * 100}
              progressBarClassName={segmento.clase}
              aria-label={`${segmento.etiqueta}: ${formatearTamano(segmento.bytes)}`}
            />
          </CTooltip>
        ))}
      </CProgressStacked>

      <ul className="list-unstyled d-flex flex-wrap gap-3 small mb-2">
        {segmentos.map((segmento) => (
          <li key={segmento.clave} className="d-flex align-items-center gap-2 min-w-0">
            <Muestra clase={segmento.clase} />
            <span className="text-truncate" title={segmento.etiqueta}>
              {segmento.etiqueta}
            </span>
            <span className="text-body-secondary text-nowrap">
              {formatearTamano(segmento.bytes)}
            </span>
          </li>
        ))}
        <li className="d-flex align-items-center gap-2">
          <Muestra clase="almacenamiento-libre" />
          <span>Disponible</span>
          <span className="text-body-secondary text-nowrap">{formatearTamano(libre)}</span>
        </li>
      </ul>
      <p className="small text-body-secondary mb-0">
        Los tamaños corresponden a los archivos originales. En la base de datos ocupan algo más por
        la codificación y el cifrado que los protegen; esa diferencia se muestra aparte. El límite
        es de {formatearTamano(limite)} por organización.
      </p>
    </>
  )
}
BarraAlmacenamiento.propTypes = { datos: PropTypes.object.isRequired }

const TablaAlmacenamiento = ({ asignaturas, organizacion, totalTamano }) => {
  const [busqueda, setBusqueda] = useState('')
  const [estado, setEstado] = useState('all')
  const [orden, setOrden] = useState('tamano_desc')

  const filas = useMemo(() => {
    const texto = busqueda.trim().toLocaleLowerCase('es')
    return asignaturas
      .filter((a) => estado === 'all' || String(a.activo) === estado)
      .filter((a) => !texto || a.nombre.toLocaleLowerCase('es').includes(texto))
      .sort(ORDENES[orden])
  }, [asignaturas, busqueda, estado, orden])

  const proporcion = (bytes) =>
    totalTamano > 0 ? formatoPorcentaje.format(bytes / totalTamano) : '—'

  return (
    <>
      <div className="p-3 mb-3 rounded bg-body-tertiary border">
        <CRow className="g-3 align-items-center">
          <CCol xs={12} md={6}>
            <CInputGroup>
              <CInputGroupText>
                <CIcon icon={cilSearch} size="sm" />
              </CInputGroupText>
              <CFormInput
                placeholder="Buscar asignatura..."
                aria-label="Buscar asignatura"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </CInputGroup>
          </CCol>
          <CCol xs={6} md={3}>
            <CFormSelect
              aria-label="Filtrar por estado"
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
            >
              <option value="all">Todos los estados</option>
              <option value="true">Solo activas</option>
              <option value="false">Solo inactivas</option>
            </CFormSelect>
          </CCol>
          <CCol xs={6} md={3}>
            <CFormSelect
              aria-label="Ordenar asignaturas"
              value={orden}
              onChange={(e) => setOrden(e.target.value)}
            >
              <option value="tamano_desc">Mayor tamaño</option>
              <option value="tamano_asc">Menor tamaño</option>
              <option value="archivos_desc">Más archivos</option>
              <option value="nombre_asc">Nombre (A - Z)</option>
            </CFormSelect>
          </CCol>
        </CRow>
      </div>

      <CTable hover responsive align="middle" className="tabla-almacenamiento border mb-2">
        <CTableHead color="light">
          <CTableRow>
            <CTableHeaderCell scope="col">Asignatura</CTableHeaderCell>
            <CTableHeaderCell scope="col" className="d-none d-md-table-cell text-end">
              Archivos
            </CTableHeaderCell>
            <CTableHeaderCell scope="col" className="d-none d-md-table-cell text-end">
              Material
            </CTableHeaderCell>
            <CTableHeaderCell scope="col" className="d-none d-md-table-cell text-end">
              Entregas
            </CTableHeaderCell>
            <CTableHeaderCell scope="col" className="text-end">
              Total
            </CTableHeaderCell>
            <CTableHeaderCell scope="col" className="d-none d-sm-table-cell text-end">
              % del total
            </CTableHeaderCell>
          </CTableRow>
        </CTableHead>
        <CTableBody>
          {filas.length === 0 && (
            <CTableRow>
              <CTableDataCell colSpan={6} className="text-center text-body-secondary py-4">
                No hay asignaturas que coincidan con los filtros.
              </CTableDataCell>
            </CTableRow>
          )}
          {filas.map((a) => (
            <CTableRow key={a._id}>
              <CTableDataCell className="tabla-almacenamiento-nombre">
                <div className="d-flex align-items-center gap-2 min-w-0">
                  <span className="fw-semibold text-truncate" title={a.nombre}>
                    {a.nombre}
                  </span>
                  {!a.activo && (
                    <CBadge color="secondary" shape="rounded-pill" className="flex-shrink-0">
                      Inactiva
                    </CBadge>
                  )}
                </div>
                <div className="small text-body-secondary d-md-none">
                  Material {formatearTamano(a.material.tamano)} · Entregas{' '}
                  {formatearTamano(a.entregas.tamano)} · {a.total.archivos}{' '}
                  {a.total.archivos === 1 ? 'archivo' : 'archivos'}
                </div>
              </CTableDataCell>
              <CTableDataCell className="d-none d-md-table-cell text-end">
                {a.total.archivos}
              </CTableDataCell>
              <CTableDataCell className="d-none d-md-table-cell text-end text-nowrap">
                {formatearTamano(a.material.tamano)}
              </CTableDataCell>
              <CTableDataCell className="d-none d-md-table-cell text-end text-nowrap">
                {formatearTamano(a.entregas.tamano)}
              </CTableDataCell>
              <CTableDataCell className="text-end text-nowrap fw-semibold">
                {formatearTamano(a.total.tamano)}
              </CTableDataCell>
              <CTableDataCell className="d-none d-sm-table-cell text-end text-nowrap text-body-secondary">
                {proporcion(a.total.tamano)}
              </CTableDataCell>
            </CTableRow>
          ))}
        </CTableBody>
      </CTable>
      <p className="small text-body-secondary mb-0">
        Archivos generales de la organización (como imágenes de portada):{' '}
        {formatearTamano(organizacion.tamano)} en {organizacion.archivos}{' '}
        {organizacion.archivos === 1 ? 'archivo' : 'archivos'}.
      </p>
    </>
  )
}
TablaAlmacenamiento.propTypes = {
  asignaturas: PropTypes.array.isRequired,
  organizacion: PropTypes.object.isRequired,
  totalTamano: PropTypes.number.isRequired,
}

/** Pestaña de almacenamiento del área Organización; solo para administradores. */
const AlmacenamientoOrganizacion = ({ idOrganizacion }) => {
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    // al cambiar de organización el componente se vuelve a montar (key), con el estado vacío
    const controller = new AbortController()
    getAlmacenamientoOrg(idOrganizacion, controller.signal).then(setDatos, (err) => {
      if (err.name !== 'AbortError') setError(err.message)
    })
    return () => controller.abort()
  }, [idOrganizacion])

  if (error) return <CAlert color="danger">{error}</CAlert>
  if (!datos) {
    return (
      <div className="text-center py-5">
        <CSpinner color="primary" />
        <p className="mt-2 text-body-secondary small">Calculando almacenamiento...</p>
      </div>
    )
  }

  return (
    <>
      <section className="mb-4" aria-labelledby="almacenamiento-uso">
        <h5 id="almacenamiento-uso" className="fw-semibold mb-3">
          Espacio usado
        </h5>
        <BarraAlmacenamiento datos={datos} />
      </section>
      <section aria-labelledby="almacenamiento-asignaturas">
        <h5 id="almacenamiento-asignaturas" className="fw-semibold mb-3">
          Por asignatura
        </h5>
        <TablaAlmacenamiento
          asignaturas={datos.asignaturas}
          organizacion={datos.organizacion}
          totalTamano={datos.total.tamano}
        />
      </section>
    </>
  )
}
AlmacenamientoOrganizacion.propTypes = { idOrganizacion: PropTypes.string.isRequired }

export default AlmacenamientoOrganizacion
