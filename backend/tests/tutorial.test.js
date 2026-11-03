const fs = require('fs')
const path = require('path')
const { nombreDesde, leerPlantilla, leerTareas, carpetaRecursos } = require('../services/tutorialServices')

describe('plantilla de la asignatura tutorial', () => {
  afterEach(() => {
    delete process.env.TUTORIAL_PLANTILLA
  })

  test('el nombre es el primer título de nivel 1, fuera de bloques de código', () => {
    expect(nombreDesde('Texto\n## Sección\n# Mi guía\n# Otra')).toBe('Mi guía')
    expect(nombreDesde('```\n# no es un título\n```\n# Guía real')).toBe('Guía real')
    expect(nombreDesde('## Solo secciones')).toBe('Guía de la plataforma')
  })

  test('la plantilla incluida tiene nombre y contenido, sin comentarios', async () => {
    const plantilla = await leerPlantilla()
    expect(plantilla.nombre).toBe('Introducción al aula digital')
    expect(plantilla.formato_markup).not.toMatch(/<!--/)
    // las referencias de ejemplo del comentario inicial no cuentan
    expect(plantilla.archivos).not.toContain('archivo.pdf')
  })

  test('cada archivo y tarea que usa la plantilla existe', async () => {
    const plantilla = await leerPlantilla()
    expect(plantilla.archivos.length).toBeGreaterThan(0)
    for (const nombre of plantilla.archivos) {
      const ruta = path.join(carpetaRecursos(), nombre)
      expect({ nombre, existe: fs.existsSync(ruta) }).toEqual({ nombre, existe: true })
      expect(fs.statSync(ruta).size).toBeLessThanOrEqual(10 * 1024 * 1024)
    }
    const tareas = await leerTareas()
    for (const clave of plantilla.tareas) {
      expect(tareas[clave]?.titulo).toBeTruthy()
    }
  })

  test('sin archivo de plantilla no se crea nada', async () => {
    process.env.TUTORIAL_PLANTILLA = path.join(__dirname, 'no-existe.md')
    expect(await leerPlantilla()).toBeNull()
  })
})
