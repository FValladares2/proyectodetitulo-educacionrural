import {
  CCard,
  CCardHeader,
  CCardBody,
  CCardImage,
  CSpinner,
  CButton,
  CCol,
  CRow,
} from '@coreui/react'
import { cilMenu, cilPeople, cilFolder } from '@coreui/icons'
import CIcon from '@coreui/icons-react'
import { useEffect, useState } from 'react'
import EditorAsignatura from './EditorAsignatura'
import ReactMarkdown from 'react-markdown'
import { useParams } from 'react-router-dom'
import placeholderImage from 'src/assets/images/react.jpg'
import { fetchAsignaturaById, updateAsignaturaById } from '../../services/asignServices'
import SidebarAsignatura from './SidebarAsignatura'
import { createHeadingIdFactory, extractHeadings } from './markdownUtils'

const DetalleAsignatura = () => {
  const [loading, setLoading] = useState(false)
  const { id } = useParams()
  const [asignatura, setAsignatura] = useState(null)
  const [editando, setEditando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [mobileSidebarVisible, setMobileSidebarVisible] = useState(false)

  const headings = extractHeadings(asignatura?.formato_markup)
  const headingIdFactory = createHeadingIdFactory()
  const renderHeading =
    (Tag) =>
    ({ children, ...props }) => (
      <Tag id={headingIdFactory(children)} {...props}>
        {children}
      </Tag>
    )
  const markdownComponents = {
    h1: renderHeading('h1'),
    h2: renderHeading('h2'),
    h3: renderHeading('h3'),
    h4: renderHeading('h4'),
    h5: renderHeading('h5'),
    h6: renderHeading('h6'),
  }

  const handleHeadingSelect = (headingId) => {
    setMobileSidebarVisible(false)

    requestAnimationFrame(() => {
      document.getElementById(headingId)?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    })
  }

  const handleEditClick = () => {
    setEditando(!editando)
  }

  const handleIntegrantes = () => {
    // Lógica para mostrar la información de la asignatura
    console.log('Mostrar integrantes de la asignatura')
  }

  const handleArchivos = () => {
    // Lógica para mostrar las evaluaciones de la asignatura
    console.log('Mostrar archivos de la asignatura')
  }

  const handleMarkupSave = (markup) => {
    setAsignatura((currentAsignatura) => ({
      ...currentAsignatura,
      formato_markup: markup,
    }))
    setEditando(false)
    setError('')
    setGuardando(true)
  }

  useEffect(() => {
    if (!guardando || !asignatura) return undefined

    const controller = new AbortController()
    const actualizarAsignatura = async () => {
      const updatedAsignatura = await updateAsignaturaById(
        id,
        { formato_markup: asignatura.formato_markup },
        controller.signal,
      )

      if (!updatedAsignatura && !controller.signal.aborted) {
        setError('No se pudo guardar el contenido de la asignatura.')
      }

      if (!controller.signal.aborted) {
        setGuardando(false)
      }
    }

    actualizarAsignatura()
    return () => controller.abort()
  }, [asignatura, guardando, id])

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
        <CRow className="g-4 align-items-start">
          {!editando && (
            <CCol xs={12} lg={3} className="asignatura-sidebar-column">
              <SidebarAsignatura
                headings={headings}
                onHeadingSelect={handleHeadingSelect}
                mobileVisible={mobileSidebarVisible}
                onMobileVisibleChange={setMobileSidebarVisible}
                actions={[
                  {
                    name: 'Integrantes',
                    to: '/asignaturas/' + id + '/integrantes',
                    icon: cilPeople,
                  },
                  { name: 'Archivos', to: '/archivos/' + id, icon: cilFolder },
                ]}
              />
            </CCol>
          )}

          <CCol xs={12} lg={editando ? 12 : 9}>
            <CCard className="mb-4 shadow-sm border-0">
              <CCardImage
                orientation="top"
                src={asignatura?.img || placeholderImage}
                style={{ height: '160px', objectFit: 'cover', objectPosition: 'center' }}
              />
              <CCardHeader className="bg-transparent border-bottom">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <h4 className="mb-0 fw-semibold">{asignatura?.nombre}</h4>
                  <div className="d-flex align-items-center gap-2">
                    {!editando && (
                      <CButton
                        color="secondary"
                        variant="outline"
                        className="d-lg-none"
                        aria-label="Abrir menú de la asignatura"
                        onClick={() => setMobileSidebarVisible(true)}
                      >
                        <CIcon icon={cilMenu} />
                      </CButton>
                    )}
                    <CButton color="primary" size="sm" onClick={handleEditClick}>
                      {editando ? 'Cancelar' : 'Editar'}
                    </CButton>
                  </div>
                </div>
              </CCardHeader>

              <CCardBody>
                {error && <p className="text-danger mb-3">{error}</p>}
                {editando ? (
                  <EditorAsignatura markup={asignatura?.formato_markup} onSave={handleMarkupSave} />
                ) : (
                  <ReactMarkdown className="asignatura-markdown" components={markdownComponents}>
                    {asignatura?.formato_markup}
                  </ReactMarkdown>
                )}
              </CCardBody>
            </CCard>
          </CCol>
        </CRow>
      )}
    </div>
  )
}

export default DetalleAsignatura
