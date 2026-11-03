import React, { useCallback, useEffect, useMemo, useState } from 'react'
import PropTypes from 'prop-types'
import { CAlert } from '@coreui/react'
import { FileManager } from '@cubone/react-file-manager'
import '@cubone/react-file-manager/dist/style.css'
import { getAuthUser } from 'src/services/authServices'
import {
  MAX_TAMANO_ARCHIVO,
  descargarRecurso,
  eliminarRecurso,
  fetchRecursosByAsignatura,
  fetchRecursosByOrganizacion,
  getUploadConfig,
  renombrarRecurso,
} from 'src/services/recursoServices'
import VistaPreviaRecurso from './VistaPreviaRecurso'

// las carpetas son asignaturas o, con ambito "organizacion", organizaciones con sus admin como "docentes"
const AMBITOS = {
  asignatura: { campoId: 'id_asignatura', fetchRecursos: fetchRecursosByAsignatura },
  organizacion: { campoId: 'id_organizacion', fetchRecursos: fetchRecursosByOrganizacion },
}

const formatearFecha = (fecha) =>
  new Date(fecha).toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short' })

// en errores de subida el file manager entrega un mensaje genérico; se prefiere el del backend
const mensajeDeError = (err) => {
  try {
    return JSON.parse(err.response?.data).message || err.message
  } catch {
    return err.message
  }
}

/**
 * Explorador de recursos basado en @cubone/react-file-manager.
 * Cada asignatura se muestra como una carpeta raíz y sus recursos como archivos dentro de ella.
 *
 * Se usa a pantalla completa en Archivos.jsx y puede reutilizarse como selector dentro de un modal
 * pasando `onSeleccionarRecurso` (y opcionalmente `filtroRecurso`) con una sola asignatura.
 */
const ExploradorRecursos = ({
  asignaturas,
  asignaturaId = null,
  onAsignaturaChange,
  onSeleccionarRecurso,
  filtroRecurso,
  soloLectura = false,
  acceptedFileTypes,
  height = '70vh',
  ambito = 'asignatura',
}) => {
  const { campoId, fetchRecursos } = AMBITOS[ambito]
  const authUser = useMemo(() => getAuthUser(), [])
  const [asignaturaActiva, setAsignaturaActiva] = useState(asignaturaId)
  const [recursosPorAsignatura, setRecursosPorAsignatura] = useState({})
  const [operando, setOperando] = useState(false)
  const [error, setError] = useState('')
  const [recargas, setRecargas] = useState(0)

  // initialPath solo se aplica al montar el FileManager, así que un cambio externo
  // de asignatura (por ejemplo desde la URL) requiere volver a montarlo. Si el cambio
  // viene de navegar dentro del explorador, asignaturaActiva ya coincide y no se remonta.
  const [asignaturaIdPrevia, setAsignaturaIdPrevia] = useState(asignaturaId)
  const [montaje, setMontaje] = useState(0)
  if (asignaturaId !== asignaturaIdPrevia) {
    setAsignaturaIdPrevia(asignaturaId)
    if (asignaturaId !== asignaturaActiva) {
      setAsignaturaActiva(asignaturaId)
      setMontaje((m) => m + 1)
    }
  }

  // nombres de carpeta únicos, ya que el file manager identifica cada elemento por su ruta
  const carpetas = useMemo(() => {
    const usados = new Map()
    return asignaturas.map((asignatura) => {
      const base = (asignatura.nombre || 'Asignatura').replace(/\//g, '-').trim()
      const repeticiones = usados.get(base) || 0
      usados.set(base, repeticiones + 1)
      const nombre = repeticiones ? `${base} (${repeticiones + 1})` : base
      return {
        name: nombre,
        isDirectory: true,
        path: `/${nombre}`,
        updatedAt: asignatura.creado_en,
        asignaturaId: String(asignatura._id),
      }
    })
  }, [asignaturas])

  const files = useMemo(() => {
    const archivos = carpetas.flatMap((carpeta) =>
      (recursosPorAsignatura[carpeta.asignaturaId] || [])
        .filter((recurso) => !filtroRecurso || filtroRecurso(recurso))
        .map((recurso) => ({
          name: recurso.nombre,
          isDirectory: false,
          path: `${carpeta.path}/${recurso.nombre}`,
          updatedAt: recurso.actualizado_en || recurso.creado_en,
          size: recurso.tamano,
          asignaturaId: carpeta.asignaturaId,
          recurso,
        })),
    )
    return [...carpetas, ...archivos]
  }, [carpetas, recursosPorAsignatura, filtroRecurso])

  useEffect(() => {
    if (!asignaturaActiva) return
    const controller = new AbortController()
    fetchRecursos(asignaturaActiva, controller.signal)
      .then((recursos) => {
        setRecursosPorAsignatura((prev) => ({ ...prev, [asignaturaActiva]: recursos }))
      })
      .catch((err) => {
        if (err.name === 'AbortError') return
        setError(err.message)
        setRecursosPorAsignatura((prev) => ({ ...prev, [asignaturaActiva]: [] }))
      })
    return () => controller.abort()
  }, [asignaturaActiva, recargas, fetchRecursos])

  const cargando =
    operando || (Boolean(asignaturaActiva) && recursosPorAsignatura[asignaturaActiva] === undefined)

  const handleRefresh = () => {
    setRecursosPorAsignatura((prev) => {
      const siguiente = { ...prev }
      delete siguiente[asignaturaActiva]
      return siguiente
    })
    setRecargas((r) => r + 1)
  }

  const asignaturaActual = asignaturas.find((a) => String(a._id) === String(asignaturaActiva))
  const esDocente = Boolean(
    asignaturaActual &&
    authUser &&
    (asignaturaActual.docentes || []).some((d) => String(d) === String(authUser._id)),
  )
  // una asignatura inactiva es de solo lectura
  const puedeEditar = esDocente && !soloLectura && asignaturaActual?.activo !== false

  const actualizarRecursos = (id_asignatura, actualizar) =>
    setRecursosPorAsignatura((prev) => ({
      ...prev,
      [id_asignatura]: actualizar(prev[id_asignatura] || []),
    }))

  const handleFolderChange = useCallback(
    (path) => {
      const nombreCarpeta = path.split('/')[1]
      const carpeta = carpetas.find((c) => c.name === nombreCarpeta)
      const id = carpeta ? carpeta.asignaturaId : null
      setAsignaturaActiva(id)
      onAsignaturaChange?.(id)
    },
    [carpetas, onAsignaturaChange],
  )

  const handleFileOpen = (file) => {
    if (!file.isDirectory && onSeleccionarRecurso) {
      onSeleccionarRecurso(file.recurso)
    }
  }

  const handleFileUploaded = (respuesta) => {
    try {
      const recurso = typeof respuesta === 'string' ? JSON.parse(respuesta) : respuesta
      actualizarRecursos(recurso[campoId], (recursos) => [...recursos, recurso])
    } catch {
      setRecargas((r) => r + 1)
    }
  }

  const handleRename = async (file, nuevoNombre) => {
    try {
      const actualizado = await renombrarRecurso(file.recurso._id, nuevoNombre)
      actualizarRecursos(file.asignaturaId, (recursos) =>
        recursos.map((r) => (r._id === actualizado._id ? actualizado : r)),
      )
    } catch (err) {
      setError(err.message)
    }
  }

  const handleDelete = async (seleccion) => {
    const archivos = seleccion.filter((f) => !f.isDirectory)
    setOperando(true)
    const resultados = await Promise.allSettled(
      archivos.map((f) => eliminarRecurso(f.recurso._id).then(() => f)),
    )
    const eliminados = new Set(
      resultados.filter((r) => r.status === 'fulfilled').map((r) => r.value.recurso._id),
    )
    archivos.forEach((f) =>
      actualizarRecursos(f.asignaturaId, (recursos) =>
        recursos.filter((r) => !eliminados.has(r._id)),
      ),
    )
    const fallido = resultados.find((r) => r.status === 'rejected')
    if (fallido) setError(fallido.reason.message)
    setOperando(false)
  }

  const handleDownload = async (seleccion) => {
    const archivos = seleccion.filter((f) => !f.isDirectory)
    if (archivos.length === 0) {
      setError('Selecciona uno o más archivos para descargar.')
      return
    }
    for (const f of archivos) {
      try {
        await descargarRecurso(f.recurso)
      } catch (err) {
        setError(err.message)
      }
    }
  }

  const carpetaInicial = carpetas.find((c) => c.asignaturaId === String(asignaturaActiva))

  return (
    <>
      {error && (
        <CAlert color="danger" dismissible onClose={() => setError('')}>
          {error}
        </CAlert>
      )}
      <FileManager
        key={montaje}
        className="explorador-recursos"
        files={files}
        initialPath={carpetaInicial ? carpetaInicial.path : ''}
        isLoading={cargando}
        language="es-ES"
        fontFamily="inherit"
        primaryColor="var(--cui-primary)"
        height={height}
        formatDate={formatearFecha}
        maxFileSize={MAX_TAMANO_ARCHIVO}
        acceptedFileTypes={acceptedFileTypes}
        permissions={{
          create: false,
          copy: false,
          move: false,
          upload: puedeEditar,
          rename: puedeEditar,
          delete: puedeEditar,
          download: true,
        }}
        fileUploadConfig={getUploadConfig()}
        onFileUploading={(file, carpeta) => ({ [campoId]: carpeta?.asignaturaId })}
        onFileUploaded={handleFileUploaded}
        onFolderChange={handleFolderChange}
        onFileOpen={handleFileOpen}
        onRename={handleRename}
        onDelete={handleDelete}
        onDownload={handleDownload}
        onRefresh={handleRefresh}
        onError={(err) => setError(mensajeDeError(err))}
        enableFilePreview={!onSeleccionarRecurso}
        filePreviewComponent={(file) => <VistaPreviaRecurso recurso={file.recurso} />}
      />
    </>
  )
}

ExploradorRecursos.propTypes = {
  /** Asignaturas a mostrar como carpetas: { _id, nombre, docentes, creado_en } */
  asignaturas: PropTypes.arrayOf(PropTypes.object).isRequired,
  /** Asignatura abierta; al cambiar desde fuera el explorador navega a ella */
  asignaturaId: PropTypes.string,
  /** Se llama con el id de la asignatura abierta, o null al volver a la raíz */
  onAsignaturaChange: PropTypes.func,
  /** Modo selector: al abrir un archivo se entrega el recurso en vez de previsualizarlo */
  onSeleccionarRecurso: PropTypes.func,
  /** Filtra los recursos visibles, por ejemplo solo imágenes */
  filtroRecurso: PropTypes.func,
  soloLectura: PropTypes.bool,
  /** Extensiones permitidas al subir, separadas por coma (ej. ".png,.jpg") */
  acceptedFileTypes: PropTypes.string,
  height: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  /** "asignatura" (por defecto) u "organizacion", que lista y sube recursos generales de la organización */
  ambito: PropTypes.oneOf(['asignatura', 'organizacion']),
}

export default ExploradorRecursos
