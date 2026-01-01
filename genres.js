const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { verifyToken, isGroupAdmin } = require('../middleware/auth');

// GET - Obtener géneros del grupo
router.get('/', verifyToken, async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT * FROM genres WHERE group_id = ? ORDER BY name',
            [req.user.group_id]
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET - Obtener un género
router.get('/:id', verifyToken, async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT * FROM genres WHERE id = ? AND group_id = ?',
            [req.params.id, req.user.group_id]
        );
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Género no encontrado' });
        }
        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST - Crear género
router.post('/', verifyToken, isGroupAdmin, async (req, res) => {
    try {
        const { name } = req.body;
        
        if (!name) {
            return res.status(400).json({ error: 'El nombre es requerido' });
        }

        const [result] = await pool.query(
            'INSERT INTO genres (group_id, name) VALUES (?, ?)',
            [req.user.group_id, name]
        );

        res.status(201).json({ 
            id: result.insertId, 
            group_id: req.user.group_id,
            name
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT - Actualizar género
router.put('/:id', verifyToken, isGroupAdmin, async (req, res) => {
    try {
        const { name } = req.body;
        
        // Verificar que el género pertenece al grupo
        const [existing] = await pool.query(
            'SELECT * FROM genres WHERE id = ? AND group_id = ?',
            [req.params.id, req.user.group_id]
        );
        
        if (existing.length === 0) {
            return res.status(404).json({ error: 'Género no encontrado' });
        }

        await pool.query(
            'UPDATE genres SET name = ? WHERE id = ? AND group_id = ?',
            [name || existing[0].name, req.params.id, req.user.group_id]
        );

        res.json({ id: parseInt(req.params.id), name });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE - Eliminar género
router.delete('/:id', verifyToken, isGroupAdmin, async (req, res) => {
    try {
        // Verificar que el género pertenece al grupo
        const [existing] = await pool.query(
            'SELECT * FROM genres WHERE id = ? AND group_id = ?',
            [req.params.id, req.user.group_id]
        );
        
        if (existing.length === 0) {
            return res.status(404).json({ error: 'Género no encontrado' });
        }

        // Quitar género de las canciones que lo usan
        await pool.query(
            'UPDATE songs SET genre_id = NULL WHERE genre_id = ? AND group_id = ?',
            [req.params.id, req.user.group_id]
        );

        await pool.query(
            'DELETE FROM genres WHERE id = ? AND group_id = ?',
            [req.params.id, req.user.group_id]
        );

        res.json({ message: 'Género eliminado' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
