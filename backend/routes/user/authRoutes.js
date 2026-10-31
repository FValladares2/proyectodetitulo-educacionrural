const express = require('express')
const { createToken } = require('../../utils/auth')
const { findUserByUsernameOrEmail, findUserByCredentials, insertUser, hashPassword, setUserMainOrg } = require('../../services/userServices')
const orgServices = require('../../services/orgServices')
const { definirContrasenaConInvitacion } = require('../../services/invitacionServices')
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

    const hash_contrasena = await hashPassword(contrasena)
    const sal_cifrado = crypto.randomBytes(16).toString('base64')

    const newUser = {
      nombre,
      correo,
      hash_contrasena,
      sal_cifrado,
      creado_en: new Date(),
    }

    const result = await insertUser(newUser)
    if (!result.insertedId) {
      return res.status(500).json({ message: 'No se pudo crear el usuario.' })
    } else {
      const orgResult = await orgServices.createOrg({ 
        nombre: nombre_organizacion, 
        administradores: [result.insertedId],
        profesores: [result.insertedId],
        usuarios: [result.insertedId],
        creado_en: new Date(),
      })
      await setUserMainOrg(result.insertedId, orgResult.insertedId)
      
      res.status(201).json({ message: 'Usuario creado correctamente.', sal_cifrado })
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
      sal_cifrado: user.sal_cifrado,
    })
  } catch (error) {
    console.error('Error al iniciar sesión:', error)
    res.status(500).json({ message: 'No se pudo iniciar sesión.' })
  }
})

// definir la contraseña con el enlace de invitación (cuentas creadas por un administrador)
router.post('/api/auth/establecer-contrasena', async (req, res) => {
  const { token, contrasena } = req.body
  if (typeof token !== 'string' || !token || typeof contrasena !== 'string' || contrasena.length < 8) {
    return res.status(400).json({ message: 'La contraseña debe tener al menos 8 caracteres.' })
  }

  try {
    if (!await definirContrasenaConInvitacion(token, contrasena)) {
      return res.status(400).json({ message: 'El enlace no es válido o ya venció. Pide uno nuevo a tu administrador.' })
    }
    res.status(200).json({ message: 'Contraseña definida. Ya puedes iniciar sesión.' })
  } catch (error) {
    console.error('Error al definir la contraseña:', error)
    res.status(500).json({ message: 'No se pudo definir la contraseña.' })
  }
})

module.exports = router;