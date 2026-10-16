import { CAlert, CButton, CCardImage, CSpinner } from '@coreui/react'
import { cilPencil } from '@coreui/icons'
import CIcon from '@coreui/icons-react'
import PropTypes from 'prop-types'
import { useState } from 'react'
import placeholderImage from 'src/assets/images/react.jpg'
import SelectorRecursoModal from './SelectorRecursoModal'
import { crearRecursoSrc, useRecursoSrc } from './recursoSrc'

/**
 * Imagen superior de una tarjeta. img puede ser una URL o recurso:<id>; si falta o no carga
 * se muestra la imagen por defecto. Con puedeEditar aparece un botón para elegir otra imagen
 * entre los recursos del contenedor (asignatura u organización).
 */
const BannerRecurso = ({
  img,
  height = 160,
  className,
  puedeEditar = false,
  contenedor,
  ambito = 'asignatura',
  onCambiar,
}) => {
  const { url, estado } = useRecursoSrc(img)
  const [selectorVisible, setSelectorVisible] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  const guardar = async (nuevoImg) => {
    setGuardando(true)
    setError('')
    try {
      await onCambiar(nuevoImg)
    } catch (err) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  const handleEditar = (event) => {
    // las tarjetas pueden ser clickeables, y abrir el selector no debe navegar
    event.stopPropagation()
    setSelectorVisible(true)
  }

  return (
    <div className="banner-recurso position-relative">
      {/* con altura fija se reserva el espacio mientras carga; sin ella se usa la imagen por defecto */}
      {estado === 'cargando' && height ? (
        <div className={`card-img-top bg-body-secondary ${className || ''}`} style={{ height }} />
      ) : (
        <CCardImage
          orientation="top"
          src={estado !== 'listo' || !url ? placeholderImage : url}
          className={className}
          style={height ? { height, objectFit: 'cover', objectPosition: 'center' } : undefined}
        />
      )}

      {puedeEditar && (
        <>
          <CButton
            color="secondary"
            size="sm"
            className="position-absolute top-0 end-0 m-2 shadow-sm"
            onClick={handleEditar}
            disabled={guardando}
            aria-label="Cambiar imagen"
            title="Cambiar imagen"
          >
            {guardando ? <CSpinner size="sm" /> : <CIcon icon={cilPencil} />}
          </CButton>
          <SelectorRecursoModal
            visible={selectorVisible}
            onClose={() => setSelectorVisible(false)}
            contenedor={contenedor}
            ambito={ambito}
            modo="imagen"
            titulo="Cambiar imagen"
            onSeleccionar={(recurso) => guardar(crearRecursoSrc(recurso._id))}
            onQuitar={img ? () => guardar(null) : undefined}
          />
        </>
      )}

      {error && (
        <CAlert
          color="danger"
          dismissible
          onClose={() => setError('')}
          className="position-absolute bottom-0 start-0 end-0 m-2 py-1 small"
        >
          {error}
        </CAlert>
      )}
    </div>
  )
}

BannerRecurso.propTypes = {
  /** URL o recurso:<id>; vacío muestra la imagen por defecto */
  img: PropTypes.string,
  /** Altura fija con la imagen recortada; null mantiene la proporción original */
  height: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  className: PropTypes.string,
  puedeEditar: PropTypes.bool,
  /** Asignatura { _id, nombre, docentes } u organización { _id, nombre, admin } */
  contenedor: PropTypes.object,
  ambito: PropTypes.oneOf(['asignatura', 'organizacion']),
  /** Recibe el nuevo img (recurso:<id> o null); debe lanzar un error si no se pudo guardar */
  onCambiar: PropTypes.func,
}

export default BannerRecurso
