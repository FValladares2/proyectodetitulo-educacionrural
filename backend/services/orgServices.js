const { isMongoConnected, ObjectId, collections } = require('../config/mongo')

const aObjectId = (id) => (ObjectId.isValid(id) ? new ObjectId(String(id)) : id)


const findUserInOrg = async (id_organizacion, id_usuario) => {
  if (isMongoConnected() && collections.organizaciones) {
    const userId = ObjectId.isValid(id_usuario) ? new ObjectId(id_usuario) : id_usuario
    return collections.organizaciones.findOne({ _id: new ObjectId(id_organizacion), usuarios: userId })
  }

  return null
}

const findTeacherInOrg = async (id_organizacion, id_usuario) => {
  if (isMongoConnected() && collections.organizaciones) {
    return collections.organizaciones.findOne({ _id: new ObjectId(id_organizacion), profesores: aObjectId(id_usuario) })
  }

  return null
}

const findAdminInOrg = async (id_organizacion, id_usuario) => {
  if (isMongoConnected() && collections.organizaciones) {
    return collections.organizaciones.findOne({ _id: new ObjectId(id_organizacion), administradores: aObjectId(id_usuario) })
  }

  return null
}

const getAllOrgsWithUser = async (id_usuario) => {
  if (isMongoConnected() && collections.organizaciones) {
    return collections.organizaciones.find({ usuarios: aObjectId(id_usuario) }).project({ nombre: 1, img: 1, _id: 1, administradores: 1, profesores: 1 }).toArray()
  }

  return []
}

const getOrgById = async (id_organizacion) => {
  if (isMongoConnected() && collections.organizaciones) {
    return collections.organizaciones.findOne({ _id: new ObjectId(id_organizacion) })
  }

  return null
}

const actualizarOrg = async (id_organizacion, actualizacion) => {
  if (isMongoConnected() && collections.organizaciones) {
    return collections.organizaciones.updateOne({ _id: new ObjectId(id_organizacion) }, actualizacion)
  }

  return null
}

const createOrg = async (organizacion) => {
  if (isMongoConnected() && collections.organizaciones) {
    return collections.organizaciones.insertOne(organizacion)
  }

  return null
}

const addUsersToOrgByRole = async (id_organizacion, usersByRole) => {
  if (isMongoConnected() && collections.organizaciones) {
    const operations = []
    const allUsers = [...usersByRole.admin, ...usersByRole.profesor, ...usersByRole.alumno]

    if (allUsers.length > 0) {
      operations.push({
        updateOne: {
          filter: { _id: new ObjectId(id_organizacion) },
          update: { $addToSet: { usuarios: { $each: allUsers } } },
        },
      })
    }
    if (usersByRole.admin.length > 0) {
      operations.push({
        updateOne: {
          filter: { _id: new ObjectId(id_organizacion) },
          update: { $addToSet: { administradores: { $each: usersByRole.admin } } },
        },
      })
    }
    if (usersByRole.profesor.length > 0 || usersByRole.admin.length > 0) {
      operations.push({
        updateOne: {
          filter: { _id: new ObjectId(id_organizacion) },
          update: { $addToSet: { profesores: { $each: [...usersByRole.profesor, ...usersByRole.admin] } } },
        },
      })
    }

    return operations.length > 0 ? collections.organizaciones.bulkWrite(operations) : null
  }
  return null
}

const getUsersInOrg = async (id_organizacion) => {
  if (isMongoConnected() && collections.organizaciones) {
    const org = await collections.organizaciones.findOne({ _id: new ObjectId(id_organizacion) })
    return org?.usuarios ?? []
  }

  return []
}

const getAdminsInOrg = async (id_organizacion) => {
  if (isMongoConnected() && collections.organizaciones) {
    const org = await collections.organizaciones.findOne({ _id: new ObjectId(id_organizacion) })
    return org?.administradores ?? []
  }

  return []
}

const updateOrg = async (id_organizacion, campos) => {
  if (isMongoConnected() && collections.organizaciones) {
    return collections.organizaciones.updateOne({ _id: new ObjectId(id_organizacion) }, { $set: campos })
  }

  return null
}

const getTeachersInOrg = async (id_organizacion) => {
  if (isMongoConnected() && collections.organizaciones) {
    const org = await collections.organizaciones.findOne({ _id: new ObjectId(id_organizacion) })
    return org?.profesores ?? []
  }

  return []
}


module.exports = {
  findUserInOrg,
  findTeacherInOrg,
  findAdminInOrg,
  getAllOrgsWithUser,
  getOrgById,
  createOrg,
  actualizarOrg,
  addUsersToOrgByRole,
  getUsersInOrg,
  getAdminsInOrg,
  getTeachersInOrg,
  updateOrg
}