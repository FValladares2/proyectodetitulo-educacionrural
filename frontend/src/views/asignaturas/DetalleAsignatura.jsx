import { CCard, CCardHeader, CCardBody, CSpinner, CButton, CCol, CRow, CBadge } from '@coreui/react'
import { cilMenu, cilPeople, cilFolder, cilPencil } from '@coreui/icons'
import CIcon from '@coreui/icons-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import EditorAsignatura from './EditorAsignatura'
import ReactMarkdown from 'react-markdown'
import rehypeRaw from 'rehype-raw'
import { useParams } from 'react-router-dom'
import BannerRecurso from 'src/components/recursos/BannerRecurso'
import { getAuthUser } from 'src/services/authServices'
import {
  fetchAsignaturaById,
  updateAsignaturaById,
  updateAsignaturaImg,
} from '../../services/asignServices'
import { fetchRecursosByAsignatura } from '../../services/recursoServices'
import SidebarAsignatura from './SidebarAsignatura'
import { createHeadingIdFactory, extractHeadings } from './markdownUtils'
import ImagenMarkdown from './ImagenMarkdown'
import EnlaceMarkdown from './EnlaceMarkdown'
import { RecursosAsignaturaContext, urlTransform } from './recursoMarkdown'

const DetalleAsignatura = () => {
  const [loading, setLoading] = useState(false)
  const { id } = useParams()
  const [asignatura, setAsignatura] = useState(null)
  const [editando, setEditando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [mobileSidebarVisible, setMobileSidebarVisible] = useState(false)
  // metadatos de los recursos, para los íconos y nombres de los enlaces de descarga
  const [recursosCargados, setRecursosCargados] = useState({
    asignaturaId: null,
    recursos: null,
    estado: 'cargando',
  })

  const authUser = useMemo(() => getAuthUser(), [])
  const esDocente = Boolean(
    authUser && (asignatura?.docentes || []).some((d) => String(d) === String(authUser._id)),
  )

  const handleCambiarImg = async (img) => {
    await updateAsignaturaImg(id, img)
    setAsignatura((actual) => ({ ...actual, img }))
  }

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
    img: ImagenMarkdown,
    a: EnlaceMarkdown,
  }

  const recursosContexto = useMemo(
    () =>
      recursosCargados.asignaturaId === id
        ? { recursos: recursosCargados.recursos, estado: recursosCargados.estado }
        : { recursos: null, estado: 'cargando' },
    [recursosCargados, id],
  )
  // al salir del editor se recargan, ya que pudieron subirse recursos nuevos desde el selector
  const marcarRecursosPorRecargar = () =>
    setRecursosCargados((previo) => ({ ...previo, estado: 'cargando' }))

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
    marcarRecursosPorRecargar()
  }

  const handleIntegrantes = () => {
    // Lógica para mostrar la información de la asignatura
    console.log('Mostrar integrantes de la asignatura')
  }

  const handleArchivos = () => {
    // Lógica para mostrar las evaluaciones de la asignatura
    console.log('Mostrar archivos de la asignatura')
  }

  const editorMarkupRef = useRef(asignatura?.formato_markup || '')
  const cardHeaderRef = useRef(null)

  useEffect(() => {
    if (editando) {
      editorMarkupRef.current = asignatura?.formato_markup || ''
    }
  }, [editando, asignatura?.formato_markup])

  useEffect(() => {
    const headerEl = cardHeaderRef.current
    if (!headerEl) return undefined

    const updateHeight = () => {
      const height = headerEl.getBoundingClientRect().height
      headerEl.closest('.card')?.style.setProperty('--asignatura-header-height', `${height}px`)
    }

    updateHeight()

    const observer = new ResizeObserver(updateHeight)
    observer.observe(headerEl)

    return () => observer.disconnect()
  }, [asignatura?.nombre, editando])

  const handleGuardar = () => {
    handleMarkupSave(editorMarkupRef.current)
  }

  const handleMarkupSave = (markup) => {
    setAsignatura((currentAsignatura) => ({
      ...currentAsignatura,
      formato_markup: markup,
    }))
    setEditando(false)
    marcarRecursosPorRecargar()
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

  useEffect(() => {
    if (editando) return undefined

    const controller = new AbortController()
    fetchRecursosByAsignatura(id, controller.signal)
      .then((recursos) =>
        setRecursosCargados({
          asignaturaId: id,
          recursos: new Map(recursos.map((recurso) => [String(recurso._id), recurso])),
          estado: 'listo',
        }),
      )
      .catch((err) => {
        if (err.name === 'AbortError') return
        setRecursosCargados({ asignaturaId: id, recursos: null, estado: 'error' })
      })
    return () => controller.abort()
  }, [id, editando])

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
              <BannerRecurso
                img={asignatura?.img}
                puedeEditar={esDocente}
                contenedor={asignatura}
                onCambiar={handleCambiarImg}
              />
              <CCardHeader
                ref={cardHeaderRef}
                className="sticky-asignatura-header border-bottom py-2 px-3"
              >
                <div className="d-flex justify-content-between align-items-center">
                  <div className="d-flex align-items-center gap-2 flex-wrap min-w-0 me-2">
                    <h4 className="mb-0 fw-semibold fs-5 text-break">{asignatura?.nombre}</h4>
                    {editando && (
                      <CBadge color="warning" className="text-dark border border-warning">
                        <span className="ms-1">Modo edición</span>
                      </CBadge>
                    )}
                  </div>
                  <div className="d-flex align-items-center gap-2 flex-shrink-0 ms-2">
                    {!editando && (
                      <CButton
                        color="secondary"
                        variant="outline"
                        size="sm"
                        className="d-lg-none"
                        aria-label="Abrir menú de la asignatura"
                        onClick={() => setMobileSidebarVisible(true)}
                      >
                        <CIcon icon={cilMenu} />
                      </CButton>
                    )}
                    {editando ? (
                      <>
                        <CButton
                          color="secondary"
                          variant="ghost"
                          size="sm"
                          onClick={handleEditClick}
                        >
                          Cancelar
                        </CButton>
                        <CButton
                          color="primary"
                          size="sm"
                          onClick={handleGuardar}
                          disabled={guardando}
                        >
                          {guardando ? 'Guardando...' : 'Guardar cambios'}
                        </CButton>
                      </>
                    ) : (
                      <CButton color="primary" size="sm" onClick={handleEditClick}>
                        <CIcon icon={cilPencil} /> Editar
                      </CButton>
                    )}
                  </div>
                </div>
              </CCardHeader>

              <CCardBody>
                {error && <p className="text-danger mb-3">{error}</p>}
                {editando ? (
                  <EditorAsignatura
                    asignatura={asignatura}
                    markup={asignatura?.formato_markup}
                    onChange={(val) => {
                      editorMarkupRef.current = val
                    }}
                  />
                ) : (
                  <RecursosAsignaturaContext.Provider value={recursosContexto}>
                    <div className="asignatura-markdown">
                      <ReactMarkdown
                        rehypePlugins={[rehypeRaw]}
                        components={markdownComponents}
                        urlTransform={urlTransform}
                      >
                        {asignatura?.formato_markup}
                      </ReactMarkdown>
                    </div>
                  </RecursosAsignaturaContext.Provider>
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
