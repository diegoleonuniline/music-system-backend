const express = require('express');
const db = require('../config/database');
const { verifyToken, isSuperAdmin } = require('../middleware/auth');

const router = express.Router();

// Obtener todos los planes
router.get('/', async (req, res) => {
  try {
    const [plans] = await db.query('SELECT * FROM plans WHERE is_active = 1');
    res.json(plans);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Crear plan (Super Admin)
router.post('/', verifyToken, isSuperAdmin, async (req, res) => {
  try {
    const { name, max_musicians, price, description } = req.body;
    const [result] = await db.query(
      'INSERT INTO plans (name, max_musicians, price, description) VALUES (?, ?, ?, ?)',
      [name, max_musicians, price, description]
    );
    res.status(201).json({ id: result.insertId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
