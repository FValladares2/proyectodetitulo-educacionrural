const app = require('./app')
const { connectMongo, isMongoConnected } = require('./config/mongo')
const { iniciarEnvioCorreos } = require('./services/correoServices')
const { iniciarRecordatorios } = require('./services/recordatorioServices')

const port = process.env.PORT || 4000

const startServer = async () => {
  try {
    await connectMongo()
    // procesos periódicos: envío de la cola de correos y recordatorios de tareas por cerrar
    if (isMongoConnected()) {
      iniciarEnvioCorreos()
      iniciarRecordatorios()
    }
    app.listen(port, () => {
      console.log(`Backend server listening on http://localhost:${port}`)
    })
  } catch (error) {
    console.error('Failed to start server:', error)
    process.exit(1)
  }
}

startServer()