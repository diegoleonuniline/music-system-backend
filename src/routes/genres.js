const express = require('express');
const db = require('../config/database');
const { verifyToken, isGroupAdmin } = require('../middleware/auth');

const router = express.Router();

// Obtener géneros de mi grupo
router.get('/', verifyToken, async (req, res) => {
  try {
    const [genres] = await db.query(
      'SELECT * FROM genres WHERE group_id = ? ORDER BY name',
      [req.user.group_id]
    );
    res.json(genres);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Crear género
router.post('/', verifyToken, isGroupAdmin, async (req, res) => {
  try {
    const { name } = req.body;
    const [result] = await db.query(
      'INSERT INTO genres (group_id, name) VALUES (?, ?)',
      [req.user.group_id, name]
    );
    res.status(201).json({ id: result.insertId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Actualizar género
router.put('/:id', verifyToken, isGroupAdmin, async (req, res) => {
  try {
    const { name } = req.body;
    await db.query(
      'UPDATE genres SET name = ? WHERE id = ? AND group_id = ?',
      [name, req.params.id, req.user.group_id]
    );
    res.json({ message: 'Género actualizado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', verifyToken, isGroupAdmin, async (req, res) => {
  try {
    await db.query('UPDATE songs SET genre_id = NULL WHERE genre_id = ? AND group_id = ?', [req.params.id, req.user.group_id]);
    await db.query('DELETE FROM genres WHERE id = ? AND group_id = ?', [req.params.id, req.user.group_id]);
    res.json({ message: 'Género eliminado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
