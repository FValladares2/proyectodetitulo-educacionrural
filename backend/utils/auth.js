const { findUserByIdAndUsername } = require('../services/userServices')
const { isMongoConnected, ObjectId } = require('../config/mongo')

const createToken = (user) => {
  const id = user._id || user.id || user.nombre
  return Buffer.from(`${id}:${user.nombre}:${Date.now()}`).toString('base64')
}

const getUserFromToken = async (token) => {
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf8')
    const [id, nombre] = decoded.split(':')

    if (!id || !nombre) {
      return null
    }

    if (isMongoConnected() && !ObjectId.isValid(id)) {
      return null
    }

    return findUserByIdAndUsername(id, nombre)
  } catch (error) {
    console.error('Error al obtener usuario del token:', error)
    return null
  }
}

const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No se encontró el encabezado de autorización.' })
  }

  const token = authHeader.split(' ')[1]
  const user = await getUserFromToken(token)

  if (!user) {
    return res.status(401).json({ message: 'Token inválido o expirado.' })
  }

  req.user = user
  next()
}

module.exports = {
  createToken,
  getUserFromToken,
  authenticate,
}