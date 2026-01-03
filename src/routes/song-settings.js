const express = require('express');
const router = express.Router();
const db = require('../config/database');
const auth = require('../middleware/auth');

// GET configuraciones de una canción por proyecto
router.get('/song/:songId', auth, async (req, res) => {
    try {
        const [settings] = await db.query(`
            SELECT sps.*, p.name as project_name, p.color
            FROM song_project_settings sps
            JOIN my_projects p ON sps.project_id = p.id
            WHERE sps.song_id = ? AND p.group_id = ?
        `, [req.params.songId, req.user.group_id]);
        res.json(settings);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET configuraciones de un proyecto
router.get('/project/:projectId', auth, async (req, res) => {
    try {
        const [settings] = await db.query(`
            SELECT sps.*, s.name as song_name, a.name as artist_name
            FROM song_project_settings sps
            JOIN songs s ON sps.song_id = s.id
            LEFT JOIN artists a ON s.artist_id = a.id
            JOIN my_projects p ON sps.project_id = p.id
            WHERE sps.project_id = ? AND p.group_id = ?
        `, [req.params.projectId, req.user.group_id]);
        res.json(settings);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST crear/actualizar configuración
router.post('/', auth, async (req, res) => {
    try {
        const { song_id, project_id, musical_key, notes } = req.body;
        const [result] = await db.query(`
            INSERT INTO song_project_settings (song_id, project_id, musical_key, notes)
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE musical_key = ?, notes = ?
        `, [song_id, project_id, musical_key, notes, musical_key, notes]);
        res.status(201).json({ success: true, id: result.insertId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE eliminar configuración
router.delete('/:id', auth, async (req, res) => {
    try {
        await db.query(`
            DELETE sps FROM song_project_settings sps
            JOIN my_projects p ON sps.project_id = p.id
            WHERE sps.id = ? AND p.group_id = ?
        `, [req.params.id, req.user.group_id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
