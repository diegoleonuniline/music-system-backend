const express = require('express');
const router = express.Router();
const db = require('../config/database');
const auth = require('../middleware/auth');

router.get('/', auth, async (req, res) => {
    try {
        const [artists] = await db.query('SELECT * FROM artists WHERE group_id = ? ORDER BY name', [req.user.group_id]);
        res.json(artists);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/', auth, async (req, res) => {
    try {
        const { name, image_url } = req.body;
        const [result] = await db.query('INSERT INTO artists (group_id, name, image_url) VALUES (?, ?, ?)', [req.user.group_id, name, image_url]);
        res.status(201).json({ id: result.insertId, name, image_url });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'Artista ya existe' });
        res.status(500).json({ error: error.message });
    }
});

router.put('/:id', auth, async (req, res) => {
    try {
        const { name, image_url } = req.body;
        await db.query('UPDATE artists SET name = ?, image_url = ? WHERE id = ? AND group_id = ?', [name, image_url, req.params.id, req.user.group_id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/:id', auth, async (req, res) => {
    try {
        await db.query('DELETE FROM artists WHERE id = ? AND group_id = ?', [req.params.id, req.user.group_id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
