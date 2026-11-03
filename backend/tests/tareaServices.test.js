/**
 * Reglas puras de las tareas: estado según la hora del servidor y validación de los datos de
 * una tarea y de una calificación. Sin base de datos.
 */
const { estadoTarea, validarDatosTarea, validarCalificacion } = require('../services/tareaServices')

const apertura = new Date('2026-03-01T10:00:00Z')
const limite = new Date('2026-03-08T23:59:00Z')
const tarea = { apertura, limite }
const nueva = (cambios = {}) => ({
  titulo: 'Guía 1',
  apertura: apertura.toISOString(),
  limite: limite.toISOString(),
  ...cambios,
})

describe('estadoTarea', () => {
  test('antes de la apertura está pendiente', () => {
    expect(estadoTarea(tarea, new Date(apertura.getTime() - 1))).toBe('pendiente')
  })

  test('desde la apertura hasta el límite, ambos incluidos, está abierta', () => {
    expect(estadoTarea(tarea, apertura)).toBe('abierta')
    expect(estadoTarea(tarea, new Date('2026-03-05T12:00:00Z'))).toBe('abierta')
    expect(estadoTarea(tarea, limite)).toBe('abierta')
  })

  test('después del límite está cerrada', () => {
    expect(estadoTarea(tarea, new Date(limite.getTime() + 1))).toBe('cerrada')
  })
})

describe('validarDatosTarea al crear', () => {
  test('acepta una tarea válida, limpia el título y deja la descripción vacía', () => {
    const { datos, message } = validarDatosTarea(nueva({ titulo: '  Guía 1  ' }))
    expect(message).toBeUndefined()
    expect(datos).toEqual({ titulo: 'Guía 1', descripcion: '', apertura, limite })
  })

  test('el título es obligatorio y tiene hasta 200 caracteres', () => {
    expect(validarDatosTarea(nueva({ titulo: '   ' })).message).toMatch(/título/)
    expect(validarDatosTarea(nueva({ titulo: undefined })).message).toMatch(/título/)
    expect(validarDatosTarea(nueva({ titulo: 'a'.repeat(201) })).message).toMatch(/título/)
    expect(validarDatosTarea(nueva({ titulo: 'a'.repeat(200) })).datos.titulo).toHaveLength(200)
  })

  test('la descripción debe ser texto de hasta 20000 caracteres', () => {
    expect(validarDatosTarea(nueva({ descripcion: 42 })).message).toMatch(/descripción/)
    expect(validarDatosTarea(nueva({ descripcion: 'a'.repeat(20001) })).message).toMatch(/descripción/)
    expect(validarDatosTarea(nueva({ descripcion: '**Lee** la guía' })).datos.descripcion).toBe('**Lee** la guía')
  })

  test('ambas fechas son obligatorias y deben ser válidas', () => {
    expect(validarDatosTarea(nueva({ apertura: undefined })).message).toMatch(/apertura/)
    expect(validarDatosTarea(nueva({ limite: '' })).message).toMatch(/limite/)
    expect(validarDatosTarea(nueva({ limite: 'mañana' })).message).toMatch(/limite/)
  })

  test('la apertura debe ser anterior al límite (iguales no sirven)', () => {
    expect(validarDatosTarea(nueva({ limite: apertura.toISOString() })).message).toMatch(/anterior/)
    expect(validarDatosTarea(nueva({ apertura: limite.toISOString(), limite: apertura.toISOString() })).message).toMatch(
      /anterior/,
    )
  })
})

describe('validarDatosTarea al editar', () => {
  const actual = { titulo: 'Guía 1', descripcion: 'Texto', apertura, limite }

  test('solo devuelve los campos enviados; los demás se conservan', () => {
    expect(validarDatosTarea({ titulo: 'Guía 1 corregida' }, actual).datos).toEqual({ titulo: 'Guía 1 corregida' })
    expect(validarDatosTarea({}, actual).datos).toEqual({})
  })

  test('una fecha nueva se compara con la que se conserva', () => {
    const antesDeApertura = new Date(apertura.getTime() - 60 * 1000).toISOString()
    expect(validarDatosTarea({ limite: antesDeApertura }, actual).message).toMatch(/anterior/)
    const nuevoLimite = new Date('2026-03-15T23:59:00Z')
    expect(validarDatosTarea({ limite: nuevoLimite.toISOString() }, actual).datos).toEqual({ limite: nuevoLimite })
  })

  test('un título enviado vacío se rechaza aunque exista uno guardado', () => {
    expect(validarDatosTarea({ titulo: '' }, actual).message).toMatch(/título/)
  })
})

describe('validarCalificacion', () => {
  test('acepta un número o null, con un comentario opcional que se limpia', () => {
    expect(validarCalificacion({ calificacion: 6.5, comentario: '  Buen trabajo ' }).datos).toEqual({
      calificacion: 6.5,
      comentario: 'Buen trabajo',
    })
    expect(validarCalificacion({}).datos).toEqual({ calificacion: null, comentario: '' })
  })

  test('rechaza calificaciones que no son números finitos', () => {
    for (const invalida of ['7', NaN, Infinity, true, {}]) {
      expect(validarCalificacion({ calificacion: invalida }).message).toMatch(/número/)
    }
  })

  test('el comentario debe ser texto de hasta 2000 caracteres', () => {
    expect(validarCalificacion({ calificacion: 5, comentario: 3 }).message).toMatch(/comentario/)
    expect(validarCalificacion({ calificacion: 5, comentario: 'a'.repeat(2001) }).message).toMatch(/comentario/)
  })
})
