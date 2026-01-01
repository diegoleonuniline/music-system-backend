const express = require('express');
const db = require('../config/database');
const { verifyToken, isSuperAdmin } = require('../middleware/auth');

const router = express.Router();

// Obtener todos los grupos (Super Admin)
router.get('/', verifyToken, isSuperAdmin, async (req, res) => {
  try {
    const [groups] = await db.query(`
      SELECT g.*, p.name as plan_name, p.max_musicians,
        (SELECT COUNT(*) FROM users WHERE group_id = g.id AND role = 'musician') as current_musicians
      FROM music_groups g
      LEFT JOIN plans p ON g.plan_id = p.id
      WHERE g.is_active = 1
    `);
    res.json(groups);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener mi grupo
router.get('/my-group', verifyToken, async (req, res) => {
  try {
    const [groups] = await db.query(`
      SELECT g.*, p.name as plan_name, p.max_musicians
      FROM music_groups g
      LEFT JOIN plans p ON g.plan_id = p.id
      WHERE g.id = ?
    `, [req.user.group_id]);
    
    if (groups.length === 0) {
      return res.status(404).json({ error: 'Grupo no encontrado' });
    }
    res.json(groups[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Crear grupo (Super Admin)
router.post('/', verifyToken, isSuperAdmin, async (req, res) => {
  try {
    const { name, logo_url, plan_id, plan_start_date, plan_end_date } = req.body;
    const [result] = await db.query(
      `INSERT INTO music_groups (name, logo_url, plan_id, plan_start_date, plan_end_date) 
       VALUES (?, ?, ?, ?, ?)`,
      [name, logo_url, plan_id, plan_start_date, plan_end_date]
    );
    res.status(201).json({ id: result.insertId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Actualizar grupo
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const { name, logo_url, plan_id, plan_start_date, plan_end_date } = req.body;
    await db.query(
      `UPDATE music_groups SET name = ?, logo_url = ?, plan_id = ?, 
       plan_start_date = ?, plan_end_date = ? WHERE id = ?`,
      [name, logo_url, plan_id, plan_start_date, plan_end_date, req.params.id]
    );
    res.json({ message: 'Grupo actualizado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
