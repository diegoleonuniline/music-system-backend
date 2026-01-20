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
    
    // Intento directo primero (más confiable)
    const directUrl = `https://www.letras.com/${artistSlug}/${songSlug}/`;
    console.log('Intentando URL directa:', directUrl);
    
    let songRes = await fetch(directUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
    });
    
    // Si falla, buscar pero validando artista
    if (!songRes.ok || songRes.status === 404) {
        console.log('URL directa falló, buscando...');
        const searchUrl = `https://www.letras.com/${artistSlug}/`;
        const artistPageRes = await fetch(searchUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        if (artistPageRes.ok) {
            const artistHtml = await artistPageRes.text();
            // Buscar la canción en la página del artista
            const songRegex = new RegExp(`href="(/${artistSlug}/[^"]+)"[^>]*>[^<]*${songNorm.split(' ')[0]}`, 'i');
            const match = artistHtml.match(songRegex);
            
            if (match) {
                const songUrl = `https://www.letras.com${match[1]}`;
                console.log('Canción encontrada en página del artista:', songUrl);
                songRes = await fetch(songUrl, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
                });
            }
        }
    }
    
    if (songRes && songRes.ok) {
        const html = await songRes.text();
        
        // Verificar que el artista en la página coincida
        const pageArtistMatch = html.match(/<span class="artist"[^>]*>([^<]+)<\/span>/i) ||
                                html.match(/<h2[^>]*class="[^"]*head-title[^"]*"[^>]*>([^<]+)<\/h2>/i);
        
        if (pageArtistMatch) {
            const pageArtist = normalizeText(pageArtistMatch[1]).toLowerCase();
            if (!pageArtist.includes(artistSlug.replace(/-/g, ' ').substring(0, 5))) {
                console.log('Artista no coincide:', pageArtist, 'vs', artistSlug);
                throw new Error('Artista no coincide');
            }
        }
        
        const lyricMatch = html.match(/<div class="lyric-original"[^>]*>([\s\S]*?)<\/div>\s*<div/i) ||
                           html.match(/<div class="lyric-original"[^>]*>([\s\S]*?)<\/div>/i) ||
                           html.match(/<div[^>]*class="[^"]*lyric[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
        
        if (lyricMatch) {
            let lyrics = lyricMatch[1]
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
            
            if (lyrics.length > 100) {
                console.log('SUCCESS: Letras.com, length:', lyrics.length);
                return res.json({ found: true, lyrics, source: 'letras.com' });
            }
        }
    }
    console.log('Letras.com: no se encontró resultado válido');
} catch (e) {
    console.log('Letras.com falló:', e.message);
}

        
        // ========== INTENTO 2: Vagalume (buena para latino) ==========
        console.log('\n--- Intentando Vagalume ---');
        try {
            const vagaUrl = `https://api.vagalume.com.br/search.php?art=${encodeURIComponent(artistNorm)}&mus=${encodeURIComponent(songNorm)}`;
            console.log('URL:', vagaUrl);
            
            const vagaRes = await fetch(vagaUrl);
            console.log('Vagalume status:', vagaRes.status);
            
            if (vagaRes.ok) {
                const vagaData = await vagaRes.json();
                
                if ((vagaData.type === 'exact' || vagaData.type === 'aprox') && vagaData.mus?.[0]?.text) {
                    const lyrics = vagaData.mus[0].text.trim();
                    if (lyrics.length > 100) {
                        console.log('SUCCESS: Vagalume, length:', lyrics.length);
                        return res.json({ found: true, lyrics, source: 'vagalume' });
                    }
                }
                console.log('Vagalume: no encontró letra');
            }
        } catch (e) {
            console.log('Vagalume falló:', e.message);
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
