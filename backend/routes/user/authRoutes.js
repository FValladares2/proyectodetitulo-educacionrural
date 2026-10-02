const express = require('express')
const { createToken, authenticate, getUserFromToken } = require('../../utils/auth')
const { findUserByUsernameOrEmail, findUserByCredentials, insertUser, hashPassword, setUserMainOrg } = require('../../services/userServices')
const orgServices = require('../../services/orgServices')
const crypto = require('crypto')
const router = express.Router()

router.post('/api/auth/register', async (req, res) => {
  const { nombre, correo, contrasena, nombre_organizacion } = req.body

  if (!nombre || !correo || !contrasena || !nombre_organizacion) {
    return res.status(400).json({ message: 'Falta uno o más atributos: ' + (!nombre ? 'nombre, ' : '') + (!correo ? 'correo, ' : '') + (!contrasena ? 'contrasena, ' : '') + (!nombre_organizacion ? 'nombre_organizacion' : '') })
  }

  try {
    const existingUser = await findUserByUsernameOrEmail(nombre) || await findUserByUsernameOrEmail(correo)
    
    if (existingUser) {
      return res.status(409).json({ message: 'Nombre o correo ya existe.' })
    }

    const passwordHash = await hashPassword(contrasena)
    const encryptionSalt = crypto.randomBytes(16).toString('base64')

    const newUser = {
      nombre,
      correo,
      passwordHash,
      encryptionSalt,
      createdAt: new Date(),
    }

    const result = await insertUser(newUser)
    if (!result.insertedId) {
      return res.status(500).json({ message: 'No se pudo crear el usuario.' })
    } else {
      const orgResult = await orgServices.createOrg({ 
        nombre: nombre_organizacion, 
        admin: [result.insertedId],
        profesores: [result.insertedId],
        usuarios: [result.insertedId] 
      })
      await setUserMainOrg(result.insertedId, orgResult.insertedId)
      
      res.status(201).json({ message: 'Usuario creado correctamente.', encryptionSalt })
    }
  } catch (error) {
    console.error('Error al crear el usuario:', error)
    res.status(500).json({ message: 'No se pudo crear el usuario.' })
  }
})

router.post('/api/auth/login', async (req, res) => {
  const { nombre, correo, contrasena } = req.body
  const credentials = nombre || correo

  if (!credentials || !contrasena) {
    return res.status(400).json({ message: 'Nombre/correo y contraseña son requeridos.' })
  }

  try {
    const user = await findUserByCredentials(credentials, contrasena)
    if (!user) {
      return res.status(401).json({ message: 'Nombre de usuario/correo o contraseña inválidos.' })
    }

    const token = createToken(user)
    res.json({
      token,
      user: {
        _id: user._id,
        nombre: user.nombre,
        correo: user.correo,
        org_principal: user.org_principal,
      },
      encryptionSalt: user.encryptionSalt,
    })
  } catch (error) {
    console.error('Error al iniciar sesión:', error)
    res.status(500).json({ message: 'No se pudo iniciar sesión.' })
  }
})

router.post('/api/auth/registerInBatch', authenticate, async (req, res) => {
  const { nombres, correos, contrasenas, roles } = req.body

  if (!nombres || !correos || !contrasenas || !roles) {
    return res.status(400).json({ message: 'Falta uno o más atributos: ' + (!nombres ? 'nombres, ' : '') + (!correos ? 'correos, ' : '') + (!contrasenas ? 'contrasenas, ' : '') + (!roles ? 'roles' : '') })
  }

  const usuarios = []
  for (let i = 0; i < nombres.length; i++) {
    const passwordHash = await hashPassword(contrasenas[i])
    const encryptionSalt = crypto.randomBytes(16).toString('base64')
    usuarios.push({
      nombre: nombres[i],
      correo: correos[i],
      passwordHash,
      encryptionSalt,
      rol_principal: roles[i],
      createdAt: new Date(),
    })
  }

  try {
    const result = await insertUserInBatch(usuarios)
    res.status(201).json({ message: 'Usuarios creados correctamente.' })
  } catch (error) {
    console.error('Error al crear usuarios:', error)
    res.status(500).json({ message: 'No se pudo crear los usuarios.' })
  }
})

module.exports = router;