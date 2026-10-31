const crypto = require('crypto')
const { findUserById } = require('../services/userServices')
const { ObjectId } = require('../config/mongo')

/**
 * Tokens de sesión firmados: "v1.<datos>.<firma>"
 * - datos: JSON en base64url con { sub: id del usuario, iat, exp } (fechas en segundos)
 * - firma: HMAC-SHA256 de "v1.<datos>" con un secreto del servidor
 * Sin el secreto no se puede crear ni alterar un token, y vencen después de
 * TOKEN_DIAS_VIGENCIA días (7 por defecto). No guardan datos privados: solo el id.
 *
 * Secreto: TOKEN_SECRETO; si no está, se deriva de ENCRYPTION_KEY (HKDF, con un contexto
 * propio para no reutilizar la clave de cifrado tal cual). En producción uno de los dos es
 * obligatorio. Cambiar el secreto cierra todas las sesiones.
 */

const VERSION = 'v1'
const SEGUNDOS_POR_DIA = 24 * 60 * 60
const DEV_FALLBACK_SECRETO = 'desarrollo-secreto-de-sesion-no-usar-en-produccion'

let secreto = null

const getSecreto = () => {
  if (secreto) return secreto
  if (process.env.TOKEN_SECRETO) {
    secreto = Buffer.from(process.env.TOKEN_SECRETO)
  } else if (process.env.ENCRYPTION_KEY) {
    secreto = Buffer.from(
      crypto.hkdfSync('sha256', process.env.ENCRYPTION_KEY, 'educacionrural', 'token-de-sesion', 32)
    )
  } else {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('TOKEN_SECRETO o ENCRYPTION_KEY es obligatorio en producción.')
    }
    console.warn('Advertencia: TOKEN_SECRETO no definido. Se usa un secreto de desarrollo.')
    secreto = Buffer.from(DEV_FALLBACK_SECRETO)
  }
  return secreto
}

const diasVigencia = () => Number(process.env.TOKEN_DIAS_VIGENCIA) || 7

const firmar = (contenido) => crypto.createHmac('sha256', getSecreto()).update(contenido).digest('base64url')

/**
 * @param {{ _id: ObjectId|string }} user
 * @returns {string}
 */
const createToken = (user) => {
  const ahora = Math.floor(Date.now() / 1000)
  const datos = Buffer.from(
    JSON.stringify({ sub: String(user._id), iat: ahora, exp: ahora + diasVigencia() * SEGUNDOS_POR_DIA })
  ).toString('base64url')
  const contenido = `${VERSION}.${datos}`
  return `${contenido}.${firmar(contenido)}`
}

/**
 * Comprueba formato, firma y vencimiento.
 * @returns {{ sub: string, iat: number, exp: number } | null}
 */
const verificarToken = (token) => {
  if (typeof token !== 'string') return null
  const partes = token.split('.')
  if (partes.length !== 3 || partes[0] !== VERSION) return null

  const [version, datos, firma] = partes
  const esperada = Buffer.from(firmar(`${version}.${datos}`))
  const recibida = Buffer.from(firma)
  // comparación en tiempo constante para no revelar la firma por diferencias de tiempo
  if (esperada.length !== recibida.length || !crypto.timingSafeEqual(esperada, recibida)) return null

  let contenido
  try {
    contenido = JSON.parse(Buffer.from(datos, 'base64url').toString('utf8'))
  } catch {
    return null
  }
  if (!contenido || typeof contenido.exp !== 'number' || contenido.exp <= Math.floor(Date.now() / 1000)) {
    return null
  }
  if (!ObjectId.isValid(contenido.sub)) return null
  return contenido
}

/**
 * Usuario dueño de un token válido, o null si el token no es válido, venció o el usuario ya
 * no existe.
 */
const getUserFromToken = async (token) => {
  try {
    const contenido = verificarToken(token)
    if (!contenido) return null
    return await findUserById(contenido.sub)
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
    return res.status(401).json({ message: 'Tu sesión expiró o no es válida. Inicia sesión de nuevo.' })
  }

  req.user = user
  next()
}

module.exports = {
  createToken,
  verificarToken,
  getUserFromToken,
  authenticate,
}
