const { isMongoConnected, ObjectId, collections } = require('../config/mongo')

const aObjectId = (id) => (ObjectId.isValid(id) ? new ObjectId(String(id)) : id)

const findOrgById = async (id) => {
  if (isMongoConnected() && collections.organizaciones) {
    return collections.organizaciones.findOne({ _id: new ObjectId(id) })
  }

  return null
}


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
    return collections.organizaciones.find({ usuarios: id_usuario }).project({ nombre: 1, img: 1, _id: 1 }).toArray()
  }

  return []
}

const getOrgById = async (id_organizacion) => {
  if (isMongoConnected() && collections.organizaciones) {
    return collections.organizaciones.findOne({ _id: new ObjectId(id_organizacion) })
  }

  return null
}

const createOrg = async (organizacion) => {
  if (isMongoConnected() && collections.organizaciones) {
    return collections.organizaciones.insertOne(organizacion)
  }

  return null
}

const insertUserInOrg = async (id_organizacion, id_usuario) => {
  if (isMongoConnected() && collections.organizaciones) {
    return collections.organizaciones.updateOne({ _id: new ObjectId(id_organizacion) }, { $push: { usuarios: id_usuario } })
  }
  return null
}

const insertUserBatchInOrg = async (id_organizacion, id_usuario) => {
  if (isMongoConnected() && collections.organizaciones) {
    return collections.organizaciones.updateOne({ _id: new ObjectId(id_organizacion) }, { $push: { usuarios: { $each: id_usuario } } })
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

const removeUserInOrg = async (id_organizacion, id_usuario) => {
  if (isMongoConnected() && collections.organizaciones) {
    return collections.organizaciones.updateOne({ _id: new ObjectId(id_organizacion) }, { $pull: { usuarios: id_usuario } })
  }

  return null
}

const insertAdminInOrg = async (id_organizacion, id_usuario) => {
  if (isMongoConnected() && collections.organizaciones) {
    return collections.organizaciones.updateOne({ _id: new ObjectId(id_organizacion) }, { $addToSet: { administradores: aObjectId(id_usuario) } })
  }
  return null
}

const removeAdminInOrg = async (id_organizacion, id_usuario) => {
  // solo quita si queda al menos otro administrador (existe un segundo elemento)
  if (isMongoConnected() && collections.organizaciones) {
    return collections.organizaciones.updateOne(
      { _id: new ObjectId(id_organizacion), 'administradores.1': { $exists: true } },
      { $pull: { administradores: aObjectId(id_usuario) } }
    )
  }

  return null
}

const insertTeacherInOrg = async (id_organizacion, id_usuario) => {
  if (isMongoConnected() && collections.organizaciones) {
    return collections.organizaciones.updateOne({ _id: new ObjectId(id_organizacion) }, { $push: { profesores: id_usuario } })
  }
  return null
}

const insertTeacherBatchInOrg = async (id_organizacion, id_usuario) => {
  if (isMongoConnected() && collections.organizaciones) {
    return collections.organizaciones.updateOne({ _id: new ObjectId(id_organizacion) }, { $push: { profesores: { $each: id_usuario } } })
  }
  return null
}

const removeTeacherInOrg = async (id_organizacion, id_usuario) => {
  if (isMongoConnected() && collections.organizaciones) {
    return collections.organizaciones.updateOne({ _id: new ObjectId(id_organizacion) }, { $pull: { profesores: id_usuario } })
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
  findOrgById,
  findUserInOrg,
  findTeacherInOrg,
  findAdminInOrg,
  getAllOrgsWithUser,
  getOrgById,
  createOrg,
  insertUserInOrg,
  insertUserBatchInOrg,
  addUsersToOrgByRole,
  insertAdminInOrg,
  removeAdminInOrg,
  insertTeacherInOrg,
  insertTeacherBatchInOrg,
  removeTeacherInOrg,
  getUsersInOrg,
  getAdminsInOrg,
  getTeachersInOrg,
  updateOrg
}