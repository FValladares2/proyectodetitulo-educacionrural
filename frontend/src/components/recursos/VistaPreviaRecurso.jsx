import React, { useEffect, useState } from 'react'
import PropTypes from 'prop-types'
import { CAlert, CButton, CSpinner } from '@coreui/react'
import { descargarRecurso, fetchRecursoBlob } from 'src/services/recursoServices'

const esImagen = (tipoMime = '') => tipoMime.startsWith('image/')
const esPdf = (tipoMime = '') => tipoMime === 'application/pdf'
const esTexto = (tipoMime = '') => tipoMime.startsWith('text/')

/**
 * Vista previa de un recurso dentro del modal del file manager.
 * El contenido se obtiene como blob porque la descarga requiere el token de autenticación.
 */
const VistaPreviaRecurso = ({ recurso }) => {
  const [url, setUrl] = useState(null)
  const [texto, setTexto] = useState(null)
  const [error, setError] = useState('')
  const previsualizable =
    esImagen(recurso.tipo_mime) || esPdf(recurso.tipo_mime) || esTexto(recurso.tipo_mime)

  useEffect(() => {
    if (!previsualizable) return
    const controller = new AbortController()
    let objectUrl = null

    fetchRecursoBlob(recurso._id, controller.signal)
      .then(async (blob) => {
        if (esTexto(recurso.tipo_mime)) {
          setTexto(await blob.text())
        } else {
          objectUrl = URL.createObjectURL(blob)
          setUrl(objectUrl)
        }
      })
      .catch((err) => {
        if (err.name !== 'AbortError') setError(err.message)
      })

    return () => {
      controller.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [recurso._id, recurso.tipo_mime, previsualizable])

  const botonDescarga = (
    <CButton
      color="primary"
      onClick={() => descargarRecurso(recurso).catch((err) => setError(err.message))}
    >
      Descargar
    </CButton>
  )

  if (error) {
    return (
      <CAlert color="danger" className="m-3">
        {error}
      </CAlert>
    )
  }

  if (!previsualizable) {
    return (
      <div className="text-center p-4">
        <p className="text-body-secondary">No hay vista previa disponible para este archivo.</p>
        {botonDescarga}
      </div>
    )
  }

  if (!url && texto === null) {
    return (
      <div className="text-center p-5">
        <CSpinner color="primary" />
      </div>
    )
  }

  return (
    <div className="p-3 text-center">
      {esImagen(recurso.tipo_mime) && (
        <img src={url} alt={recurso.nombre} className="img-fluid" style={{ maxHeight: '70vh' }} />
      )}
      {esPdf(recurso.tipo_mime) && (
        <iframe
          src={url}
          title={recurso.nombre}
          style={{ width: 'min(80vw, 900px)', height: '70vh', border: 0 }}
        />
      )}
      {texto !== null && (
        <pre className="text-start mb-0" style={{ maxHeight: '70vh', whiteSpace: 'pre-wrap' }}>
          {texto}
        </pre>
      )}
      <div className="mt-3">{botonDescarga}</div>
    </div>
  )
}

VistaPreviaRecurso.propTypes = {
  recurso: PropTypes.shape({
    _id: PropTypes.string.isRequired,
    nombre: PropTypes.string.isRequired,
    tipo_mime: PropTypes.string,
  }).isRequired,
}

export default VistaPreviaRecurso
