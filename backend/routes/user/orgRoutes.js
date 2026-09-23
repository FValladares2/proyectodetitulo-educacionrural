const express = require('express')
const router = express.Router()
const orgServices = require('../../services/orgServices')
const { authenticate, getUserFromToken } = require('../../utils/auth')

router.get('/api/org/all', async (req, res) => {
    // public for testing purposes TODO: delete later
    try {
        const orgs = await orgServices.getAllOrgs()
        res.status(200).json(orgs)
    } catch (error) {
        res.status(500).json({ message: error.message })
    }
})

router.post('/api/org/create', async (req, res) => {
    try {
        const { nombre, id_usuario } = req.body

        if (!nombre || !id_usuario) {
            return res.status(400).json({ message: 'Faltan campos obligatorios.' })
        }

        const org = await orgServices.createOrg({
            nombre,
            admin: [id_usuario],
            usuarios: [id_usuario]
        })

        res.status(200).json(org)
    } catch (error) {
        console.error('Error al crear la organización:', error)
        res.status(500).json({ message: 'No se pudo crear la organización.' })
    }
})

router.get('/api/org/user', authenticate, async (req, res) => {
    try {
        const userId = await getUserFromToken(req.headers.authorization.split(' ')[1])
        const orgs = await orgServices.getAllOrgsWithUser(userId)
        res.status(200).json(orgs)
    } catch (error) {
        console.error('Error al obtener organizaciones:', error)
        res.status(500).json({ message: 'No se pudo obtener organizaciones.' })
    }
})

module.exports = router