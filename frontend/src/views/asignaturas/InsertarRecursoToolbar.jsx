import {
  ButtonWithTooltip,
  activeEditor$,
  insertImage$,
  insertMarkdown$,
  useCellValue,
  usePublisher,
} from '@mdxeditor/editor'
import PropTypes from 'prop-types'
import { useState } from 'react'
import { FaPaperclip, FaRegImage } from 'react-icons/fa6'
import SelectorRecursoModal from 'src/components/recursos/SelectorRecursoModal'
import { crearRecursoSrc } from 'src/components/recursos/recursoSrc'

// evita que corchetes en el nombre del archivo rompan la sintaxis del enlace
const escaparTextoEnlace = (texto) => texto.replace(/[\\[\]]/g, '\\$&')

const sinExtension = (nombre) => nombre.replace(/\.[^.]+$/, '')

/**
 * Botones de la barra del editor para insertar imágenes y enlaces de descarga
 * a recursos de la asignatura, ambos referenciados como recurso:<id>.
 */
const InsertarRecursoToolbar = ({ asignatura }) => {
  const editor = useCellValue(activeEditor$)
  const insertImage = usePublisher(insertImage$)
  const insertMarkdown = usePublisher(insertMarkdown$)
  const [visible, setVisible] = useState(false)
  const [modo, setModo] = useState('imagen')

  const abrir = (nuevoModo) => {
    setModo(nuevoModo)
    setVisible(true)
  }

  const handleSeleccionar = (recurso) => {
    const src = crearRecursoSrc(recurso._id)
    const insertar = () => {
      if (modo === 'imagen') {
        insertImage({ src, altText: sinExtension(recurso.nombre) })
      } else {
        insertMarkdown(`[${escaparTextoEnlace(recurso.nombre)}](${src})`)
      }
    }
    // insertMarkdown$ no hace nada sin una selección, que se pierde al abrir el modal;
    // focus() restaura la última o, si no hay, deja el cursor al final del documento
    if (editor) {
      editor.focus(insertar)
    } else {
      insertar()
    }
  }

  return (
    <>
      <ButtonWithTooltip title="Insertar imagen de recursos" onClick={() => abrir('imagen')}>
        <FaRegImage size={18} />
      </ButtonWithTooltip>
      <ButtonWithTooltip title="Adjuntar recurso descargable" onClick={() => abrir('archivo')}>
        <FaPaperclip size={18} />
      </ButtonWithTooltip>
      <SelectorRecursoModal
        visible={visible}
        onClose={() => setVisible(false)}
        contenedor={asignatura}
        modo={modo}
        onSeleccionar={handleSeleccionar}
      />
    </>
  )
}

InsertarRecursoToolbar.propTypes = {
  asignatura: PropTypes.object,
}

export default InsertarRecursoToolbar
