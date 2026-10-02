import {
  BlockTypeSelect,
  BoldItalicUnderlineToggles,
  CreateLink,
  ListsToggle,
  MDXEditor,
  UndoRedo,
  headingsPlugin,
  linkDialogPlugin,
  linkPlugin,
  listsPlugin,
  markdownShortcutPlugin,
  quotePlugin,
  thematicBreakPlugin,
  toolbarPlugin,
} from '@mdxeditor/editor'
import PropTypes from 'prop-types'
import { useState } from 'react'
import '@mdxeditor/editor/style.css'

const spanishTranslations = {
  'contentArea.editableMarkdown': 'Markdown editable',
  'toolbar.toggleGroup': 'Cambiar grupo',
  'toolbar.undo': 'Deshacer {{shortcut}}',
  'toolbar.redo': 'Rehacer {{shortcut}}',
  'toolbar.bold': 'Negrita',
  'toolbar.removeBold': 'Quitar negrita',
  'toolbar.italic': 'Cursiva',
  'toolbar.removeItalic': 'Quitar cursiva',
  'toolbar.underline': 'Subrayado',
  'toolbar.removeUnderline': 'Quitar subrayado',
  'toolbar.bulletedList': 'Lista con viñetas',
  'toolbar.numberedList': 'Lista numerada',
  'toolbar.checkList': 'Lista de tareas',
  'toolbar.link': 'Crear enlace',
  'toolbar.blockTypes.paragraph': 'Párrafo',
  'toolbar.blockTypes.quote': 'Cita',
  'toolbar.blockTypes.heading': 'Encabezado {{level}}',
  'toolbar.blockTypes.level': '1',
  'toolbar.blockTypeSelect.selectBlockTypeTooltip': 'Seleccionar tamaño del bloque',
  'toolbar.blockTypeSelect.placeholder': 'Tamaño',
  'createLink.url': 'URL',
  'createLink.urlPlaceholder': 'Selecciona o pega una URL',
  'createLink.text': 'Texto del enlace',
  'createLink.textTooltip': 'Texto que se mostrará para el enlace',
  'createLink.title': 'Título del enlace',
  'createLink.titleTooltip': 'Atributo de título del enlace, visible al pasar el cursor',
  'createLink.saveTooltip': 'Establecer URL',
  'createLink.cancelTooltip': 'Cancelar cambio',
  'dialog.close': 'Cerrar',
  'dialogControls.save': 'Guardar',
  'dialogControls.cancel': 'Cancelar',
}

const translateToSpanish = (key, defaultValue, interpolations = {}) => {
  const translation = spanishTranslations[key] || defaultValue

  return translation.replace(/\{\{(\w+)\}\}/g, (placeholder, name) => {
    return interpolations[name] ?? placeholder
  })
}

const EditorAsignatura = ({ markup = '', onChange, onSave }) => {
  const [value, setValue] = useState(markup)

  const handleChange = (nextValue) => {
    setValue(nextValue)
    if (onChange) {
      onChange(nextValue)
    }
  }

  return (
    <div className="asignatura-editor d-flex flex-column gap-3">
      <MDXEditor
        markdown={value}
        onChange={handleChange}
        translation={translateToSpanish}
        plugins={[
          headingsPlugin(),
          listsPlugin(),
          linkPlugin(),
          linkDialogPlugin(),
          quotePlugin(),
          thematicBreakPlugin(),
          markdownShortcutPlugin(),
          toolbarPlugin({
            toolbarContents: () => (
              <>
                <UndoRedo />
                <BoldItalicUnderlineToggles />
                <BlockTypeSelect />
                <ListsToggle />
                <CreateLink />
              </>
            ),
          }),
        ]}
      />
    </div>
  )
}

EditorAsignatura.propTypes = {
  markup: PropTypes.string,
  onChange: PropTypes.func,
  onSave: PropTypes.func,
}

export default EditorAsignatura
