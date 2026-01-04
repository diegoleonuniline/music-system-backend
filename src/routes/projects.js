const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { verifyToken } = require('../middleware/auth');

router.get('/', verifyToken, async (req, res) => {
    try {
        const [projects] = await db.query('SELECT * FROM my_projects WHERE group_id = ? ORDER BY name', [req.user.group_id]);
        res.json(projects);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/', verifyToken, async (req, res) => {
    try {
        const { name, description, color } = req.body;
        const [result] = await db.query('INSERT INTO my_projects (group_id, name, description, color) VALUES (?, ?, ?, ?)', [req.user.group_id, name, description, color || '#4F46E5']);
        res.status(201).json({ id: result.insertId, name, description, color });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'Proyecto ya existe' });
        res.status(500).json({ error: error.message });
    }
});

router.put('/:id', verifyToken, async (req, res) => {
    try {
        const { name, description, color } = req.body;
        await db.query('UPDATE my_projects SET name = ?, description = ?, color = ? WHERE id = ? AND group_id = ?', [name, description, color, req.params.id, req.user.group_id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/:id', verifyToken, async (req, res) => {
    try {
        await db.query('DELETE FROM my_projects WHERE id = ? AND group_id = ?', [req.params.id, req.user.group_id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
