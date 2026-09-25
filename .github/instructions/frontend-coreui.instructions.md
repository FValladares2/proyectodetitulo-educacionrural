---
name: Frontend CoreUI conventions
description: Use when creating or modifying React, JSX, Sass, Vite, or frontend documentation in this repository.
applyTo: "frontend/**"
---

# Frontend CoreUI conventions

## Stack and component library

- This frontend uses React 19, Vite, React Router 7, Redux 5, Sass, and CoreUI React 5.
- Use components from `@coreui/react` and icons from `@coreui/icons-react` where applicable.
- Do not introduce Tailwind CSS, Material UI, another component library, or a second CSS framework. Use CoreUI and Bootstrap 5 utilities.
- Use Chart.js through `@coreui/react-chartjs` for charts.
- Check the existing implementation and the CoreUI React documentation before inventing component APIs.

## React and project structure

- Use functional components and Hooks. Follow the Rules of Hooks.
- Prefer `const` arrow functions, destructured props, and descriptive PascalCase component names.
- Add `PropTypes` for component props, including new reusable components.
- Keep components focused; extract reusable behavior into custom Hooks or existing services when appropriate.
- Use `React.lazy` and `Suspense` for route-level code splitting when adding pages.
- Put reusable components in `frontend/src/components`, route views in `frontend/src/views`, layout wrappers in `frontend/src/layout`, services in `frontend/src/services`, and shared styling in `frontend/src/scss`.
- Preserve the existing `.jsx` naming convention. Key application files include `src/App.jsx`, `src/index.jsx`, `src/routes.js`, `src/_nav.jsx`, and `src/store.js`.

## Routing and state

- Preserve the existing HashRouter and protected-route architecture unless the task explicitly requires a change.
- Define protected route entries in `src/routes.js`; keep public authentication and error routes consistent with `src/App.jsx`.
- Use Redux for shared application state such as theme and sidebar state. Use local state for state owned by one component.
- Reuse existing API services in `src/services` rather than duplicating request logic in views.

## Styling and accessibility

- Prefer CoreUI components, Bootstrap utilities, and CoreUI CSS custom properties before adding custom CSS.
- Keep global theme changes in `src/scss/style.scss` or `src/scss/_custom.scss`; keep component-specific styles close to their component when that pattern already exists.
- Preserve CoreUI color-mode support, responsive behavior, and semantic HTML.
- Provide accessible labels, meaningful alt text, keyboard operation, and visible focus states for interactive UI.

## Code style and validation

- Follow the repository's Prettier style: no semicolons, single quotes, and two-space indentation.
- Keep changes focused and preserve existing public APIs and project conventions.
- Do not modify Vite or other build configuration unless the task requires it.
- From `frontend/`, run `npm run lint` and `npm run build` after frontend changes when practical.