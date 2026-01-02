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

// Rutas

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

// Ruta de prueba

app.get('/', (req, res) => {

  res.json({ message: 'Music System API funcionando' });

});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {

  console.logServidor corriendo en puerto ${PORT});

});
