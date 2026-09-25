import { CCard, CCardHeader, CCardBody, CCardImage, CSpinner } from '@coreui/react'
import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { useParams } from 'react-router-dom'
import placeholderImage from 'src/assets/images/react.jpg'
import { fetchAsignaturaById } from '../../services/asignServices'

const DetalleAsignatura = () => {
  const [loading, setLoading] = useState(false)
  const { id } = useParams()
  const [asignatura, setAsignatura] = useState(null)

  useEffect(() => {
    const controller = new AbortController()
    const obtenerAsignaturaPorId = async () => {
      setLoading(true)
      const asignatura = await fetchAsignaturaById(id, controller.signal)
      setAsignatura(asignatura)
      setLoading(false)
    }
    obtenerAsignaturaPorId()
    return () => controller.abort()
  }, [id])

  return (
    <div className="mb-4">
      {loading ? (
        <div className="text-center py-5">
          <CSpinner color="primary" />
          <p className="mt-2 text-body-secondary small">Cargando asignatura...</p>
        </div>
      ) : (
        <CCard className="mb-4 shadow-sm border-0">
          <CCardImage
            orientation="top"
            src={asignatura?.img || placeholderImage}
            style={{ height: '160px', objectFit: 'cover', objectPosition: 'center' }}
          />
          <CCardHeader className="bg-transparent border-bottom">
            <h4 className="mb-0 fw-semibold">{asignatura?.nombre}</h4>
          </CCardHeader>
          <CCardBody>
            <ReactMarkdown>{asignatura?.formato_markup}</ReactMarkdown>
          </CCardBody>
        </CCard>
      )}
    </div>
  )
}

export default DetalleAsignatura
