const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const groupsRoutes = require('./routes/groups');
const songsRoutes = require('./routes/songs');
const setlistsRoutes = require('./routes/setlists');
const eventsRoutes = require('./routes/events');
const rehearsalsRoutes = require('./routes/rehearsals');
const usersRoutes = require('./routes/users');
const plansRoutes = require('./routes/plans');
const categoriesRoutes = require('./routes/categories');
const genresRoutes = require('./routes/genres');

const app = express();

app.use(cors());
app.use(express.json());

// Rutas
app.use('/api/auth', authRoutes);
app.use('/api/groups', groupsRoutes);
app.use('/api/songs', songsRoutes);
app.use('/api/setlists', setlistsRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/rehearsals', rehearsalsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/plans', plansRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/genres', genresRoutes);

// Ruta de prueba
app.get('/', (req, res) => {
  res.json({ message: 'Music System API funcionando' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
