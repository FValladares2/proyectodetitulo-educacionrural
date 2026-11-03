import { useEffect, useState } from 'react'
import { getOrgsWithUser } from 'src/services/orgServices'

/**
 * Rol del usuario en la organización: 'admin', 'profesor' o 'alumno'; null mientras carga o si
 * no se pudo obtener. Solo sirve para ocultar acciones: los permisos los valida el backend.
 * @param {string} orgId
 * @returns {'admin'|'profesor'|'alumno'|null}
 */
const useRolOrganizacion = (orgId) => {
  const [rol, setRol] = useState({ orgId: null, valor: null })

  useEffect(() => {
    if (!orgId) return undefined
    const controller = new AbortController()
    getOrgsWithUser(controller.signal).then((orgs) => {
      if (controller.signal.aborted) return
      const org = (orgs || []).find((o) => String(o._id) === String(orgId))
      setRol({ orgId, valor: org?.rol ?? null })
    })
    return () => controller.abort()
  }, [orgId])

  // al cambiar de organización no se muestra el rol de la anterior
  return rol.orgId === orgId ? rol.valor : null
}

// admins también figuran como profesores; ambos pueden crear asignaturas
const puedeCrearAsignaturas = (rol) => rol === 'admin' || rol === 'profesor'

export { puedeCrearAsignaturas }
export default useRolOrganizacion
