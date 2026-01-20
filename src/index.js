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

// Endpoint para buscar letras
app.get('/api/lyrics/search', async (req, res) => {
    const { artist, song } = req.query;
    const MUSIXMATCH_KEY = '445d6196c08dc2b7490929f18149d684';
    const GENIUS_TOKEN = 'z0TdnaAK55-EqV5J8XKTVJieM0CcqGRWg_2tepJn_0dV5px2GWYt7LiByTL3rj_w';
    
    console.log('========== LYRICS SEARCH ==========');
    console.log('Artist:', artist, '| Song:', song);
    
    if (!artist || !song) {
        return res.status(400).json({ error: 'Faltan parámetros artist y song' });
    }
    
    const artistNorm = artist.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const songNorm = song.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    console.log('Normalizado - Artist:', artistNorm, '| Song:', songNorm);
    
    try {
        // ========== INTENTO 1: Musixmatch ==========
        console.log('\n--- Intentando Musixmatch ---');
        try {
            const mxUrl = `https://api.musixmatch.com/ws/1.1/matcher.lyrics.get?q_track=${encodeURIComponent(songNorm)}&q_artist=${encodeURIComponent(artistNorm)}&apikey=${MUSIXMATCH_KEY}`;
            console.log('URL:', mxUrl);
            
            const mxRes = await fetch(mxUrl);
            const mxData = await mxRes.json();
            
            const statusCode = mxData.message?.header?.status_code;
            console.log('Musixmatch status:', statusCode);
            
            if (statusCode === 200 && mxData.message?.body?.lyrics?.lyrics_body) {
                let lyrics = mxData.message.body.lyrics.lyrics_body;
                // Quitar mensaje comercial al final
                lyrics = lyrics.replace(/\*{7}[\s\S]*$/, '').trim();
                
                if (lyrics.length > 100) {
                    console.log('SUCCESS: Musixmatch, length:', lyrics.length);
                    return res.json({ found: true, lyrics, source: 'musixmatch' });
                }
                console.log('Musixmatch: letra muy corta o truncada');
            }
        } catch (e) {
            console.log('Musixmatch falló:', e.message);
        }
        
        // ========== INTENTO 2: lyrics.ovh ==========
        console.log('\n--- Intentando lyrics.ovh ---');
        try {
            const ovhUrl = `https://api.lyrics.ovh/v1/${encodeURIComponent(artistNorm)}/${encodeURIComponent(songNorm)}`;
            console.log('URL:', ovhUrl);
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            
            const ovhRes = await fetch(ovhUrl, { signal: controller.signal });
            clearTimeout(timeoutId);
            
            console.log('lyrics.ovh status:', ovhRes.status);
            
            if (ovhRes.ok) {
                const ovhData = await ovhRes.json();
                if (ovhData.lyrics && ovhData.lyrics.length > 50) {
                    console.log('SUCCESS: lyrics.ovh, length:', ovhData.lyrics.length);
                    return res.json({ found: true, lyrics: ovhData.lyrics.trim(), source: 'lyrics.ovh' });
                }
            }
        } catch (e) {
            console.log('lyrics.ovh falló:', e.message);
        }
        
        // ========== INTENTO 3: Musixmatch búsqueda alternativa ==========
        console.log('\n--- Intentando Musixmatch search ---');
        try {
            const searchUrl = `https://api.musixmatch.com/ws/1.1/track.search?q_track=${encodeURIComponent(songNorm)}&q_artist=${encodeURIComponent(artistNorm)}&page_size=1&s_track_rating=desc&apikey=${MUSIXMATCH_KEY}`;
            const searchRes = await fetch(searchUrl);
            const searchData = await searchRes.json();
            
            if (searchData.message?.body?.track_list?.length) {
                const trackId = searchData.message.body.track_list[0].track.track_id;
                console.log('Track ID encontrado:', trackId);
                
                const lyricsUrl = `https://api.musixmatch.com/ws/1.1/track.lyrics.get?track_id=${trackId}&apikey=${MUSIXMATCH_KEY}`;
                const lyricsRes = await fetch(lyricsUrl);
                const lyricsData = await lyricsRes.json();
                
                if (lyricsData.message?.body?.lyrics?.lyrics_body) {
                    let lyrics = lyricsData.message.body.lyrics.lyrics_body;
                    lyrics = lyrics.replace(/\*{7}[\s\S]*$/, '').trim();
                    
                    if (lyrics.length > 100) {
                        console.log('SUCCESS: Musixmatch search, length:', lyrics.length);
                        return res.json({ found: true, lyrics, source: 'musixmatch' });
                    }
                }
            }
        } catch (e) {
            console.log('Musixmatch search falló:', e.message);
        }
        
        // ========== FALLBACK: Genius URL ==========
        console.log('\n--- Buscando URL en Genius ---');
        try {
            const geniusUrl = `https://api.genius.com/search?q=${encodeURIComponent(artistNorm + ' ' + songNorm)}`;
            const geniusRes = await fetch(geniusUrl, {
                headers: { 'Authorization': 'Bearer ' + GENIUS_TOKEN }
            });
            const geniusData = await geniusRes.json();
            
            if (geniusData.response?.hits?.length) {
                const hit = geniusData.response.hits[0].result;
                console.log('Genius URL:', hit.url);
                return res.json({ 
                    found: false, 
                    geniusUrl: hit.url, 
                    title: hit.title, 
                    artist: hit.primary_artist.name,
                    message: 'Letra no extraíble, usa el link'
                });
            }
        } catch (e) {
            console.log('Genius falló:', e.message);
        }
        
        console.log('\n========== RESULTADO ==========');
        console.log('FAIL: No se encontró en ninguna fuente');
        res.json({ found: false, message: 'Letra no encontrada' });
        
    } catch (e) {
        console.error('ERROR GENERAL:', e);
        res.status(500).json({ error: 'Error buscando letra', details: e.message });
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
