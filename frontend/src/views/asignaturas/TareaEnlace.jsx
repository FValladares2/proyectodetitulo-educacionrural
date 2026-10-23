import { CBadge } from '@coreui/react'
import PropTypes from 'prop-types'
import { useContext } from 'react'
import { FaRegClipboard } from 'react-icons/fa6'
import { insigniaTarea } from 'src/components/tareas/tareaFechas'
import { TareasAsignaturaContext } from './tareaMarkdown'

/**
 * Enlace a una tarea dentro del markup, con aspecto de "chip" para distinguirlo de un enlace
 * común. Muestra el título y estado actuales (no el texto guardado en el markup), y abre el
 * modal de la tarea.
 */
const TareaEnlace = ({ tareaId, children }) => {
  const { tareas, estado, abrirTarea } = useContext(TareasAsignaturaContext)
  const tarea = tareas?.get(tareaId)

  if (estado === 'listo' && !tarea) {
    return (
      <span className="tarea-enlace tarea-enlace-no-disponible" title="La tarea fue eliminada">
        <FaRegClipboard aria-hidden="true" />
        {children} (no disponible)
      </span>
    )
  }

  const insignia = tarea ? insigniaTarea(tarea) : null
  return (
    <button
      type="button"
      className="tarea-enlace"
      onClick={() => abrirTarea(tareaId)}
      title="Abrir tarea"
    >
      <FaRegClipboard aria-hidden="true" />
      <span className="tarea-enlace-titulo">{tarea?.titulo ?? children}</span>
      {insignia && (
        <CBadge color={insignia.color} className="tarea-enlace-insignia">
          {insignia.texto}
        </CBadge>
      )}
    </button>
  )
}

TareaEnlace.propTypes = {
  tareaId: PropTypes.string.isRequired,
  children: PropTypes.node,
}

export default TareaEnlace
