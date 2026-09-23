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

const getFilteredClasses = async ({
    id_organizacion,
    userId,
    search,
    soloDocente = false,
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
        query.id_organizacion = id_organizacion // stored as plain string in DB, not ObjectId
    }

    // 2. Filtrar por pertenencia del usuario
    if (userId) {
        if (soloDocente === 'true') {
            query.docentes = userId
        } else {
            query.usuarios = userId
        }
    }

    // 3. Estado activo / inactivo
    if (activo !== undefined && activo !== null && activo !== '') {
        const isActivo = activo === true || activo === 'true'
        query.activo = isActivo ? { $ne: false } : false
    }

    // 4. Búsqueda por texto (nombre o código)
    if (search && search.trim() !== undefined && search.trim() !== '') {
        console.log('search: ', search)
        const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        query.$or = [
            { nombre: { $regex: escaped, $options: 'i' } },
            { codigo: { $regex: escaped, $options: 'i' } }
        ]
    }

    // 5. Configurar ordenamiento
    const sortDirection = order === 'desc' ? -1 : 1
    const sortOptions = {}

    if (sortBy === 'createdAt') {
        sortOptions.createdAt = sortDirection
    } else {
        sortOptions.nombre = sortDirection // Por defecto nombre
    }

    const skip = (Math.max(1, page) - 1) * limit

    // 6. Ejecución con collation en español
    const cursor = collections.asignaturas
        .find(query)
        .sort(sortOptions)
        .collation({ locale: 'es', strength: 2 })
        .skip(skip)
        .limit(limit)
        .project({ _id: 1, nombre: 1, id_organizacion: 1, docentes: 1, usuarios: 1, activo: 1, createdAt: 1 })

    // nota: no trae el archivo de formato_markup porque es muy pesado
    
    const [data, total] = await Promise.all([
        cursor.toArray(),
        collections.asignaturas.countDocuments(query)
    ])

    return {
        data,
        total,
        page: Number(page),
        totalPages: Math.ceil(total / limit)
    }
}

const getAllClassesWithUser = async (id_usuario) => {
    if (isMongoConnected() && collections.asignaturas) {
        return collections.asignaturas.find({ usuarios: id_usuario }).project({ nombre: 1, _id: 1 }).toArray()
    }
    return []
}

const getClassesWithUser = async (id_usuario, amount, skip) => {
    if (isMongoConnected() && collections.asignaturas) {
        return collections.asignaturas.find({ usuarios: id_usuario }).limit(amount).skip(skip).project({ nombre: 1, _id: 1 }).toArray()
    }
    return []
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
        return collections.asignaturas.updateOne({ _id: asigId }, { $push: { usuarios: userId } })
    }
    return null
}

const addDocenteToAsign = async (id_asignatura, id_usuario) => {
    if (isMongoConnected() && collections.asignaturas) {
        const asigId = ObjectId.isValid(id_asignatura) ? new ObjectId(id_asignatura) : id_asignatura
        const userId = ObjectId.isValid(id_usuario) ? new ObjectId(id_usuario) : id_usuario
        return collections.asignaturas.updateOne({ _id: asigId }, { $push: { docentes: userId } })
    }
    return null
}

const removeUsuarioFromAsign = async (id_asignatura, id_usuario) => {
    if (isMongoConnected() && collections.asignaturas) {
        return collections.asignaturas.updateOne({ _id: ObjectId.isValid(id_asignatura) ? new ObjectId(id_asignatura) : id_asignatura }, { $pull: { usuarios: id_usuario } })
    }
    return null
}

const removeDocenteFromAsign = async (id_asignatura, id_usuario) => {
    if (isMongoConnected() && collections.asignaturas) {
        return collections.asignaturas.updateOne({ _id: ObjectId.isValid(id_asignatura) ? new ObjectId(id_asignatura) : id_asignatura }, { $pull: { docentes: id_usuario } })
    }
    return null
}

const addUsuarioToAsignBatch = async (id_asignatura, id_usuarios) => {
    if (isMongoConnected() && collections.asignaturas) {
        return collections.asignaturas.updateOne({ _id: ObjectId.isValid(id_asignatura) ? new ObjectId(id_asignatura) : id_asignatura }, { $push: { usuarios: { $each: id_usuarios } } })
    }
    return null
}

module.exports = {
    createClass,
    updateClass,
    getClassById,
    getFilteredClasses,
    getAllClassesWithUser,
    getClassesWithUser,
    findUsuarioInAsign,
    findDocenteInAsign,
    addUsuarioToAsign,
    addDocenteToAsign,
    removeUsuarioFromAsign,
    removeDocenteFromAsign,
    addUsuarioToAsignBatch,
}