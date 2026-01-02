const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/database');

const router = express.Router();

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const [users] = await db.query(
      'SELECT * FROM users WHERE email = ? AND is_active = 1',
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const user = users[0];
    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    await db.query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, group_id: user.group_id },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
        group_id: user.group_id
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Registro (solo Super Admin puede crear usuarios)
router.post('/register', async (req, res) => {
  try {
    const { email, password, first_name, last_name, phone, role, group_id } = req.body;
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const [result] = await db.query(
      `INSERT INTO users (email, password, first_name, last_name, phone, role, group_id) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [email, hashedPassword, first_name, last_name, phone, role || 'musician', group_id]
    );

    res.status(201).json({ id: result.insertId, message: 'Usuario creado' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'El email ya existe' });
    }
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
// Registro de grupo + admin (público)
router.post('/register-group', async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    
    const { group_name, first_name, last_name, email, phone, password, plan } = req.body;
    
    // Verificar email
    const [existing] = await connection.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      await connection.rollback();
      return res.status(400).json({ error: 'El email ya está registrado' });
    }
    
    // Crear grupo
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 7);
    
    const [groupResult] = await connection.query(
      `INSERT INTO groups (name, plan, trial_ends_at) VALUES (?, ?, ?)`,
      [group_name, plan || 'profesional', trialEnd]
    );
    const groupId = groupResult.insertId;
    
    // Crear admin
    const hashedPassword = await bcrypt.hash(password, 10);
    const [userResult] = await connection.query(
      `INSERT INTO users (email, password, first_name, last_name, phone, role, group_id) 
       VALUES (?, ?, ?, ?, ?, 'admin', ?)`,
      [email, hashedPassword, first_name, last_name, phone, groupId]
    );
    
    await connection.commit();
    
    const token = jwt.sign(
      { id: userResult.insertId, email, role: 'admin', group_id: groupId },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    res.status(201).json({
      token,
      user: {
        id: userResult.insertId,
        email,
        first_name,
        last_name,
        role: 'admin',
        group_id: groupId
      }
    });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ error: error.message });
  } finally {
    connection.release();
  }
});
