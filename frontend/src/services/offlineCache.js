// Datos de la API guardados por el service worker para usarlos sin conexión.
// Los nombres de caché se definen en vite.config.mjs (workbox.runtimeCaching) con este prefijo.
const PREFIJO_CACHE_API = 'educacionrural-api'

// dueño de los datos guardados; en localStorage porque el caché sobrevive al cerrar el navegador,
// incluso si la sesión estaba solo en sessionStorage
const CLAVE_DUENO = 'offlineCacheUsuario'

const limpiarCacheOffline = async () => {
  try {
    localStorage.removeItem(CLAVE_DUENO)
    if (typeof caches === 'undefined') return
    const nombres = await caches.keys()
    await Promise.all(
      nombres.filter((nombre) => nombre.startsWith(PREFIJO_CACHE_API)).map((n) => caches.delete(n)),
    )
  } catch (error) {
    console.error('No se pudo limpiar el caché sin conexión:', error)
  }
}

// al iniciar sesión, si los datos guardados son de otra persona (equipo compartido), se eliminan
const asignarCacheOffline = async (idUsuario) => {
  const dueno = localStorage.getItem(CLAVE_DUENO)
  if (dueno !== String(idUsuario)) {
    await limpiarCacheOffline()
  }
  localStorage.setItem(CLAVE_DUENO, String(idUsuario))
}

export { PREFIJO_CACHE_API, limpiarCacheOffline, asignarCacheOffline }
