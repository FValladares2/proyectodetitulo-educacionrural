import { CCard, CCardHeader, CCardBody, CCardImage } from '@coreui/react'
import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import { useParams } from 'react-router-dom'
import placeholderImage from 'src/assets/images/react.jpg'
import { fetchAsignaturaById } from '../../services/asignServices'

const DetalleAsignatura = () => {
  const { id } = useParams()
  const [asignatura, setAsignatura] = useState(null)

  useEffect(() => {
    const obtenerAsignaturaPorId = async () => {
      const asignatura = await fetchAsignaturaById(id)
      setAsignatura(asignatura)
    }
    obtenerAsignaturaPorId()
  }, [id])
  return (
    <div className="mb-4">
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
    </div>
  )
}

export default DetalleAsignatura
