const express = require('express')
const router = express.Router()
const authRoutes = require('./user/authRoutes')
const orgRoutes = require('./user/orgRoutes')
const asignRoutes = require('./classroom/asignRoutes')

// rutas a importar de otros archivos
// ej: const <route> = require('./routefile')

// router.use(<route>)

router.use(authRoutes)
router.use(orgRoutes)
router.use(asignRoutes)

router.get('/api/health', (req, res) => {
    res.status(200).json({ message: 'API is healthy' })
})

module.exports = router;