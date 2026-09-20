const express = require('express')
const router = express.Router()
const orgServices = require('../../services/orgServices')

router.get('/api/org/all', async (req, res) => {
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
        res.status(500).json({ message: error.message })
    }
})

module.exports = router