const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { verifyToken, isGroupAdmin } = require('../middleware/auth');

// GET - Obtener categorías del grupo
router.get('/', verifyToken, async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT * FROM categories WHERE group_id = ? ORDER BY name',
            [req.user.group_id]
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET - Obtener una categoría
router.get('/:id', verifyToken, async (req, res) => {
    try {
        const [rows] = await pool.query(
            'SELECT * FROM categories WHERE id = ? AND group_id = ?',
            [req.params.id, req.user.group_id]
        );
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Categoría no encontrada' });
        }
        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST - Crear categoría
router.post('/', verifyToken, isGroupAdmin, async (req, res) => {
    try {
        const { name, color } = req.body;
        
        if (!name) {
            return res.status(400).json({ error: 'El nombre es requerido' });
        }

        const [result] = await pool.query(
            'INSERT INTO categories (group_id, name, color) VALUES (?, ?, ?)',
            [req.user.group_id, name, color || '#3498db']
        );

        res.status(201).json({ 
            id: result.insertId, 
            group_id: req.user.group_id,
            name, 
            color: color || '#3498db'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT - Actualizar categoría
router.put('/:id', verifyToken, isGroupAdmin, async (req, res) => {
    try {
        const { name, color } = req.body;
        
        // Verificar que la categoría pertenece al grupo
        const [existing] = await pool.query(
            'SELECT * FROM categories WHERE id = ? AND group_id = ?',
            [req.params.id, req.user.group_id]
        );
        
        if (existing.length === 0) {
            return res.status(404).json({ error: 'Categoría no encontrada' });
        }

        await pool.query(
            'UPDATE categories SET name = ?, color = ? WHERE id = ? AND group_id = ?',
            [name || existing[0].name, color || existing[0].color, req.params.id, req.user.group_id]
        );

        res.json({ id: parseInt(req.params.id), name, color });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE - Eliminar categoría
router.delete('/:id', verifyToken, isGroupAdmin, async (req, res) => {
    try {
        // Verificar que la categoría pertenece al grupo
        const [existing] = await pool.query(
            'SELECT * FROM categories WHERE id = ? AND group_id = ?',
            [req.params.id, req.user.group_id]
        );
        
        if (existing.length === 0) {
            return res.status(404).json({ error: 'Categoría no encontrada' });
        }

        // Quitar categoría de las canciones que la usan
        await pool.query(
            'UPDATE songs SET category_id = NULL WHERE category_id = ? AND group_id = ?',
            [req.params.id, req.user.group_id]
        );

        await pool.query(
            'DELETE FROM categories WHERE id = ? AND group_id = ?',
            [req.params.id, req.user.group_id]
        );

        res.json({ message: 'Categoría eliminada' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
