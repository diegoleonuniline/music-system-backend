const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// CORS
app.use(cors({
    origin: [
        'https://www.caimanapp.com',
        'https://caimanapp.com',
        'https://diegoleon10.github.io',
        'http://localhost:3000',
        'http://localhost:5500',
        'http://127.0.0.1:5500'
    ],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

app.options('*', cors());
app.use(express.json());

// Rutas (relativas a src/)
// Rutas (relativas a src/)
app.use('/api/auth', require('./routes/auth'));
app.use('/api/plans', require('./routes/plans'));
app.use('/api/groups', require('./routes/groups'));
app.use('/api/users', require('./routes/users'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/genres', require('./routes/genres'));
app.use('/api/songs', require('./routes/songs'));
app.use('/api/setlists', require('./routes/setlists'));
app.use('/api/events', require('./routes/events'));
app.use('/api/rehearsals', require('./routes/rehearsals'));
app.use('/api/song-resources', require('./routes/song-resources'));
app.use('/api/notifications', require('./routes/notifications'));
//app.use('/api/artists', require('./routes/artists'));
//app.use('/api/projects', require('./routes/projects'));
//app.use('/api/song-settings', require('./routes/song-settings'));

// Ruta de prueba
app.get('/', (req, res) => {
    res.json({ message: 'Music System API funcionando', version: '1.0.0' });
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handlers
app.use((err, req, res, next) => {
    console.error('Error:', err.message);
    res.status(500).json({ error: 'Error interno del servidor' });
});

app.use((req, res) => {
    res.status(404).json({ error: 'Ruta no encontrada' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log('Servidor corriendo en puerto ' + PORT);
});
