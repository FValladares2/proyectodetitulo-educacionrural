const fs = require('fs/promises')
const path = require('path')
const { ObjectId } = require('../config/mongo')
const asignServices = require('./asignServices')
const recursoServices = require('./recursoServices')
const tareaServices = require('./tareaServices')
const { ACCIONES, registrarActividad } = require('./actividadServices')

/**
 * Asignatura de bienvenida que se crea con cada organización nueva, a partir de una plantilla
 * en Markdown (plantillas/asignatura-tutorial.md, o la ruta de TUTORIAL_PLANTILLA). El primer
 * título "# ..." es el nombre de la asignatura.
 *
 * La plantilla puede usar archivos y tareas de la carpeta plantillas/tutorial/ (junto a ella):
 * - "plantilla:<archivo>": el archivo se sube cifrado como recurso de la nueva asignatura, igual
 *   que una subida normal, y la referencia pasa a "recurso:<id>". Un archivo usado varias veces
 *   se sube una sola vez.
 * - "plantilla-tarea:<clave>": se crea la tarea definida en tareas.json con esa clave (abierta
 *   desde ahora durante dias_abierta días) y la referencia pasa a "tarea:<id>".
 *
 * Los comentarios HTML se quitan: sirven de notas en la plantilla y el editor (MDX) no los
 * acepta. La plantilla se lee en cada registro, así que editarla no requiere reiniciar.
 */

const RUTA_PLANTILLA = path.join(__dirname, '..', 'plantillas', 'asignatura-tutorial.md')
const NOMBRE_CARPETA = 'tutorial'
const NOMBRE_POR_DEFECTO = 'Guía de la plataforma'
const MAX_NOMBRE = 120
// mismo límite que las subidas (recursoRoutes)
const MAX_TAMANO_ARCHIVO = 10 * 1024 * 1024
const DIAS_ABIERTA_POR_DEFECTO = 30
const DIA_MS = 24 * 60 * 60 * 1000

// solo nombres simples: sin carpetas ni "..", para no leer fuera de plantillas/tutorial/
const REF_ARCHIVO = /plantilla:([\w.-]+)/g
const REF_TAREA = /plantilla-tarea:([\w-]+)/g

const TIPOS_MIME = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    pdf: 'application/pdf',
    txt: 'text/plain',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    mp4: 'video/mp4',
    mp3: 'audio/mpeg',
}

const rutaPlantilla = () => process.env.TUTORIAL_PLANTILLA || RUTA_PLANTILLA
const carpetaRecursos = () => path.join(path.dirname(rutaPlantilla()), NOMBRE_CARPETA)

const tipoMimeDe = (nombre) =>
    TIPOS_MIME[path.extname(nombre).slice(1).toLowerCase()] || 'application/octet-stream'

// nombre: el primer título de nivel 1 fuera de bloques de código
const nombreDesde = (markdown) => {
    let enCodigo = false
    for (const linea of markdown.split(/\r?\n/)) {
        if (/^\s*(```|~~~)/.test(linea)) enCodigo = !enCodigo
        if (enCodigo) continue
        const titulo = /^#\s+(.+?)\s*#*\s*$/.exec(linea)
        if (titulo) return titulo[1].slice(0, MAX_NOMBRE)
    }
    return NOMBRE_POR_DEFECTO
}

const sinComentarios = (markdown) => markdown.replace(/<!--[\s\S]*?-->\s*/g, '')

const referencias = (markdown, patron) => [...new Set([...markdown.matchAll(patron)].map((m) => m[1]))]

/**
 * @returns {Promise<{ nombre: string, formato_markup: string, archivos: string[], tareas: string[] } | null>}
 */
const leerPlantilla = async () => {
    try {
        const markdown = sinComentarios(await fs.readFile(rutaPlantilla(), 'utf8')).trim()
        if (!markdown) return null
        return {
            nombre: nombreDesde(markdown),
            formato_markup: markdown,
            archivos: referencias(markdown, REF_ARCHIVO),
            tareas: referencias(markdown, REF_TAREA),
        }
    } catch (error) {
        if (error.code !== 'ENOENT') console.error('No se pudo leer la plantilla del tutorial:', error)
        return null
    }
}

// { clave: { titulo, descripcion, dias_abierta } }; sin archivo no hay tareas
const leerTareas = async () => {
    try {
        return JSON.parse(await fs.readFile(path.join(carpetaRecursos(), 'tareas.json'), 'utf8'))
    } catch (error) {
        if (error.code !== 'ENOENT') console.error('No se pudieron leer las tareas del tutorial:', error)
        return {}
    }
}

const leerArchivo = async (nombre) => {
    const ruta = path.join(carpetaRecursos(), nombre)
    const contenido = await fs.readFile(ruta)
    if (contenido.length > MAX_TAMANO_ARCHIVO) {
        throw new Error(`supera el máximo de ${MAX_TAMANO_ARCHIVO / 1024 / 1024} MB`)
    }
    return contenido
}

// los ids se generan antes de guardar nada, para armar el contenido con las referencias finales
const prepararArchivos = async (nombres) => {
    const preparados = new Map()
    for (const nombre of nombres) {
        try {
            preparados.set(nombre, { _id: new ObjectId(), nombre, contenido: await leerArchivo(nombre) })
        } catch (error) {
            // la referencia queda sin reemplazar (imagen rota) en vez de impedir el registro
            console.error(`Archivo de la plantilla del tutorial no disponible (${nombre}):`, error.message)
        }
    }
    return preparados
}

const prepararTareas = (claves, definiciones, ahora) => {
    const preparadas = new Map()
    for (const clave of claves) {
        const definicion = definiciones[clave]
        if (!definicion) {
            console.error(`Tarea de la plantilla del tutorial no definida en tareas.json: ${clave}`)
            continue
        }
        const dias = Number(definicion.dias_abierta) > 0 ? Number(definicion.dias_abierta) : DIAS_ABIERTA_POR_DEFECTO
        const validacion = tareaServices.validarDatosTarea({
            titulo: definicion.titulo,
            descripcion: definicion.descripcion,
            apertura: ahora.toISOString(),
            limite: new Date(ahora.getTime() + dias * DIA_MS).toISOString(),
        })
        if (validacion.message) {
            console.error(`Tarea de la plantilla del tutorial no válida (${clave}):`, validacion.message)
            continue
        }
        preparadas.set(clave, { _id: new ObjectId(), ...validacion.datos })
    }
    return preparadas
}

const reemplazarReferencias = (markdown, archivos, tareas) =>
    markdown
        .replace(REF_TAREA, (original, clave) => (tareas.has(clave) ? `tarea:${tareas.get(clave)._id}` : original))
        .replace(REF_ARCHIVO, (original, nombre) =>
            archivos.has(nombre) ? `recurso:${archivos.get(nombre)._id}` : original
        )

/**
 * Crea la asignatura tutorial con el usuario como su docente, con sus archivos y tareas. Nunca
 * lanza errores: un fallo aquí no debe impedir el registro.
 * @returns {Promise<ObjectId|null>} id de la asignatura creada
 */
const crearAsignaturaTutorial = async (id_usuario, id_organizacion) => {
    try {
        const plantilla = await leerPlantilla()
        if (!plantilla) return null

        const idUsuario = new ObjectId(String(id_usuario))
        const idAsignatura = new ObjectId()
        const ahora = new Date()
        const archivos = await prepararArchivos(plantilla.archivos)
        const tareas = plantilla.tareas.length > 0
            ? prepararTareas(plantilla.tareas, await leerTareas(), ahora)
            : new Map()

        const resultado = await asignServices.createClass({
            _id: idAsignatura,
            nombre: plantilla.nombre,
            formato_markup: reemplazarReferencias(plantilla.formato_markup, archivos, tareas),
            id_organizacion: new ObjectId(String(id_organizacion)),
            docentes: [idUsuario],
            usuarios: [idUsuario],
            activo: true,
            tutorial: true,
            creado_en: ahora,
        })
        if (!resultado?.insertedId) return null

        for (const archivo of archivos.values()) {
            // igual que una subida: base64 cifrado con la clave de quien lo "sube"
            await recursoServices.createRecurso({
                _id: archivo._id,
                id_asignatura: idAsignatura,
                nombre: archivo.nombre,
                recurso: await recursoServices.cifrarRecurso(archivo.contenido.toString('base64'), idUsuario),
                codificacion: 'base64',
                tipo_mime: tipoMimeDe(archivo.nombre),
                tamano: archivo.contenido.length,
                id_usuario: idUsuario,
                creado_en: ahora,
                actualizado_en: ahora,
            })
        }
        for (const tarea of tareas.values()) {
            await tareaServices.crearTarea({
                ...tarea,
                id_asignatura: idAsignatura,
                creada_por: idUsuario,
                creado_en: ahora,
                actualizado_en: ahora,
            })
        }

        registrarActividad({
            contenedor: { id_asignatura: idAsignatura },
            id_usuario: idUsuario,
            accion: ACCIONES.ASIGNATURA_CREADA,
            detalle: { nombre: plantilla.nombre, tutorial: true },
        })
        return idAsignatura
    } catch (error) {
        console.error('No se pudo crear la asignatura tutorial:', error)
        return null
    }
}

module.exports = {
    crearAsignaturaTutorial,
    leerPlantilla,
    leerTareas,
    carpetaRecursos,
    nombreDesde,
}
