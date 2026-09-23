const { isMongoConnected, ObjectId, collections } = require('../config/mongo')

const findOrgById = async (id) => {
  if (isMongoConnected() && collections.organizaciones) {
    return collections.organizaciones.findOne({ _id: new ObjectId(id) })
  }

  return null
}

const findUserInOrg = async (id_organizacion, id_usuario) => {
  if (isMongoConnected() && collections.organizaciones) {
    return collections.organizaciones.findOne({ _id: new ObjectId(id_organizacion), usuarios: id_usuario })
  }

  return null
}

const findAdminInOrg = async (id_organizacion, id_usuario) => {
  if (isMongoConnected() && collections.organizaciones) {
    return collections.organizaciones.findOne({ _id: new ObjectId(id_organizacion), admin: id_usuario })
  }

  return null
}

const getAllOrgs = async () => {
  // only returns name and _id, otherwise will be slow and heavy with users and whatnot
  if (isMongoConnected() && collections.organizaciones) {
    return collections.organizaciones.find({}).project({ nombre: 1, _id: 1 }).toArray()
  }

  return []
}

const getAllOrgsWithUser = async (id_usuario) => {
  if (isMongoConnected() && collections.organizaciones) {
    return collections.organizaciones.find({ usuarios: id_usuario }).project({ nombre: 1, _id: 1 }).toArray()
  }

  return []
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

const removeUserInOrg = async (id_organizacion, id_usuario) => {
  if (isMongoConnected() && collections.organizaciones) {
    return collections.organizaciones.updateOne({ _id: new ObjectId(id_organizacion) }, { $pull: { usuarios: id_usuario } })
  }

  return null
}

const insertAdminInOrg = async (id_organizacion, id_usuario) => {
  if (isMongoConnected() && collections.organizaciones) {
    return collections.organizaciones.updateOne({ _id: new ObjectId(id_organizacion) }, { $push: { admin: id_usuario } })
  }
  return null
}

const removeAdminInOrg = async (id_organizacion, id_usuario) => {
  // only removes if >1 admin
  if (isMongoConnected() && collections.organizaciones) {
    return collections.organizaciones.updateOne({ _id: new ObjectId(id_organizacion), admin: { $gt: 1 } }, { $pull: { admin: id_usuario } })
  }

  return null
}

module.exports = {
  findOrgById,
  findUserInOrg,
  findAdminInOrg,
  getAllOrgs,
  getAllOrgsWithUser,
  createOrg,
  insertUserInOrg,
  insertUserBatchInOrg,
  insertAdminInOrg,
  removeAdminInOrg,
}