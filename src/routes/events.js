const express = require('express');
const db = require('../config/database');
const { verifyToken, isGroupAdmin } = require('../middleware/auth');

const router = express.Router();

// Obtener todos los eventos
router.get('/', verifyToken, async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    let query = `
      SELECT e.*, s.name as setlist_name
      FROM events e
      LEFT JOIN setlists s ON e.setlist_id = s.id
      WHERE e.group_id = ? AND e.is_active = 1
    `;
    const params = [req.user.group_id];

    if (start_date && end_date) {
      query += ' AND e.event_date BETWEEN ? AND ?';
      params.push(start_date, end_date);
    }

    query += ' ORDER BY e.event_date, e.start_time';

    const [events] = await db.query(query, params);
    res.json(events);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener un evento
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const [events] = await db.query(`
      SELECT e.*, s.name as setlist_name
      FROM events e
      LEFT JOIN setlists s ON e.setlist_id = s.id
      WHERE e.id = ? AND e.group_id = ?
    `, [req.params.id, req.user.group_id]);
    
    if (events.length === 0) {
      return res.status(404).json({ error: 'Evento no encontrado' });
    }

    // Obtener asistencia
    const [attendance] = await db.query(`
      SELECT ea.*, u.first_name, u.last_name, u.email
      FROM event_attendance ea
      JOIN users u ON ea.user_id = u.id
      WHERE ea.event_id = ?
    `, [req.params.id]);

    res.json({ ...events[0], attendance });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Crear evento
router.post('/', verifyToken, isGroupAdmin, async (req, res) => {
  try {
    const { name, venue, address, city, event_date, start_time, end_time, google_maps_url, uniform, setlist_id, payment, notes } = req.body;
    
    const [result] = await db.query(
      `INSERT INTO events (group_id, name, venue, address, city, event_date, start_time, end_time, google_maps_url, uniform, setlist_id, payment, notes) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.group_id, name, venue, address, city, event_date, start_time, end_time, google_maps_url, uniform, setlist_id, payment, notes]
    );
    res.status(201).json({ id: result.insertId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Actualizar evento
router.put('/:id', verifyToken, isGroupAdmin, async (req, res) => {
  try {
    const { name, venue, address, city, event_date, start_time, end_time, google_maps_url, uniform, setlist_id, payment, payment_status, status, notes } = req.body;
    
    await db.query(
      `UPDATE events SET name = ?, venue = ?, address = ?, city = ?, event_date = ?, start_time = ?, end_time = ?, google_maps_url = ?, uniform = ?, setlist_id = ?, payment = ?, payment_status = ?, status = ?, notes = ? 
       WHERE id = ? AND group_id = ?`,
      [name, venue, address, city, event_date, start_time, end_time, google_maps_url, uniform, setlist_id, payment, payment_status, status, notes, req.params.id, req.user.group_id]
    );
    res.json({ message: 'Evento actualizado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Confirmar asistencia
router.post('/:id/attendance', verifyToken, async (req, res) => {
  try {
    const { status } = req.body;
    await db.query(
      `INSERT INTO event_attendance (event_id, user_id, status) VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE status = ?`,
      [req.params.id, req.user.id, status, status]
    );
    res.json({ message: 'Asistencia registrada' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Eliminar evento
router.delete('/:id', verifyToken, isGroupAdmin, async (req, res) => {
  try {
    await db.query('UPDATE events SET is_active = 0 WHERE id = ? AND group_id = ?', [req.params.id, req.user.group_id]);
    res.json({ message: 'Evento eliminado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
