const { SALT_ROUNDS, isMongoConnected, collections, ObjectId } = require('../config/mongo')
const bcrypt = require('bcryptjs')

const hashPassword = async (password) => bcrypt.hash(password, SALT_ROUNDS)
const comparePassword = async (password, hash) => bcrypt.compare(password, hash)

const findUserByUsernameOrEmail = async (value) => {
  if (isMongoConnected() && collections.usuarios) {
    return collections.usuarios.findOne({ $or: [{ nombre: value }, { correo: value }] })
  }

  return null
}

const findUserById = async (id) => {
  if (isMongoConnected() && collections.usuarios) {
    if (!ObjectId.isValid(id)) return null
    return collections.usuarios.findOne({ _id: new ObjectId(id) })
  }

  return null
}

const findUserByCredentials = async (value, password) => {
  const user = await findUserByUsernameOrEmail(value)
  if (!user || !user.hash_contrasena) {
    return null
  }

  const validPassword = await comparePassword(password, user.hash_contrasena)
  return validPassword ? user : null
}

const insertUser = async (user) => {
  if (isMongoConnected() && collections.usuarios) {
    return collections.usuarios.insertOne(user)
  }

  return null
}

const setUserMainOrg = async (userId, orgId) => {
  if (isMongoConnected() && collections.usuarios) {
    if (!ObjectId.isValid(userId) || !ObjectId.isValid(orgId)) return null
    return collections.usuarios.updateOne({ _id: new ObjectId(userId) }, { $set: { org_principal: new ObjectId(String(orgId)) } })
  }

  return null
}

const getUserBatchBasicInfo = async (usersIds) => {
  if (isMongoConnected() && collections.usuarios) {
    return collections.usuarios.find({ _id: { $in: usersIds } }).project({ nombre: 1, _id: 1, correo: 1 }).toArray()
  }

  return []
}

module.exports = {
  hashPassword,
  comparePassword,
  findUserByUsernameOrEmail,
  findUserById,
  findUserByCredentials,
  insertUser,
  setUserMainOrg,
  getUserBatchBasicInfo,
}