/**
 * Plantillas de correo: cada tipo arma asunto, texto y HTML; el HTML escapa los datos y los
 * correos de notificaciones incluyen el enlace para desuscribirse.
 */
process.env.APP_NOMBRE = 'Aula Rural'
process.env.APP_URL = 'https://aula.test/'

const { renderizarCorreo, enlaceApp, escaparHtml } = require('../services/correoPlantillas')

const extra = { enlace: 'https://aula.test/#/asignaturas/1', desuscribir: 'https://aula.test/api/notificaciones/desuscribir?u=1' }
const limite = new Date('2026-03-08T23:59:00Z')

const DATOS = {
  tarea_creada: { titulo: 'Guía 1', asignatura: 'Ciencias', limite },
  tarea_por_cerrar: { titulo: 'Guía 1', asignatura: 'Ciencias', limite },
  entrega_calificada: { titulo: 'Guía 1', asignatura: 'Ciencias' },
  agregado_asignatura: { asignatura: 'Ciencias' },
  agregado_organizacion: { organizacion: 'Escuela Rural' },
}

describe('plantillas de correo', () => {
  test.each(Object.keys(DATOS))('%s arma asunto, texto y HTML con el enlace y la desuscripción', (tipo) => {
    const correo = renderizarCorreo(tipo, DATOS[tipo], extra)
    expect(correo.asunto).toBeTruthy()
    expect(correo.texto).toContain(extra.enlace)
    expect(correo.texto).toContain(extra.desuscribir)
    expect(correo.html).toContain(escaparHtml(extra.enlace))
    expect(correo.html).toContain('Dejar de recibir este tipo de aviso')
    expect(correo.html).toContain('Aula Rural')
  })

  test('la calificación nunca aparece en el correo de entrega revisada', () => {
    const correo = renderizarCorreo('entrega_calificada', { ...DATOS.entrega_calificada, calificacion: 6.5, comentario: 'Bien' }, extra)
    expect(correo.texto).not.toMatch(/6[.,]5|Bien/)
    expect(correo.html).not.toMatch(/6[.,]5|Bien/)
  })

  test('el HTML escapa los datos; el texto plano los deja tal cual', () => {
    const correo = renderizarCorreo('agregado_asignatura', { asignatura: '<script>alert("x")</script>' }, extra)
    expect(correo.html).not.toContain('<script>')
    expect(correo.html).toContain('&lt;script&gt;')
    expect(correo.texto).toContain('<script>')
  })

  test('la invitación indica la vigencia y no ofrece desuscribirse', () => {
    const correo = renderizarCorreo(
      'cuenta_creada',
      { nombre: 'Carla', organizacion: 'Escuela Rural', horas: 72 },
      { enlace: 'https://aula.test/#/authentication/establecer?token=abc' },
    )
    expect(correo.texto).toMatch(/72 horas/)
    expect(correo.texto).toContain('token=abc')
    expect(correo.html).not.toContain('Dejar de recibir')
  })

  test('un tipo desconocido no arma correo', () => {
    expect(renderizarCorreo('no_existe', {}, extra)).toBeNull()
  })

  test('los enlaces usan APP_URL sin la barra final y rutas del HashRouter', () => {
    expect(enlaceApp('/hogar')).toBe('https://aula.test/#/hogar')
  })

  test('escaparHtml cubre los cinco caracteres especiales y valores vacíos', () => {
    expect(escaparHtml(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&#39;')
    expect(escaparHtml(null)).toBe('')
  })
})
