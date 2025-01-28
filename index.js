const express = require('express');
const mysql = require('mysql2');
const fs = require('fs');
const app = express();
const port = 3000;

// Funzione per leggere e caricare le variabili d'ambiente dal file .env
function loadEnvVariables() {
    try {
        const envFile = fs.readFileSync('.env', 'utf8');
        const envLines = envFile.split('\n');

        envLines.forEach(line => {
            const trimmedLine = line.trim();
            if (trimmedLine && !trimmedLine.startsWith('#')) {
                const [key, value] = trimmedLine.split('=').map(s => s.trim());
                if (key && value) {
                    process.env[key] = value;
                }
            }
        });
    } catch (err) {
        console.error('Errore durante la lettura del file .env:', err);
    }
}

// Carica le variabili d'ambiente
loadEnvVariables();

// Configurazione della connessione al database
const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    connectionLimit: 10
});

// Middleware per abilitare CORS (per richieste da frontend)
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

// Middleware per parsare il JSON
app.use(express.json());

// Rotta di test
app.get('/', (req, res) => {
    res.send('Applicazione Express connessa al database!');
});

// Rotta per ottenere la lista dei film con le loro recensioni
app.get('/posts', (req, res) => {
    const query = `
        SELECT 
            m.id,
            m.title,
            m.abstract AS content,
            m.image,
            JSON_ARRAYAGG(
                JSON_OBJECT(
                    'id', r.id,
                    'name', r.name,
                    'vote', r.vote,
                    'text', r.text
                )
            ) AS reviews
        FROM movies m
        LEFT JOIN reviews r ON m.id = r.movie_id
        GROUP BY m.id
    `;

    db.query(query, (err, results) => {
        if (err) {
            console.error('Errore durante la query:', err);
            res.status(500).send('Errore del server');
            return;
        }
        const movies = results.map(movie => {
            return {
                ...movie,
                reviews: typeof movie.reviews === 'string' && movie.reviews !== 'null' && movie.reviews !== '[object Object]' ? JSON.parse(movie.reviews) : [],
            };
        });
        res.json(movies);
    });
});

// Rotta per ottenere i dettagli di un singolo film con le sue recensioni
app.get('/posts/:id', (req, res) => {
    const movieId = req.params.id;
    const query = `
        SELECT 
            m.id,
            m.title,
            m.abstract AS content,
            m.image,
            JSON_ARRAYAGG(
                JSON_OBJECT(
                    'id', r.id,
                    'name', r.name,
                    'vote', r.vote,
                    'text', r.text
                )
            ) AS reviews
        FROM movies m
        LEFT JOIN reviews r ON m.id = r.movie_id
        WHERE m.id = ?
        GROUP BY m.id
    `;

    db.query(query, [movieId], (err, results) => {
        if (err) {
            console.error('Errore durante la query:', err);
            res.status(500).send('Errore del server');
            return;
        }

        if (results.length === 0) {
            res.status(404).send('Movie not found');
            return;
        }
        const movie = results[0];
        movie.reviews = typeof movie.reviews === 'string' && movie.reviews !== 'null' && movie.reviews !== '[object Object]' ? JSON.parse(movie.reviews) : [];
        res.json(movie);
    });
});

// Rotta per salvare una nuova recensione
app.post('/reviews', (req, res) => {
    const { movieId, name, vote, text } = req.body;

    if (!movieId || !name || !vote || !text) {
        res.status(400).send('Tutti i campi sono obbligatori: movieId, name, vote, text');
        return;
    }

    const query = `
        INSERT INTO reviews (movie_id, name, vote, text)
        VALUES (?, ?, ?, ?)
    `;

    db.query(query, [movieId, name, vote, text], (err, results) => {
        if (err) {
            console.error('Errore durante l\'inserimento della recensione:', err);
            res.status(500).send('Errore del server');
            return;
        }
        res.status(201).send('Recensione aggiunta con successo');
    });
});

app.listen(port, () => {
    console.log(`Server in ascolto sulla porta ${port}`);
});
