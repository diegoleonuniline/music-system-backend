const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { verifyToken } = require('../middleware/auth');

// GET - Obtener recursos de una canción
router.get('/song/:songId', verifyToken, async (req, res) => {
    try {
        const { songId } = req.params;
        const { filter } = req.query;
        
        let query = `
            SELECT sr.*, u.first_name as user_name, u.last_name as user_last_name
            FROM song_resources sr
            LEFT JOIN users u ON sr.user_id = u.id
            WHERE sr.song_id = ?
        `;
        
        const params = [songId];
        
        if (filter === 'mine') {
            query += ' AND sr.user_id = ?';
            params.push(req.user.id);
        } else if (filter === 'shared') {
            query += ' AND sr.is_shared = 1';
        } else {
            query += ' AND (sr.is_shared = 1 OR sr.user_id = ?)';
            params.push(req.user.id);
        }
        
        query += ' ORDER BY sr.type, sr.created_at DESC';
        
        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET - Obtener un recurso específico
router.get('/:id', verifyToken, async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT sr.*, u.first_name as user_name
            FROM song_resources sr
            LEFT JOIN users u ON sr.user_id = u.id
            WHERE sr.id = ? AND (sr.is_shared = 1 OR sr.user_id = ?)
        `, [req.params.id, req.user.id]);
        
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Recurso no encontrado' });
        }
        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST - Crear recurso
router.post('/', verifyToken, async (req, res) => {
    try {
        const { song_id, type, title, content, file_url, file_type, is_shared } = req.body;
        
        if (!song_id) {
            return res.status(400).json({ error: 'song_id es requerido' });
        }
        
        const [result] = await pool.query(
            `INSERT INTO song_resources (song_id, user_id, type, title, content, file_url, file_type, is_shared) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [song_id, req.user.id, type || 'notes', title || null, content || null, file_url || null, file_type || null, is_shared !== undefined ? is_shared : 1]
        );
        
        res.status(201).json({
            id: result.insertId,
            song_id,
            user_id: req.user.id,
            type: type || 'notes',
            title, content, file_url, file_type,
            is_shared: is_shared !== undefined ? is_shared : 1
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT - Actualizar recurso
router.put('/:id', verifyToken, async (req, res) => {
    try {
        const [existing] = await pool.query(
            'SELECT * FROM song_resources WHERE id = ? AND user_id = ?',
            [req.params.id, req.user.id]
        );
        
        if (existing.length === 0) {
            return res.status(404).json({ error: 'Recurso no encontrado o no tienes permiso' });
        }
        
        const { type, title, content, file_url, file_type, is_shared } = req.body;
        const updates = [];
        const values = [];
        
        if (type !== undefined) { updates.push('type = ?'); values.push(type); }
        if (title !== undefined) { updates.push('title = ?'); values.push(title); }
        if (content !== undefined) { updates.push('content = ?'); values.push(content); }
        if (file_url !== undefined) { updates.push('file_url = ?'); values.push(file_url); }
        if (file_type !== undefined) { updates.push('file_type = ?'); values.push(file_type); }
        if (is_shared !== undefined) { updates.push('is_shared = ?'); values.push(is_shared); }
        
        if (updates.length > 0) {
            values.push(req.params.id);
            await pool.query(`UPDATE song_resources SET ${updates.join(', ')} WHERE id = ?`, values);
        }
        
        res.json({ id: parseInt(req.params.id), ...req.body });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE - Eliminar recurso
router.delete('/:id', verifyToken, async (req, res) => {
    try {
        const [existing] = await pool.query(
            'SELECT * FROM song_resources WHERE id = ? AND user_id = ?',
            [req.params.id, req.user.id]
        );
        
        if (existing.length === 0) {
            return res.status(404).json({ error: 'Recurso no encontrado o no tienes permiso' });
        }
        
        await pool.query('DELETE FROM song_resources WHERE id = ?', [req.params.id]);
        res.json({ message: 'Recurso eliminado' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
