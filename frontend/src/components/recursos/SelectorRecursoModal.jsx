import { CButton, CModal, CModalBody, CModalFooter, CModalHeader, CModalTitle } from '@coreui/react'
import PropTypes from 'prop-types'
import { useCallback, useMemo } from 'react'
import ExploradorRecursos from './ExploradorRecursos'

const EXTENSIONES_IMAGEN = '.png,.jpg,.jpeg,.gif,.webp,.svg'

const esImagen = (recurso) => (recurso.mimetype || '').startsWith('image/')

const MODOS = {
  imagen: {
    tituloPorDefecto: 'Insertar imagen',
    filtro: esImagen,
    extensiones: EXTENSIONES_IMAGEN,
  },
  archivo: { tituloPorDefecto: 'Adjuntar recurso', filtro: undefined, extensiones: undefined },
}

// el explorador decide quién puede subir según "docentes"; en organizaciones son los admin
const aCarpeta = (contenedor, ambito) =>
  ambito === 'organizacion' ? { ...contenedor, docentes: contenedor.admin || [] } : contenedor

/**
 * Modal para elegir un recurso de una asignatura u organización. En modo "imagen" solo se
 * listan imágenes; en modo "archivo" se listan todos. Quien puede editar el contenedor
 * (docentes o administradores) también puede subir archivos desde el mismo modal.
 */
const SelectorRecursoModal = ({
  visible,
  onClose,
  contenedor,
  ambito = 'asignatura',
  modo = 'archivo',
  titulo,
  onSeleccionar,
  onQuitar,
}) => {
  const { tituloPorDefecto, filtro, extensiones } = MODOS[modo]
  const carpetas = useMemo(
    () => (contenedor ? [aCarpeta(contenedor, ambito)] : []),
    [contenedor, ambito],
  )

  const handleSeleccionar = useCallback(
    (recurso) => {
      onSeleccionar(recurso)
      onClose()
    },
    [onSeleccionar, onClose],
  )

  const handleQuitar = () => {
    onQuitar()
    onClose()
  }

  return (
    <CModal visible={visible} onClose={onClose} size="xl" alignment="center">
      <CModalHeader>
        <CModalTitle>{titulo || tituloPorDefecto}</CModalTitle>
      </CModalHeader>
      <CModalBody>
        <p className="text-body-secondary small mb-2">
          Haz doble clic en un archivo para seleccionarlo.
        </p>
        {/* se monta solo al abrir para que la lista de recursos esté actualizada */}
        {visible && contenedor && (
          <ExploradorRecursos
            asignaturas={carpetas}
            asignaturaId={String(contenedor._id)}
            ambito={ambito}
            onSeleccionarRecurso={handleSeleccionar}
            filtroRecurso={filtro}
            acceptedFileTypes={extensiones}
            height="60vh"
          />
        )}
      </CModalBody>
      {onQuitar && (
        <CModalFooter>
          <CButton color="danger" variant="outline" onClick={handleQuitar}>
            Quitar imagen
          </CButton>
        </CModalFooter>
      )}
    </CModal>
  )
}

SelectorRecursoModal.propTypes = {
  visible: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  /** Asignatura { _id, nombre, docentes } u organización { _id, nombre, admin } */
  contenedor: PropTypes.object,
  ambito: PropTypes.oneOf(['asignatura', 'organizacion']),
  modo: PropTypes.oneOf(['imagen', 'archivo']),
  titulo: PropTypes.string,
  /** Se llama con el recurso elegido; el modal se cierra después */
  onSeleccionar: PropTypes.func.isRequired,
  /** Si se entrega, muestra un botón para quitar la imagen actual */
  onQuitar: PropTypes.func,
}

export default SelectorRecursoModal
