import { CSpinner } from '@coreui/react'
import PropTypes from 'prop-types'
import { useRecursoSrc } from 'src/components/recursos/recursoSrc'

// react-markdown entrega también el nodo hast, que no debe llegar al <img>
const ImagenMarkdown = ({ src, alt = '', node, ...props }) => {
  const { url, estado } = useRecursoSrc(src)

  if (estado === 'cargando') {
    return <CSpinner size="sm" color="secondary" aria-label="Cargando imagen" />
  }

  if (estado === 'error') {
    return (
      <span className="d-inline-block text-body-secondary small fst-italic">
        No se pudo cargar la imagen{alt ? `: ${alt}` : ''}.
      </span>
    )
  }

  return <img src={url} alt={alt} loading="lazy" {...props} />
}

ImagenMarkdown.propTypes = {
  src: PropTypes.string,
  alt: PropTypes.string,
  node: PropTypes.object,
}

export default ImagenMarkdown
