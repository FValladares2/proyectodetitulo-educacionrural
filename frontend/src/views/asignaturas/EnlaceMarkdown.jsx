import { CSpinner } from '@coreui/react'
import PropTypes from 'prop-types'
import { useContext, useState } from 'react'
import IconoRecurso from 'src/components/recursos/IconoRecurso'
import { descargarRecurso } from '../../services/recursoServices'
import { getRecursoId } from 'src/components/recursos/recursoSrc'
import { RecursosAsignaturaContext } from './recursoMarkdown'
import TareaEnlace from './TareaEnlace'
import { getTareaId } from './tareaMarkdown'

// react-markdown entrega también el nodo hast, que no debe llegar al <a>
const EnlaceMarkdown = ({ href, children, node, ...props }) => {
  const recursoId = getRecursoId(href)
  const tareaId = getTareaId(href)
  const { recursos, estado } = useContext(RecursosAsignaturaContext)
  const [descargando, setDescargando] = useState(false)
  const [error, setError] = useState('')

  if (tareaId) {
    return <TareaEnlace tareaId={tareaId}>{children}</TareaEnlace>
  }

  if (!recursoId) {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    )
  }

  const recurso = recursos?.get(recursoId)

  if (estado === 'listo' && !recurso) {
    return (
      <span
        className="recurso-enlace recurso-enlace-no-disponible"
        title="El recurso fue eliminado"
      >
        <IconoRecurso nombre={recurso?.nombre} aria-hidden="true" />
        {children} (no disponible)
      </span>
    )
  }

  const handleClick = async () => {
    setDescargando(true)
    setError('')
    try {
      // si no se pudieron cargar los metadatos se usa el texto del enlace como nombre
      const nombre = recurso?.nombre ?? (typeof children === 'string' ? children : 'recurso')
      await descargarRecurso({ _id: recursoId, nombre })
    } catch (err) {
      setError(err.message)
    } finally {
      setDescargando(false)
    }
  }

  return (
    <>
      <button
        type="button"
        className="recurso-enlace"
        onClick={handleClick}
        disabled={descargando}
        title={recurso ? `Descargar ${recurso.nombre}` : 'Descargar recurso'}
      >
        {descargando ? (
          <CSpinner size="sm" aria-hidden="true" />
        ) : (
          <IconoRecurso nombre={recurso?.nombre} aria-hidden="true" />
        )}
        {children}
      </button>
      {error && <span className="text-danger small ms-1">{error}</span>}
    </>
  )
}

EnlaceMarkdown.propTypes = {
  href: PropTypes.string,
  children: PropTypes.node,
  node: PropTypes.object,
}

export default EnlaceMarkdown
