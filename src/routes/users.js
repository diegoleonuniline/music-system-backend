const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { verifyToken, isSuperAdmin, isGroupAdmin } = require('../middleware/auth');

const router = express.Router();

// Obtener usuarios de mi grupo
router.get('/', verifyToken, async (req, res) => {
  try {
    let query, params;
    
    if (req.user.role === 'super_admin') {
      query = 'SELECT id, email, first_name, last_name, phone, role, group_id, is_active, created_at FROM users';
      params = [];
    } else {
      query = 'SELECT id, email, first_name, last_name, phone, role, group_id, is_active, created_at FROM users WHERE group_id = ?';
      params = [req.user.group_id];
    }
    
    const [users] = await db.query(query, params);
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Crear usuario (Admin de grupo)
router.post('/', verifyToken, isGroupAdmin, async (req, res) => {
  try {
    const { email, password, first_name, last_name, phone, role } = req.body;
    const group_id = req.user.role === 'super_admin' ? req.body.group_id : req.user.group_id;
    
    // Verificar límite del plan
    if (role === 'musician') {
      const [planCheck] = await db.query(`
        SELECT p.max_musicians, 
          (SELECT COUNT(*) FROM users WHERE group_id = ? AND role = 'musician' AND is_active = 1) as current
        FROM music_groups g
        JOIN plans p ON g.plan_id = p.id
        WHERE g.id = ?
      `, [group_id, group_id]);
      
      if (planCheck.length > 0 && planCheck[0].current >= planCheck[0].max_musicians) {
        return res.status(400).json({ error: 'Límite de músicos alcanzado según tu plan' });
      }
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const [result] = await db.query(
      `INSERT INTO users (email, password, first_name, last_name, phone, role, group_id) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [email, hashedPassword, first_name, last_name, phone, role || 'musician', group_id]
    );

    res.status(201).json({ id: result.insertId });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'El email ya existe' });
    }
    res.status(500).json({ error: error.message });
  }
});

// Actualizar usuario
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const { first_name, last_name, phone, is_active } = req.body;
    await db.query(
      'UPDATE users SET first_name = ?, last_name = ?, phone = ?, is_active = ? WHERE id = ?',
      [first_name, last_name, phone, is_active, req.params.id]
    );
    res.json({ message: 'Usuario actualizado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Cambiar contraseña
router.put('/:id/password', verifyToken, async (req, res) => {
  try {
    const { password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    await db.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, req.params.id]);
    res.json({ message: 'Contraseña actualizada' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Eliminar usuario (soft delete)
router.delete('/:id', verifyToken, isGroupAdmin, async (req, res) => {
  try {
    await db.query('UPDATE users SET is_active = 0 WHERE id = ?', [req.params.id]);
    res.json({ message: 'Usuario eliminado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
