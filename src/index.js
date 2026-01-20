const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
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
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/artists', require('./routes/artists'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/song-settings', require('./routes/song-settings'));

// Endpoint para buscar letras con Genius
app.get('/api/lyrics/search', async (req, res) => {
    const { artist, song } = req.query;
    const GENIUS_TOKEN = 'z0TdnaAK55-EqV5J8XKTVJieM0CcqGRWg_2tepJn_0dV5px2GWYt7LiByTL3rj_w';
    
    if (!artist || !song) {
        return res.status(400).json({ error: 'Faltan parámetros artist y song' });
    }
    
    try {
        // Primero intentar con lyrics.ovh (más confiable para letras)
        try {
            const lyricsOvhUrl = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(song)}`;
            const lyricsRes = await fetch(lyricsOvhUrl);
            if (lyricsRes.ok) {
                const lyricsData = await lyricsRes.json();
                if (lyricsData.lyrics) {
                    return res.json({ found: true, lyrics: lyricsData.lyrics.trim(), source: 'lyrics.ovh' });
                }
            }
        } catch (e) {
            console.log('lyrics.ovh falló, intentando Genius...');
        }
        
        // Fallback a Genius
        const searchUrl = `https://api.genius.com/search?q=${encodeURIComponent(artist + ' ' + song)}`;
        const searchRes = await fetch(searchUrl, {
            headers: { 'Authorization': 'Bearer ' + GENIUS_TOKEN }
        });
        const searchData = await searchRes.json();
        
        if (!searchData.response || !searchData.response.hits || !searchData.response.hits.length) {
            return res.json({ found: false });
        }
        
        const hit = searchData.response.hits[0].result;
        
        // Obtener página de Genius
        const pageRes = await fetch(hit.url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml'
            }
        });
        const html = await pageRes.text();
        
        let lyrics = '';
        
        // Buscar JSON con la letra en el HTML
        const jsonMatch = html.match(/"lyrics":\s*\{[^}]*"plain":\s*"([^"]+)"/);
        if (jsonMatch) {
            lyrics = jsonMatch[1]
                .replace(/\\n/g, '\n')
                .replace(/\\'/g, "'")
                .replace(/\\"/g, '"');
        }
        
        // Si no, intentar scraping tradicional
        if (!lyrics) {
            const matches = html.match(/data-lyrics-container="true"[^>]*>([\s\S]*?)<\/div>/gi) ||
                           html.match(/class="Lyrics__Container[^"]*"[^>]*>([\s\S]*?)<\/div>/gi);
            
            if (matches && matches.length) {
                lyrics = matches.join('\n')
                    .replace(/<br\s*\/?>/gi, '\n')
                    .replace(/<[^>]+>/g, '')
                    .replace(/&amp;/g, '&')
                    .replace(/&quot;/g, '"')
                    .replace(/&#x27;/g, "'")
                    .replace(/&#39;/g, "'")
                    .replace(/&nbsp;/g, ' ')
                    .trim();
            }
        }
        
        if (lyrics && lyrics.length > 50) {
            res.json({ found: true, lyrics, title: hit.title, artist: hit.primary_artist.name, source: 'genius' });
        } else {
            res.json({ found: false, geniusUrl: hit.url });
        }
    } catch (e) {
        console.error('Error:', e);
        res.status(500).json({ error: 'Error buscando letra' });
    }
});





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
