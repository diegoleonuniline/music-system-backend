const express = require('express');
const router = express.Router();
const { verifyToken, isGroupAdmin } = require('../middleware/auth');

const ONESIGNAL_APP_ID = '9c406d11-293e-4344-bbbc-5f7ae8c997be';
const ONESIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY || 'TU_REST_API_KEY';

// Función helper para enviar notificación
async function sendPushNotification({ title, message, userIds, segments, data }) {
    const payload = {
        app_id: ONESIGNAL_APP_ID,
        headings: { en: title, es: title },
        contents: { en: message, es: message },
        data: data || {}
    };

    if (userIds && userIds.length > 0) {
        payload.include_external_user_ids = userIds.map(id => id.toString());
    } else if (segments) {
        payload.included_segments = segments;
    } else {
        payload.included_segments = ['All'];
    }

    const response = await fetch('https://onesignal.com/api/v1/notifications', {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${ONESIGNAL_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    return await response.json();
}

// POST /api/notifications/test - Enviar prueba a mí mismo
router.post('/test', verifyToken, async (req, res) => {
    try {
        const result = await sendPushNotification({
            title: '🐊 Prueba Caimán',
            message: 'Las notificaciones funcionan correctamente!',
            userIds: [req.user.id]
        });
        res.json({ success: true, result });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/notifications/send - Enviar notificación personalizada (Admin)
router.post('/send', verifyToken, isGroupAdmin, async (req, res) => {
    try {
        const { title, message, user_ids } = req.body;

        if (!title || !message) {
            return res.status(400).json({ error: 'title y message son requeridos' });
        }

        const result = await sendPushNotification({
            title,
            message,
            userIds: user_ids || null
        });

        res.json({ success: true, result });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/notifications/event - Notificar nuevo evento
router.post('/event', verifyToken, isGroupAdmin, async (req, res) => {
    try {
        const { event_name, event_date, group_id } = req.body;

        const result = await sendPushNotification({
            title: '📅 Nuevo Evento',
            message: `${event_name} - ${event_date}`,
            data: { type: 'event', group_id }
        });

        res.json({ success: true, result });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/notifications/rehearsal - Notificar canción en ensayo
router.post('/rehearsal', verifyToken, isGroupAdmin, async (req, res) => {
    try {
        const { song_name, target_date } = req.body;

        const result = await sendPushNotification({
            title: '🎸 Nueva canción para ensayar',
            message: `${song_name}${target_date ? ' - Meta: ' + target_date : ''}`,
            data: { type: 'rehearsal' }
        });

        res.json({ success: true, result });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/notifications/resource - Notificar nuevo recurso compartido
router.post('/resource', verifyToken, async (req, res) => {
    try {
        const { song_name, resource_type, user_name } = req.body;

        const typeNames = {
            lyrics: 'letra', chords: 'acordes', tabs: 'tablatura',
            sheet: 'partitura', notes: 'notas', pdf: 'PDF', image: 'imagen'
        };

        const result = await sendPushNotification({
            title: '📎 Nuevo recurso compartido',
            message: `${user_name} agregó ${typeNames[resource_type] || 'recurso'} a "${song_name}"`,
            data: { type: 'resource' }
        });

        res.json({ success: true, result });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /api/notifications/reminder - Recordatorio de evento (para cron job)
router.post('/reminder', async (req, res) => {
    const { api_key } = req.body;
    if (api_key !== process.env.CRON_API_KEY) {
        return res.status(401).json({ error: 'No autorizado' });
    }

    try {
        const { event_name, event_date, hours_before } = req.body;

        const result = await sendPushNotification({
            title: '⏰ Recordatorio de Evento',
            message: `${event_name} es ${hours_before === 24 ? 'mañana' : 'en ' + hours_before + ' horas'}`,
            data: { type: 'reminder' }
        });

        res.json({ success: true, result });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
