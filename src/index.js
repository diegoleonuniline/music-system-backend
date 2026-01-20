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

// Función para normalizar texto (quitar acentos)
function normalizeText(str) {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Función para crear slug
function createSlug(str) {
    return normalizeText(str)
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
}

// Endpoint para buscar letras
app.get('/api/lyrics/search', async (req, res) => {
    const { artist, song } = req.query;
    const GENIUS_TOKEN = 'z0TdnaAK55-EqV5J8XKTVJieM0CcqGRWg_2tepJn_0dV5px2GWYt7LiByTL3rj_w';
    
    console.log('========== LYRICS SEARCH ==========');
    console.log('Artist:', artist, '| Song:', song);
    
    if (!artist || !song) {
        return res.status(400).json({ error: 'Faltan parámetros artist y song' });
    }
    
    const artistNorm = normalizeText(artist);
    const songNorm = normalizeText(song);
    console.log('Normalizado - Artist:', artistNorm, '| Song:', songNorm);
    
    try {
   


// ========== INTENTO 1: Letras.com ==========
console.log('\n--- Intentando Letras.com ---');
try {
    const artistSlug = createSlug(artistNorm);
    const songSlug = createSlug(songNorm);
    let lyrics = null;
    
    // Función para extraer letra
    const extractLyrics = (html, expectedTitle) => {
        // Validar título
        const titleMatch = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
        if (titleMatch && expectedTitle) {
            const pageTitle = normalizeText(titleMatch[1]).toLowerCase();
            const expected = expectedTitle.toLowerCase();
            console.log('Título página:', pageTitle, '| Esperado:', expected);
            if (!pageTitle.includes(expected.substring(0, 8)) && !expected.includes(pageTitle.substring(0, 8))) {
                return null;
            }
        }
        
        const lyricMatch = html.match(/<div class="lyric-original"[^>]*>([\s\S]*?)<\/div>\s*<div/i) ||
                           html.match(/<div class="lyric-original"[^>]*>([\s\S]*?)<\/div>/i);
        if (!lyricMatch) return null;
        
        return lyricMatch[1]
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<p[^>]*>/gi, '\n')
            .replace(/<\/p>/gi, '\n')
            .replace(/<[^>]+>/g, '')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    };
    
    // Intento 1: URL directa
    const directUrl = `https://www.letras.com/${artistSlug}/${songSlug}/`;
    console.log('URL directa:', directUrl);
    
    let res = await fetch(directUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    
    if (res.ok) {
        lyrics = extractLyrics(await res.text(), songNorm);
    }
    
    // Intento 2: Buscar en página del artista
    if (!lyrics || lyrics.length < 100) {
        console.log('Buscando en página del artista...');
        const artistUrl = `https://www.letras.com/${artistSlug}/`;
        res = await fetch(artistUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        
        if (res.ok) {
            const artistHtml = await res.text();
            // Buscar link que contenga palabras de la canción
            const songWords = songSlug.split('-').filter(w => w.length > 2);
            const linkRegex = new RegExp(`href="(/${artistSlug}/[^"]*(?:${songWords.join('|')})[^"]*)"`, 'gi');
            const matches = [...artistHtml.matchAll(linkRegex)];
            
            console.log('Links encontrados:', matches.length);
            
            for (const match of matches.slice(0, 3)) {
                const songUrl = `https://www.letras.com${match[1]}`;
                console.log('Probando:', songUrl);
                res = await fetch(songUrl, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
                });
                if (res.ok) {
                    lyrics = extractLyrics(await res.text(), songNorm);
                    if (lyrics && lyrics.length > 100) break;
                }
            }
        }
    }
    
    if (lyrics && lyrics.length > 100) {
        console.log('SUCCESS: Letras.com, length:', lyrics.length);
        return res.json({ found: true, lyrics, source: 'letras.com' });
    }
    console.log('Letras.com: no encontró');
} catch (e) {
    console.log('Letras.com falló:', e.message);
}
        
        // ========== INTENTO 3: lyrics.ovh ==========
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
