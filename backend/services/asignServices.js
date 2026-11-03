const { isMongoConnected, ObjectId, collections } = require('../config/mongo')

const createClass = async(classRoom) => {
    if (isMongoConnected() && collections.asignaturas) {
        return collections.asignaturas.insertOne(classRoom)
    }
    return null
}

const updateClass = async (id_asignatura, classRoom) => {
    if (isMongoConnected() && collections.asignaturas) {
        return collections.asignaturas.updateOne({ _id: ObjectId.isValid(id_asignatura) ? new ObjectId(id_asignatura) : id_asignatura }, { $set: classRoom })
    }
    return null
}

const getClassById = async (id_asignatura) => {
    if (isMongoConnected() && collections.asignaturas) {
        return collections.asignaturas.findOne({ _id: ObjectId.isValid(id_asignatura) ? new ObjectId(id_asignatura) : id_asignatura })
    }
    return null
}

// ordena por el último acceso del usuario (colección accesos); las nunca abiertas quedan al final
const ordenarPorAcceso = (query, userId, sortDirection, skip, limit, proyeccion) => {
    const userObjectId = ObjectId.isValid(userId) ? new ObjectId(String(userId)) : userId
    return collections.asignaturas.aggregate([
        { $match: query },
        {
            $lookup: {
                from: 'accesos',
                localField: '_id',
                foreignField: 'id_asignatura',
                pipeline: [{ $match: { id_usuario: userObjectId } }, { $project: { _id: 0, ultimo_acceso: 1 } }],
                as: 'acceso',
            },
        },
        { $addFields: { ultimo_acceso: { $first: '$acceso.ultimo_acceso' } } },
        { $sort: { ultimo_acceso: sortDirection, nombre: 1 } },
        { $skip: skip },
        { $limit: limit },
        { $project: { ...proyeccion, ultimo_acceso: 1 } },
    ], { collation: { locale: 'es', strength: 2 } })
}

const getFilteredClasses = async ({
    id_organizacion,
    userId,
    search,
    soloDocente = false,
    // todas las asignaturas de la organización, no solo las del usuario (solo administradores;
    // la ruta lo comprueba)
    todas = false,
    activo = true,
    sortBy = 'nombre',
    order = 'asc',
    page = 1,
    limit = 20
}) => {
    if (!isMongoConnected() || !collections.asignaturas) return { data: [], total: 0 }

    const query = {}

    // 1. Filtrar por organización
    if (id_organizacion) {
        query.id_organizacion = ObjectId.isValid(id_organizacion) ? new ObjectId(String(id_organizacion)) : id_organizacion
    }

    // 2. Filtrar por pertenencia del usuario
    // la ruta entrega soloDocente como booleano; antes se comparaba con 'true' y nunca filtraba
    const userObjectId = ObjectId.isValid(userId) ? new ObjectId(String(userId)) : userId
    if (userId) {
        if (soloDocente === true || soloDocente === 'true') {
            query.docentes = userObjectId
        } else if (!todas) {
            query.usuarios = userObjectId
        }
    }

    // 3. Estado activo / inactivo
    if (activo !== undefined && activo !== null && activo !== '') {
        const isActivo = activo === true || activo === 'true'
        query.activo = isActivo ? { $ne: false } : false
    }

    // 4. Búsqueda por nombre
    if (search && search.trim() !== undefined && search.trim() !== '') {
        console.log('search: ', search)
        const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        query.nombre = { $regex: escaped, $options: 'i' }
    }

    // 5. Configurar ordenamiento
    const sortDirection = order === 'desc' ? -1 : 1
    const sortOptions = {}

    if (sortBy === 'creado_en') {
        sortOptions.creado_en = sortDirection
    } else {
        sortOptions.nombre = sortDirection // Por defecto nombre
    }

    const skip = (Math.max(1, page) - 1) * limit

    const proyeccion = { _id: 1, nombre: 1, img: 1, id_organizacion: 1, docentes: 1, usuarios: 1, activo: 1, creado_en: 1 }

    // 6. Ejecución con collation en español
    const cursor = sortBy === 'ultimoAcceso' && userId
        ? ordenarPorAcceso(query, userId, sortDirection, skip, limit, proyeccion)
        : collections.asignaturas
            .find(query)
            .sort(sortOptions)
            .collation({ locale: 'es', strength: 2 })
            .skip(skip)
            .limit(limit)
            .project(proyeccion)

    // nota: no trae el archivo de formato_markup porque es muy pesado
    
    // si es docente en alguna asignatura de la organización, para mostrar el filtro "soy Docente"
    const filtroDocente = { docentes: userObjectId }
    if (query.id_organizacion) filtroDocente.id_organizacion = query.id_organizacion
    const [data, total, algunaComoDocente] = await Promise.all([
        cursor.toArray(),
        collections.asignaturas.countDocuments(query),
        userId ? collections.asignaturas.findOne(filtroDocente, { projection: { _id: 1 } }) : null,
    ])

    return {
        data,
        total,
        docenteEnAlguna: Boolean(algunaComoDocente),
        page: Number(page),
        totalPages: Math.ceil(total / limit)
    }
}

const findUsuarioInAsign = async (id_asignatura, id_usuario) => {
    if (isMongoConnected() && collections.asignaturas) {
        console.log('buscando usuario ', id_usuario, ' en asignatura ', id_asignatura)
        const asigId = ObjectId.isValid(id_asignatura) ? new ObjectId(id_asignatura) : id_asignatura
        const userId = ObjectId.isValid(id_usuario) ? new ObjectId(id_usuario) : id_usuario
        return collections.asignaturas.findOne({ _id: asigId, usuarios: userId })
    }
    return null
}

const findDocenteInAsign = async (id_asignatura, id_usuario) => {
    if (isMongoConnected() && collections.asignaturas) {
        const asigId = ObjectId.isValid(id_asignatura) ? new ObjectId(id_asignatura) : id_asignatura
        const userId = ObjectId.isValid(id_usuario) ? new ObjectId(id_usuario) : id_usuario
        return collections.asignaturas.findOne({ _id: asigId, docentes: userId })
    }
    return null
}

const addUsuarioToAsign = async (id_asignatura, id_usuario) => {
    if (isMongoConnected() && collections.asignaturas) {
        const asigId = ObjectId.isValid(id_asignatura) ? new ObjectId(id_asignatura) : id_asignatura
        const userId = ObjectId.isValid(id_usuario) ? new ObjectId(id_usuario) : id_usuario
        // $addToSet: agregar a alguien que ya está no lo duplica
        return collections.asignaturas.updateOne({ _id: asigId }, { $addToSet: { usuarios: userId } })
    }
    return null
}

const addUsersToAsignByRole = async (id_asignatura, { profesores = [], alumnos = [] }) => {
    if (isMongoConnected() && collections.asignaturas) {
        const asigId = ObjectId.isValid(id_asignatura) ? new ObjectId(id_asignatura) : id_asignatura
        const profObjectIds = profesores.map(id => ObjectId.isValid(id) ? new ObjectId(id) : id)
        const alumnoObjectIds = alumnos.map(id => ObjectId.isValid(id) ? new ObjectId(id) : id)
        const allUserObjectIds = [...profObjectIds, ...alumnoObjectIds]

        const updateDoc = {}
        const addToSet = {}

        if (allUserObjectIds.length > 0) {
            addToSet.usuarios = { $each: allUserObjectIds }
        }
        if (profObjectIds.length > 0) {
            addToSet.docentes = { $each: profObjectIds }
        }

        if (Object.keys(addToSet).length > 0) {
            updateDoc.$addToSet = addToSet
            return collections.asignaturas.updateOne({ _id: asigId }, updateDoc)
        }
    }
    return null
}

/**
 * Una asignatura inactiva es de solo lectura: se puede ver su contenido, archivos y tareas,
 * pero no editarlos ni entregar. Siguen permitidos calificar, gestionar integrantes y cambiar
 * su configuración (para reactivarla).
 * @param {object|string|ObjectId} asignatura - documento o id
 * @returns {Promise<null | { status: number, message: string }>}
 */
const motivoAsignaturaInactiva = async (asignatura) => {
    const doc = asignatura && typeof asignatura === 'object' && 'activo' in asignatura
        ? asignatura
        : await getClassById(asignatura)
    if (doc && doc.activo === false) {
        return { status: 409, message: 'La asignatura está inactiva y es de solo lectura. Un docente puede reactivarla desde su configuración.' }
    }
    return null
}

module.exports = {
    motivoAsignaturaInactiva,
    createClass,
    updateClass,
    getClassById,
    getFilteredClasses,
    findUsuarioInAsign,
    findDocenteInAsign,
    addUsuarioToAsign,
    addUsersToAsignByRole,
}