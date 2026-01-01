const express = require('express');
const db = require('../config/database');
const { verifyToken, isGroupAdmin } = require('../middleware/auth');

const router = express.Router();

// Obtener lista de ensayos
router.get('/', verifyToken, async (req, res) => {
  try {
    const [rehearsals] = await db.query(`
      SELECT r.*, s.name as song_name, s.artist, s.video_url
      FROM rehearsals r
      JOIN songs s ON r.song_id = s.id
      WHERE r.group_id = ? AND r.status != 'ready'
      ORDER BY 
        CASE r.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
        r.target_date
    `, [req.user.group_id]);
    res.json(rehearsals);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Agregar canción a ensayos
router.post('/', verifyToken, isGroupAdmin, async (req, res) => {
  try {
    const { song_id, priority, target_date, notes } = req.body;
    const [result] = await db.query(
      'INSERT INTO rehearsals (group_id, song_id, priority, target_date, notes) VALUES (?, ?, ?, ?, ?)',
      [req.user.group_id, song_id, priority || 'medium', target_date, notes]
    );
    res.status(201).json({ id: result.insertId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Actualizar estado de ensayo
router.patch('/:id/status', verifyToken, isGroupAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    let query = 'UPDATE rehearsals SET status = ?';
    const params = [status];
    
    if (status === 'ready') {
      query += ', moved_to_repertoire_at = NOW()';
    }
    
    query += ' WHERE id = ? AND group_id = ?';
    params.push(req.params.id, req.user.group_id);
    
    await db.query(query, params);
    res.json({ message: 'Estado actualizado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Pasar a repertorio (marcar como listo)
router.post('/:id/move-to-repertoire', verifyToken, isGroupAdmin, async (req, res) => {
  try {
    await db.query(
      'UPDATE rehearsals SET status = "ready", moved_to_repertoire_at = NOW() WHERE id = ? AND group_id = ?',
      [req.params.id, req.user.group_id]
    );
    res.json({ message: 'Canción movida a repertorio' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Eliminar de ensayos
router.delete('/:id', verifyToken, isGroupAdmin, async (req, res) => {
  try {
    await db.query('DELETE FROM rehearsals WHERE id = ? AND group_id = ?', [req.params.id, req.user.group_id]);
    res.json({ message: 'Eliminado de ensayos' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
