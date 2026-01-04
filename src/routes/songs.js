const express = require('express');
const db = require('../config/database');
const { verifyToken, isGroupAdmin } = require('../middleware/auth');

const router = express.Router();

// Obtener todas las canciones de mi grupo
router.get('/', verifyToken, async (req, res) => {
  try {
    const [songs] = await db.query(`
      SELECT s.*, c.name as category_name, c.color as category_color, g.name as genre_name, a.name as artist_name
      FROM songs s
      LEFT JOIN categories c ON s.category_id = c.id
      LEFT JOIN genres g ON s.genre_id = g.id
      LEFT JOIN artists a ON s.artist_id = a.id
      WHERE s.group_id = ? AND s.is_active = 1
      ORDER BY s.name
    `, [req.user.group_id]);
    res.json(songs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener favoritas
router.get('/favorites', verifyToken, async (req, res) => {
  try {
    const [songs] = await db.query(`
      SELECT s.*, c.name as category_name, g.name as genre_name, a.name as artist_name
      FROM songs s
      LEFT JOIN categories c ON s.category_id = c.id
      LEFT JOIN genres g ON s.genre_id = g.id
      LEFT JOIN artists a ON s.artist_id = a.id
      WHERE s.group_id = ? AND s.is_favorite = 1 AND s.is_active = 1
      ORDER BY s.name
    `, [req.user.group_id]);
    res.json(songs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener una canción
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const [songs] = await db.query(`
      SELECT s.*, c.name as category_name, g.name as genre_name, a.name as artist_name
      FROM songs s
      LEFT JOIN categories c ON s.category_id = c.id
      LEFT JOIN genres g ON s.genre_id = g.id
      LEFT JOIN artists a ON s.artist_id = a.id
      WHERE s.id = ? AND s.group_id = ?
    `, [req.params.id, req.user.group_id]);
    
    if (songs.length === 0) {
      return res.status(404).json({ error: 'Canción no encontrada' });
    }
    res.json(songs[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Crear canción
router.post('/', verifyToken, isGroupAdmin, async (req, res) => {
  try {
    const { name, artist, artist_id, category_id, genre_id, song_type, lyrics_type, lyrics, video_url, audio_url, duration_seconds, bpm, musical_key, time_signature, is_favorite, notes } = req.body;
    
    const [result] = await db.query(
      `INSERT INTO songs (group_id, name, artist, artist_id, category_id, genre_id, song_type, lyrics_type, lyrics, video_url, audio_url, duration_seconds, bpm, musical_key, time_signature, is_favorite, notes) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.group_id, name, artist, artist_id, category_id, genre_id, song_type, lyrics_type, lyrics, video_url, audio_url, duration_seconds, bpm, musical_key, time_signature, is_favorite || 0, notes]
    );
    res.status(201).json({ id: result.insertId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Actualizar canción
router.put('/:id', verifyToken, isGroupAdmin, async (req, res) => {
  try {
    const { name, artist, artist_id, category_id, genre_id, song_type, lyrics_type, lyrics, video_url, audio_url, duration_seconds, bpm, musical_key, time_signature, is_favorite, notes } = req.body;
    
    await db.query(
      `UPDATE songs SET name = ?, artist = ?, artist_id = ?, category_id = ?, genre_id = ?, song_type = ?, lyrics_type = ?, lyrics = ?, video_url = ?, audio_url = ?, duration_seconds = ?, bpm = ?, musical_key = ?, time_signature = ?, is_favorite = ?, notes = ? 
       WHERE id = ? AND group_id = ?`,
      [name, artist, artist_id, category_id, genre_id, song_type, lyrics_type, lyrics, video_url, audio_url, duration_seconds, bpm, musical_key, time_signature, is_favorite || 0, notes, req.params.id, req.user.group_id]
    );
    res.json({ message: 'Canción actualizada' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Marcar/Desmarcar favorita
router.patch('/:id/favorite', verifyToken, async (req, res) => {
  try {
    const { is_favorite } = req.body;
    await db.query(
      'UPDATE songs SET is_favorite = ? WHERE id = ? AND group_id = ?',
      [is_favorite, req.params.id, req.user.group_id]
    );
    res.json({ message: 'Favorito actualizado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Eliminar canción (soft delete)
router.delete('/:id', verifyToken, isGroupAdmin, async (req, res) => {
  try {
    await db.query('UPDATE songs SET is_active = 0 WHERE id = ? AND group_id = ?', [req.params.id, req.user.group_id]);
    res.json({ message: 'Canción eliminada' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
