const express = require('express');
const db = require('../config/database');
const { verifyToken, isGroupAdmin } = require('../middleware/auth');

const router = express.Router();

// Obtener categorías de mi grupo
router.get('/', verifyToken, async (req, res) => {
  try {
    const [categories] = await db.query(
      'SELECT * FROM categories WHERE group_id = ? ORDER BY name',
      [req.user.group_id]
    );
    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Crear categoría
router.post('/', verifyToken, isGroupAdmin, async (req, res) => {
  try {
    const { name, color } = req.body;
    const [result] = await db.query(
      'INSERT INTO categories (group_id, name, color) VALUES (?, ?, ?)',
      [req.user.group_id, name, color || '#3498db']
    );
    res.status(201).json({ id: result.insertId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Actualizar categoría
router.put('/:id', verifyToken, isGroupAdmin, async (req, res) => {
  try {
    const { name, color } = req.body;
    await db.query(
      'UPDATE categories SET name = ?, color = ? WHERE id = ? AND group_id = ?',
      [name, color, req.params.id, req.user.group_id]
    );
    res.json({ message: 'Categoría actualizada' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Eliminar categoría
router.delete('/:id', verifyToken, isGroupAdmin, async (req, res) => {
  try {
    await db.query('UPDATE songs SET category_id = NULL WHERE category_id = ? AND group_id = ?', [req.params.id, req.user.group_id]);
    await db.query('DELETE FROM categories WHERE id = ? AND group_id = ?', [req.params.id, req.user.group_id]);
    res.json({ message: 'Categoría eliminada' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
