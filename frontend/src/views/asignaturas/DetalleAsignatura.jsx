import { CCard, CCardHeader, CCardBody, CSpinner, CButton, CCol, CRow, CBadge } from '@coreui/react'
import { cilMenu, cilPeople, cilFolder, cilPencil } from '@coreui/icons'
import CIcon from '@coreui/icons-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import EditorAsignatura from './EditorAsignatura'
import ReactMarkdown from 'react-markdown'
import rehypeRaw from 'rehype-raw'
import { useParams, useSearchParams } from 'react-router-dom'
import BannerRecurso from 'src/components/recursos/BannerRecurso'
import { getAuthUser } from 'src/services/authServices'
import {
  fetchAsignaturaById,
  updateAsignaturaById,
  updateAsignaturaImg,
} from '../../services/asignServices'
import { fetchRecursosByAsignatura } from '../../services/recursoServices'
import { fetchTareasByAsignatura } from '../../services/tareaServices'
import TareaFormModal from 'src/components/tareas/TareaFormModal'
import SidebarAsignatura from './SidebarAsignatura'
import { createHeadingIdFactory, extractHeadings } from './markdownUtils'
import ImagenMarkdown from './ImagenMarkdown'
import EnlaceMarkdown from './EnlaceMarkdown'
import { RecursosAsignaturaContext, urlTransform } from './recursoMarkdown'
import TareaModal from './TareaModal'
import { TareasAsignaturaContext } from './tareaMarkdown'

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
  // tareas de la asignatura, para la lista del menú lateral y los enlaces tarea:<id>
  const [tareasCargadas, setTareasCargadas] = useState({
    asignaturaId: null,
    lista: null,
    estado: 'cargando',
  })
  const [recargasTareas, setRecargasTareas] = useState(0)
  const [tareaAbierta, setTareaAbierta] = useState(null)
  // ?tarea=<id> (enlaces de notificaciones y correos) abre esa tarea al entrar
  const [searchParams, setSearchParams] = useSearchParams()
  const tareaDeUrl = searchParams.get('tarea')
  const [tareaDeUrlAbierta, setTareaDeUrlAbierta] = useState(null)
  if (tareaDeUrl && tareaDeUrl !== tareaDeUrlAbierta) {
    setTareaDeUrlAbierta(tareaDeUrl)
    setTareaAbierta(tareaDeUrl)
  }
  const [formularioTarea, setFormularioTarea] = useState({ visible: false, tarea: null })

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
  const listaTareas = tareasCargadas.asignaturaId === id ? tareasCargadas.lista : null
  const tareasContexto = useMemo(
    () =>
      tareasCargadas.asignaturaId === id
        ? {
            tareas: tareasCargadas.lista
              ? new Map(tareasCargadas.lista.map((tarea) => [String(tarea._id), tarea]))
              : null,
            estado: tareasCargadas.estado,
            abrirTarea: setTareaAbierta,
          }
        : { tareas: null, estado: 'cargando', abrirTarea: setTareaAbierta },
    [tareasCargadas, id],
  )
  const recargarTareas = () => setRecargasTareas((r) => r + 1)

  // el formulario reemplaza al modal de la tarea (no se abren modales uno dentro de otro)
  const abrirFormularioTarea = (tarea = null) => {
    setTareaAbierta(null)
    setFormularioTarea({ visible: true, tarea })
  }
  const handleTareaGuardada = (tarea) => {
    recargarTareas()
    setTareaAbierta(String(tarea._id))
  }

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

  // al salir del editor también se recargan, por las tareas creadas desde la barra
  useEffect(() => {
    if (editando) return undefined

    const controller = new AbortController()
    fetchTareasByAsignatura(id, controller.signal)
      .then((lista) => setTareasCargadas({ asignaturaId: id, lista, estado: 'listo' }))
      .catch((err) => {
        if (err.name === 'AbortError') return
        setTareasCargadas({ asignaturaId: id, lista: null, estado: 'error' })
      })
    return () => controller.abort()
  }, [id, editando, recargasTareas])

  return (
    <RecursosAsignaturaContext.Provider value={recursosContexto}>
      <TareasAsignaturaContext.Provider value={tareasContexto}>
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
                    tareas={listaTareas}
                    onTareaSelect={(tareaId) => {
                      setMobileSidebarVisible(false)
                      setTareaAbierta(String(tareaId))
                    }}
                    onNuevaTarea={
                      esDocente
                        ? () => {
                            setMobileSidebarVisible(false)
                            abrirFormularioTarea()
                          }
                        : undefined
                    }
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
                      <div className="asignatura-markdown">
                        <ReactMarkdown
                          rehypePlugins={[rehypeRaw]}
                          components={markdownComponents}
                          urlTransform={urlTransform}
                        >
                          {asignatura?.formato_markup}
                        </ReactMarkdown>
                      </div>
                    )}
                  </CCardBody>
                </CCard>
              </CCol>
            </CRow>
          )}

          <TareaModal
            tareaId={tareaAbierta}
            onClose={() => {
              setTareaAbierta(null)
              // se quita el parámetro para que cerrar no vuelva a abrir la tarea al navegar
              if (tareaDeUrl) {
                setTareaDeUrlAbierta(null)
                setSearchParams({}, { replace: true })
              }
            }}
            idAsignatura={id}
            esDocente={esDocente}
            resumen={tareaAbierta ? tareasContexto.tareas?.get(tareaAbierta) : null}
            onCambio={recargarTareas}
            onEditar={abrirFormularioTarea}
          />
          {esDocente && (
            <TareaFormModal
              visible={formularioTarea.visible}
              onClose={() => setFormularioTarea({ visible: false, tarea: null })}
              idAsignatura={id}
              tarea={formularioTarea.tarea}
              onGuardada={handleTareaGuardada}
            />
          )}
        </div>
      </TareasAsignaturaContext.Provider>
    </RecursosAsignaturaContext.Provider>
  )
}

export default DetalleAsignatura
