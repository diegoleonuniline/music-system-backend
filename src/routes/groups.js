const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { verifyToken, isSuperAdmin } = require('../middleware/auth');

// GET - Obtener mi grupo
router.get('/my-group', verifyToken, async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT g.*, p.name as plan_name, p.max_musicians, p.price,
                admin.first_name as admin_first_name, admin.last_name as admin_last_name, admin.email as admin_email,
                (SELECT COUNT(*) FROM users WHERE group_id = g.id AND role = 'musician' AND is_active = 1) as current_musicians
            FROM music_groups g
            LEFT JOIN plans p ON g.plan_id = p.id
            LEFT JOIN users admin ON g.admin_user_id = admin.id
            WHERE g.id = ?
        `, [req.user.group_id]);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Grupo no encontrado' });
        }
        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET - Obtener todos los grupos (Solo Super Admin)
router.get('/', verifyToken, isSuperAdmin, async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT g.*, p.name as plan_name, p.max_musicians,
                admin.first_name as admin_first_name, admin.last_name as admin_last_name, admin.email as admin_email,
                (SELECT COUNT(*) FROM users WHERE group_id = g.id AND is_active = 1) as current_musicians
            FROM music_groups g
            LEFT JOIN plans p ON g.plan_id = p.id
            LEFT JOIN users admin ON g.admin_user_id = admin.id
            ORDER BY g.name
        `);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET - Obtener un grupo
router.get('/:id', verifyToken, isSuperAdmin, async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT g.*, p.name as plan_name, p.max_musicians,
                admin.first_name as admin_first_name, admin.last_name as admin_last_name, admin.email as admin_email,
                (SELECT COUNT(*) FROM users WHERE group_id = g.id AND is_active = 1) as current_musicians
            FROM music_groups g
            LEFT JOIN plans p ON g.plan_id = p.id
            LEFT JOIN users admin ON g.admin_user_id = admin.id
            WHERE g.id = ?
        `, [req.params.id]);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Grupo no encontrado' });
        }
        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST - Crear grupo
router.post('/', verifyToken, isSuperAdmin, async (req, res) => {
    try {
        const { name, plan_id, plan_start_date, plan_end_date, logo_url, admin_user_id } = req.body;
        
        if (!name) {
            return res.status(400).json({ error: 'El nombre es requerido' });
        }

        const [result] = await pool.query(
            'INSERT INTO music_groups (name, plan_id, plan_start_date, plan_end_date, logo_url, admin_user_id, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)',
            [name, plan_id || null, plan_start_date || null, plan_end_date || null, logo_url || null, admin_user_id || null]
        );

        if (admin_user_id) {
            await pool.query('UPDATE users SET role = ?, group_id = ? WHERE id = ?', ['group_admin', result.insertId, admin_user_id]);
        }

        res.status(201).json({ id: result.insertId, name, plan_id, plan_start_date, plan_end_date, logo_url, admin_user_id, is_active: 1 });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT - Actualizar grupo
router.put('/:id', verifyToken, isSuperAdmin, async (req, res) => {
    try {
        const { name, plan_id, plan_start_date, plan_end_date, logo_url, admin_user_id, is_active } = req.body;
        
        const [existing] = await pool.query('SELECT * FROM music_groups WHERE id = ?', [req.params.id]);
        if (existing.length === 0) {
            return res.status(404).json({ error: 'Grupo no encontrado' });
        }

        const oldAdminId = existing[0].admin_user_id;
        const updates = [];
        const values = [];

        if (name !== undefined) { updates.push('name = ?'); values.push(name); }
        if (plan_id !== undefined) { updates.push('plan_id = ?'); values.push(plan_id || null); }
        if (plan_start_date !== undefined) { updates.push('plan_start_date = ?'); values.push(plan_start_date || null); }
        if (plan_end_date !== undefined) { updates.push('plan_end_date = ?'); values.push(plan_end_date || null); }
        if (logo_url !== undefined) { updates.push('logo_url = ?'); values.push(logo_url || null); }
        if (admin_user_id !== undefined) { updates.push('admin_user_id = ?'); values.push(admin_user_id || null); }
        if (is_active !== undefined) { updates.push('is_active = ?'); values.push(is_active); }

        if (updates.length > 0) {
            values.push(req.params.id);
            await pool.query('UPDATE music_groups SET ' + updates.join(', ') + ' WHERE id = ?', values);
        }

        if (admin_user_id !== undefined && admin_user_id !== oldAdminId) {
            if (oldAdminId) {
                await pool.query('UPDATE users SET role = ? WHERE id = ?', ['musician', oldAdminId]);
            }
            if (admin_user_id) {
                await pool.query('UPDATE users SET role = ?, group_id = ? WHERE id = ?', ['group_admin', req.params.id, admin_user_id]);
            }
        }

        res.json({ id: parseInt(req.params.id), ...req.body });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE - Eliminar grupo
router.delete('/:id', verifyToken, isSuperAdmin, async (req, res) => {
    try {
        const [existing] = await pool.query('SELECT * FROM music_groups WHERE id = ?', [req.params.id]);
        if (existing.length === 0) {
            return res.status(404).json({ error: 'Grupo no encontrado' });
        }

        const [users] = await pool.query('SELECT COUNT(*) as count FROM users WHERE group_id = ?', [req.params.id]);
        if (users[0].count > 0) {
            return res.status(400).json({ error: 'No se puede eliminar el grupo porque tiene usuarios asignados' });
        }

        await pool.query('DELETE FROM music_groups WHERE id = ?', [req.params.id]);
        res.json({ message: 'Grupo eliminado' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
