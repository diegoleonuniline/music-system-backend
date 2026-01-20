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

// Función para quitar acentos
function normalizeText(str) {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

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
    const GENIUS_TOKEN = 'z0TdnaAK55-EqV5J8XKTVJieM0CcqGRWg_2tepJn_0dV5px2GWYt7LiByTL3rj_w';
    
    console.log('========== LYRICS SEARCH ==========');
    console.log('Artist original:', artist);
    console.log('Song original:', song);
    
    if (!artist || !song) {
        console.log('ERROR: Faltan parámetros');
        return res.status(400).json({ error: 'Faltan parámetros artist y song' });
    }
    
    // Normalizar textos (quitar acentos)
    const artistNorm = normalizeText(artist);
    const songNorm = normalizeText(song);
    console.log('Artist normalizado:', artistNorm);
    console.log('Song normalizado:', songNorm);
    
    try {
        // ========== INTENTO 1: lyrics.ovh ==========
        console.log('\n--- Intentando lyrics.ovh ---');
        try {
            const lyricsOvhUrl = `https://api.lyrics.ovh/v1/${encodeURIComponent(artistNorm)}/${encodeURIComponent(songNorm)}`;
            console.log('URL:', lyricsOvhUrl);
            
            const lyricsRes = await fetch(lyricsOvhUrl, { timeout: 8000 });
            console.log('Status:', lyricsRes.status);
            
            if (lyricsRes.ok) {
                const lyricsData = await lyricsRes.json();
                if (lyricsData.lyrics && lyricsData.lyrics.length > 50) {
                    console.log('SUCCESS: Letra encontrada en lyrics.ovh, length:', lyricsData.lyrics.length);
                    return res.json({ 
                        found: true, 
                        lyrics: lyricsData.lyrics.trim(), 
                        source: 'lyrics.ovh' 
                    });
                }
                console.log('lyrics.ovh respondió pero sin letra válida');
            }
        } catch (e) {
            console.log('lyrics.ovh falló:', e.message);
        }
        
        // ========== INTENTO 2: Genius API ==========
        console.log('\n--- Intentando Genius API ---');
        const searchUrl = `https://api.genius.com/search?q=${encodeURIComponent(artistNorm + ' ' + songNorm)}`;
        console.log('Search URL:', searchUrl);
        
        const searchRes = await fetch(searchUrl, {
            headers: { 'Authorization': 'Bearer ' + GENIUS_TOKEN }
        });
        console.log('Genius Search Status:', searchRes.status);
        
        const searchData = await searchRes.json();
        
        if (!searchData.response?.hits?.length) {
            console.log('ERROR: No se encontraron resultados en Genius');
            return res.json({ found: false, message: 'No encontrado en ninguna fuente' });
        }
        
        const hit = searchData.response.hits[0].result;
        console.log('Hit encontrado:', hit.title, '-', hit.primary_artist.name);
        console.log('Genius URL:', hit.url);
        
        // ========== SCRAPING DE GENIUS ==========
        console.log('\n--- Scraping página de Genius ---');
        const pageRes = await fetch(hit.url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                'Cache-Control': 'max-age=0'
            }
        });
        console.log('Page Status:', pageRes.status);
        
        const html = await pageRes.text();
        console.log('HTML Length:', html.length);
        
        let lyrics = '';
        
        // Método 1: data-lyrics-container
        console.log('\n--- Método 1: data-lyrics-container ---');
        const containerRegex = /<div[^>]*data-lyrics-container="true"[^>]*>([\s\S]*?)<\/div>/gi;
        const containers = [];
        let match;
        while ((match = containerRegex.exec(html)) !== null) {
            containers.push(match[1]);
        }
        console.log('Containers encontrados:', containers.length);
        
        if (containers.length > 0) {
            lyrics = containers.map(c => {
                return c
                    .replace(/<br\s*\/?>/gi, '\n')
                    .replace(/<[^>]+>/g, '')
                    .replace(/&amp;/g, '&')
                    .replace(/&quot;/g, '"')
                    .replace(/&#x27;|&#39;/g, "'")
                    .replace(/&nbsp;/g, ' ')
                    .replace(/&#\d+;/g, '')
                    .trim();
            }).join('\n\n');
            console.log('Lyrics extraídas (método 1), length:', lyrics.length);
        }
        
        // Método 2: Lyrics__Container class
        if (!lyrics || lyrics.length < 100) {
            console.log('\n--- Método 2: Lyrics__Container class ---');
            const classRegex = /<div[^>]*class="[^"]*Lyrics__Container[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
            const classContainers = [];
            while ((match = classRegex.exec(html)) !== null) {
                classContainers.push(match[1]);
            }
            console.log('Class containers encontrados:', classContainers.length);
            
            if (classContainers.length > 0) {
                lyrics = classContainers.map(c => {
                    return c
                        .replace(/<br\s*\/?>/gi, '\n')
                        .replace(/<[^>]+>/g, '')
                        .replace(/&amp;/g, '&')
                        .replace(/&quot;/g, '"')
                        .replace(/&#x27;|&#39;/g, "'")
                        .replace(/&nbsp;/g, ' ')
                        .trim();
                }).join('\n\n');
                console.log('Lyrics extraídas (método 2), length:', lyrics.length);
            }
        }
        
        // Método 3: JSON embebido
        if (!lyrics || lyrics.length < 100) {
            console.log('\n--- Método 3: JSON embebido ---');
            const jsonPatterns = [
                /"lyrics":\s*\{[^}]*"body":\s*\{[^}]*"plain":\s*"([^"]+)"/,
                /"lyrics":\s*\{[^}]*"plain":\s*"([^"]+)"/,
                /"lyricsText":\s*"([^"]+)"/
            ];
            
            for (let i = 0; i < jsonPatterns.length; i++) {
                const jsonMatch = html.match(jsonPatterns[i]);
                if (jsonMatch && jsonMatch[1]) {
                    lyrics = jsonMatch[1]
                        .replace(/\\n/g, '\n')
                        .replace(/\\'/g, "'")
                        .replace(/\\"/g, '"')
                        .replace(/\\u[\dA-Fa-f]{4}/g, m => String.fromCharCode(parseInt(m.slice(2), 16)));
                    console.log('Lyrics extraídas (método 3, pattern', i + 1, '), length:', lyrics.length);
                    break;
                }
            }
        }
        
        // Método 4: Buscar entre tags específicos
        if (!lyrics || lyrics.length < 100) {
            console.log('\n--- Método 4: Tags específicos ---');
            const specificMatch = html.match(/class="Lyrics-sc[^"]*"[^>]*>([\s\S]*?)<div class="LyricsFooter/i);
            if (specificMatch) {
                lyrics = specificMatch[1]
                    .replace(/<br\s*\/?>/gi, '\n')
                    .replace(/<[^>]+>/g, '')
                    .replace(/&[^;]+;/g, ' ')
                    .trim();
                console.log('Lyrics extraídas (método 4), length:', lyrics.length);
            }
        }
        
        // Log de debug si no encontró nada
        if (!lyrics || lyrics.length < 100) {
            console.log('\n--- DEBUG: Buscando patrones en HTML ---');
            console.log('Contiene "data-lyrics-container":', html.includes('data-lyrics-container'));
            console.log('Contiene "Lyrics__Container":', html.includes('Lyrics__Container'));
            console.log('Contiene "Lyrics-sc":', html.includes('Lyrics-sc'));
            console.log('Contiene "lyricsText":', html.includes('lyricsText'));
        }
        
        // ========== RESULTADO FINAL ==========
        console.log('\n========== RESULTADO ==========');
        if (lyrics && lyrics.length > 100) {
            lyrics = lyrics.replace(/\n{3,}/g, '\n\n').trim();
            console.log('SUCCESS: Letra encontrada, length final:', lyrics.length);
            console.log('Preview:', lyrics.substring(0, 200) + '...');
            
            res.json({ 
                found: true, 
                lyrics, 
                title: hit.title, 
                artist: hit.primary_artist.name, 
                source: 'genius' 
            });
        } else {
            console.log('FAIL: No se pudo extraer la letra');
            
            res.json({ 
                found: false, 
                geniusUrl: hit.url, 
                title: hit.title, 
                artist: hit.primary_artist.name,
                message: 'No se pudo extraer la letra automáticamente'
            });
        }
        
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
