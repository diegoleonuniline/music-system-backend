const express = require('express');
const db = require('../config/database');
const { verifyToken, isGroupAdmin } = require('../middleware/auth');

const router = express.Router();

// Obtener todos los setlists
router.get('/', verifyToken, async (req, res) => {
  try {
    const [setlists] = await db.query(`
      SELECT s.*, 
        (SELECT COUNT(*) FROM setlist_songs WHERE setlist_id = s.id) as total_songs
      FROM setlists s
      WHERE s.group_id = ? AND s.is_active = 1
      ORDER BY s.created_at DESC
    `, [req.user.group_id]);
    res.json(setlists);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener un setlist con sus canciones
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const [setlists] = await db.query(
      'SELECT * FROM setlists WHERE id = ? AND group_id = ?',
      [req.params.id, req.user.group_id]
    );
    
    if (setlists.length === 0) {
      return res.status(404).json({ error: 'Setlist no encontrado' });
    }

    const [songs] = await db.query(`
      SELECT ss.*, s.name, s.artist, s.duration_seconds, s.video_url, s.lyrics, s.musical_key, s.bpm,
             c.name as category_name, g.name as genre_name
      FROM setlist_songs ss
      JOIN songs s ON ss.song_id = s.id
      LEFT JOIN categories c ON s.category_id = c.id
      LEFT JOIN genres g ON s.genre_id = g.id
      WHERE ss.setlist_id = ?
      ORDER BY ss.position
    `, [req.params.id]);

    res.json({ ...setlists[0], songs });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Crear setlist
router.post('/', verifyToken, isGroupAdmin, async (req, res) => {
  try {
    const { name, description } = req.body;
    const [result] = await db.query(
      'INSERT INTO setlists (group_id, name, description) VALUES (?, ?, ?)',
      [req.user.group_id, name, description]
    );
    res.status(201).json({ id: result.insertId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Actualizar setlist
router.put('/:id', verifyToken, isGroupAdmin, async (req, res) => {
  try {
    const { name, description } = req.body;
    await db.query(
      'UPDATE setlists SET name = ?, description = ? WHERE id = ? AND group_id = ?',
      [name, description, req.params.id, req.user.group_id]
    );
    res.json({ message: 'Setlist actualizado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Agregar canción al setlist
router.post('/:id/songs', verifyToken, isGroupAdmin, async (req, res) => {
  try {
    const { song_id, position } = req.body;
    
    // Obtener la última posición si no se especifica
    let pos = position;
    if (!pos) {
      const [lastPos] = await db.query(
        'SELECT MAX(position) as max_pos FROM setlist_songs WHERE setlist_id = ?',
        [req.params.id]
      );
      pos = (lastPos[0].max_pos || 0) + 1;
    }
    
    const [result] = await db.query(
      'INSERT INTO setlist_songs (setlist_id, song_id, position) VALUES (?, ?, ?)',
      [req.params.id, song_id, pos]
    );
    
    // Actualizar duración total
    await updateSetlistDuration(req.params.id);
    
    res.status(201).json({ id: result.insertId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reordenar canciones del setlist
router.put('/:id/reorder', verifyToken, isGroupAdmin, async (req, res) => {
  try {
    const { songs } = req.body; // Array de { id: setlist_song_id, position: nueva_posicion }
    
    for (const song of songs) {
      await db.query(
        'UPDATE setlist_songs SET position = ? WHERE id = ? AND setlist_id = ?',
        [song.position, song.id, req.params.id]
      );
    }
    
    res.json({ message: 'Orden actualizado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Eliminar canción del setlist
router.delete('/:id/songs/:songId', verifyToken, isGroupAdmin, async (req, res) => {
  try {
    await db.query(
      'DELETE FROM setlist_songs WHERE setlist_id = ? AND id = ?',
      [req.params.id, req.params.songId]
    );
    await updateSetlistDuration(req.params.id);
    res.json({ message: 'Canción eliminada del setlist' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Eliminar setlist
router.delete('/:id', verifyToken, isGroupAdmin, async (req, res) => {
  try {
    await db.query('UPDATE setlists SET is_active = 0 WHERE id = ? AND group_id = ?', [req.params.id, req.user.group_id]);
    res.json({ message: 'Setlist eliminado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Función auxiliar para actualizar duración
async function updateSetlistDuration(setlistId) {
  await db.query(`
    UPDATE setlists SET total_duration_seconds = (
      SELECT COALESCE(SUM(s.duration_seconds), 0)
      FROM setlist_songs ss
      JOIN songs s ON ss.song_id = s.id
      WHERE ss.setlist_id = ?
    ) WHERE id = ?
  `, [setlistId, setlistId]);
}

module.exports = router;
