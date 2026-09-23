import React from 'react'
import { useLocation, matchPath } from 'react-router-dom'

import { routes } from '../routes'

import { CBreadcrumb, CBreadcrumbItem } from '@coreui/react'

const AppBreadcrumb = () => {
  const location = useLocation()
  const currentLocation = location.pathname

  const getRouteName = (pathname, routes) => {
    const currentRoute = routes.find((route) => route.path === pathname)
    return currentRoute ? currentRoute.name : false
  }

  const getBreadcrumbs = (location) => {
    const breadcrumbs = []
    location.split('/').reduce((prev, curr, index, array) => {
      const currentPathname = `${prev}/${curr}`
      const routeName = getRouteName(currentPathname, routes)
      routeName &&
        breadcrumbs.push({
          pathname: currentPathname,
          name: routeName,
          active: index + 1 === array.length ? true : false,
        })
      return currentPathname
    })
    return breadcrumbs
  }

  // Handle dynamic routes (e.g. /asignaturas/:id)
  const getDynamicBreadcrumb = () => {
    for (const route of routes) {
      if (!route.path.includes(':')) continue
      const match = matchPath(route.path, currentLocation)
      if (match) {
        const parentPath = route.path.split('/:')[0]
        const parentRoute = routes.find((r) => r.path === parentPath)
        const crumbs = []
        if (parentRoute) {
          crumbs.push({ pathname: parentPath, name: parentRoute.name, active: false })
        }
        // Use the name passed via router state, otherwise fall back to the static route name
        const leafName = location.state?.nombre || route.name
        crumbs.push({ pathname: currentLocation, name: leafName, active: true })
        return crumbs
      }
    }
    return null
  }

  const dynamicCrumbs = getDynamicBreadcrumb()
  const breadcrumbs = dynamicCrumbs ?? getBreadcrumbs(currentLocation)

  return (
    <CBreadcrumb className="my-0">
      <CBreadcrumbItem href="#/hogar">Hogar</CBreadcrumbItem>
      {breadcrumbs.map((breadcrumb, index) => {
        return (
          <CBreadcrumbItem
            {...(breadcrumb.active ? { active: true } : { href: `#${breadcrumb.pathname}` })}
            key={index}
          >
            {breadcrumb.name}
          </CBreadcrumbItem>
        )
      })}
    </CBreadcrumb>
  )
}

export default React.memo(AppBreadcrumb)
