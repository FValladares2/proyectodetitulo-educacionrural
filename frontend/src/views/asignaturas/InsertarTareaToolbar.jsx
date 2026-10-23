import {
  ButtonWithTooltip,
  activeEditor$,
  insertMarkdown$,
  useCellValue,
  usePublisher,
} from '@mdxeditor/editor'
import PropTypes from 'prop-types'
import { useState } from 'react'
import { FaRegClipboard } from 'react-icons/fa6'
import TareaFormModal from 'src/components/tareas/TareaFormModal'
import { escaparTextoEnlace } from './markdownUtils'
import { crearTareaHref } from './tareaMarkdown'

/**
 * Botón de la barra del editor que crea una tarea e inserta su enlace [título](tarea:<id>).
 * La tarea se crea al confirmar el formulario, aunque luego no se guarde el contenido; en ese
 * caso sigue disponible en la lista de tareas de la asignatura.
 */
const InsertarTareaToolbar = ({ idAsignatura }) => {
  const editor = useCellValue(activeEditor$)
  const insertMarkdown = usePublisher(insertMarkdown$)
  const [visible, setVisible] = useState(false)

  const handleGuardada = (tarea) => {
    const insertar = () =>
      insertMarkdown(`[${escaparTextoEnlace(tarea.titulo)}](${crearTareaHref(tarea._id)})`)
    // insertMarkdown$ no hace nada sin una selección, que se pierde al abrir el modal
    if (editor) {
      editor.focus(insertar)
    } else {
      insertar()
    }
  }

  return (
    <>
      <ButtonWithTooltip title="Crear tarea" onClick={() => setVisible(true)}>
        <FaRegClipboard size={18} />
      </ButtonWithTooltip>
      <TareaFormModal
        visible={visible}
        onClose={() => setVisible(false)}
        idAsignatura={idAsignatura}
        onGuardada={handleGuardada}
      />
    </>
  )
}

InsertarTareaToolbar.propTypes = {
  idAsignatura: PropTypes.string.isRequired,
}

export default InsertarTareaToolbar
