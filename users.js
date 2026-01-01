const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const bcrypt = require('bcryptjs');
const { verifyToken, isGroupAdmin, isSuperAdmin } = require('../middleware/auth');

// GET - Obtener usuarios del grupo
router.get('/', verifyToken, async (req, res) => {
    try {
        let query = `
            SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.role, u.is_active, u.group_id,
                   g.name as group_name
            FROM users u
            LEFT JOIN music_groups g ON u.group_id = g.id
        `;
        let params = [];

        // Super Admin ve todos, otros solo su grupo
        if (req.user.role !== 'super_admin') {
            query += ' WHERE u.group_id = ?';
            params.push(req.user.group_id);
        }

        query += ' ORDER BY u.first_name';

        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST - Crear usuario
router.post('/', verifyToken, isGroupAdmin, async (req, res) => {
    try {
        const { email, password, first_name, last_name, phone, role, group_id } = req.body;
        
        if (!email || !password || !first_name) {
            return res.status(400).json({ error: 'Email, contraseña y nombre son requeridos' });
        }

        // Determinar el group_id
        // Si es Super Admin y envía group_id, usar ese. Si no, usar el del usuario actual
        const targetGroupId = (req.user.role === 'super_admin' && group_id) 
            ? group_id 
            : req.user.group_id;

        if (!targetGroupId) {
            return res.status(400).json({ error: 'No se pudo determinar el grupo' });
        }

        // Verificar si el email ya existe
        const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
            return res.status(400).json({ error: 'El email ya está registrado' });
        }

        // Verificar límite del plan (solo para músicos)
        const userRole = role || 'musician';
        if (userRole === 'musician') {
            const [groupInfo] = await pool.query(`
                SELECT p.max_musicians,
                       (SELECT COUNT(*) FROM users WHERE group_id = ? AND role = 'musician' AND is_active = 1) as current_count
                FROM music_groups g
                LEFT JOIN plans p ON g.plan_id = p.id
                WHERE g.id = ?
            `, [targetGroupId, targetGroupId]);

            if (groupInfo.length > 0 && groupInfo[0].max_musicians) {
                if (groupInfo[0].current_count >= groupInfo[0].max_musicians) {
                    return res.status(400).json({ error: 'Se alcanzó el límite de músicos del plan' });
                }
            }
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const [result] = await pool.query(
            `INSERT INTO users (email, password, first_name, last_name, phone, role, group_id, is_active) 
             VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
            [email, hashedPassword, first_name, last_name || null, phone || null, userRole, targetGroupId]
        );

        res.status(201).json({ 
            id: result.insertId, 
            email, 
            first_name, 
            last_name,
            phone,
            role: userRole,
            group_id: targetGroupId,
            is_active: 1
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT - Actualizar usuario
router.put('/:id', verifyToken, async (req, res) => {
    try {
        const { first_name, last_name, phone, email, role, is_active } = req.body;
        const userId = req.params.id;

        // Verificar permisos
        const isAdmin = req.user.role === 'super_admin' || req.user.role === 'group_admin';
        const isOwnProfile = req.user.id === parseInt(userId);

        if (!isAdmin && !isOwnProfile) {
            return res.status(403).json({ error: 'No tienes permisos' });
        }

        // Si no es admin, solo puede editar su propio perfil (nombre, teléfono)
        if (!isAdmin && !isOwnProfile) {
            return res.status(403).json({ error: 'No tienes permisos' });
        }

        const [existing] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
        if (existing.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        // Si no es super_admin, verificar que el usuario pertenece a su grupo
        if (req.user.role !== 'super_admin' && existing[0].group_id !== req.user.group_id) {
            return res.status(403).json({ error: 'No tienes permisos' });
        }

        const updates = [];
        const values = [];

        if (first_name !== undefined) { updates.push('first_name = ?'); values.push(first_name); }
        if (last_name !== undefined) { updates.push('last_name = ?'); values.push(last_name); }
        if (phone !== undefined) { updates.push('phone = ?'); values.push(phone); }
        
        // Solo admin puede cambiar estos campos
        if (isAdmin) {
            if (email !== undefined) { updates.push('email = ?'); values.push(email); }
            if (role !== undefined) { updates.push('role = ?'); values.push(role); }
            if (is_active !== undefined) { updates.push('is_active = ?'); values.push(is_active); }
        }

        if (updates.length > 0) {
            values.push(userId);
            await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);
        }

        res.json({ id: parseInt(userId), ...req.body });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT - Cambiar contraseña
router.put('/:id/password', verifyToken, async (req, res) => {
    try {
        const { password } = req.body;
        const userId = req.params.id;

        if (!password || password.length < 6) {
            return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
        }

        // Verificar permisos
        const isAdmin = req.user.role === 'super_admin' || req.user.role === 'group_admin';
        const isOwnProfile = req.user.id === parseInt(userId);

        if (!isAdmin && !isOwnProfile) {
            return res.status(403).json({ error: 'No tienes permisos' });
        }

        const [existing] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
        if (existing.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        // Si no es super_admin, verificar que el usuario pertenece a su grupo
        if (req.user.role !== 'super_admin' && existing[0].group_id !== req.user.group_id) {
            return res.status(403).json({ error: 'No tienes permisos' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        await pool.query('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, userId]);

        res.json({ message: 'Contraseña actualizada' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE - Eliminar usuario
router.delete('/:id', verifyToken, isGroupAdmin, async (req, res) => {
    try {
        const userId = req.params.id;

        // No puede eliminarse a sí mismo
        if (req.user.id === parseInt(userId)) {
            return res.status(400).json({ error: 'No puedes eliminarte a ti mismo' });
        }

        const [existing] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
        if (existing.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        // Si no es super_admin, verificar que el usuario pertenece a su grupo
        if (req.user.role !== 'super_admin' && existing[0].group_id !== req.user.group_id) {
            return res.status(403).json({ error: 'No tienes permisos' });
        }

        await pool.query('DELETE FROM users WHERE id = ?', [userId]);

        res.json({ message: 'Usuario eliminado' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
