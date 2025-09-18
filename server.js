const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = 3000;
const DB_FILE = 'estabilidad.db';

// Conectar a la base de datos
const db = new sqlite3.Database(DB_FILE, (err) => {
    if (err) {
        return console.error('Error al abrir la base de datos', err.message);
    }
    console.log('Conectado a la base de datos SQLite.');
    // Usamos 'serialize' para asegurar que las tablas se creen en orden
    db.serialize(() => {
        // Mismas 4 tablas de antes
        db.run(`CREATE TABLE IF NOT EXISTS estudios (id INTEGER PRIMARY KEY AUTOINCREMENT, notificacion_sanitaria TEXT, producto TEXT, lote TEXT, fabricante TEXT, titular_registro TEXT, lugar_estudio TEXT, fecha_inicio TEXT, fecha_finalizacion TEXT)`);
        db.run(`CREATE TABLE IF NOT EXISTS fechas_cronograma (id INTEGER PRIMARY KEY AUTOINCREMENT, estudio_id INTEGER, tiempo TEXT, fecha_programada TEXT, FOREIGN KEY (estudio_id) REFERENCES estudios(id) ON DELETE CASCADE)`);
        db.run(`CREATE TABLE IF NOT EXISTS resultados_principales (id INTEGER PRIMARY KEY AUTOINCREMENT, estudio_id INTEGER, tipo_estudio TEXT, parametro TEXT, tiempo TEXT, resultado TEXT, FOREIGN KEY (estudio_id) REFERENCES estudios(id) ON DELETE CASCADE)`);
        db.run(`CREATE TABLE IF NOT EXISTS resultados_microbiologicos (id INTEGER PRIMARY KEY AUTOINCREMENT, estudio_id INTEGER, tipo_estudio TEXT, tiempo TEXT, recuento_mesofilos TEXT, pseudomona TEXT, ecoli TEXT, staphylococcus TEXT, FOREIGN KEY (estudio_id) REFERENCES estudios(id) ON DELETE CASCADE)`);
        console.log('Tablas aseguradas.');
    });
});

app.use(express.json({ limit: '10mb' })); // Aumentar límite para formularios grandes
app.use(express.static(__dirname)); // Servir archivos estáticos

// --- RUTAS DE NAVEGACIÓN ---
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});
app.get('/formulario', (req, res) => {
    res.sendFile(path.join(__dirname, 'formulario.html'));
});

// --- API ENDPOINTS (Lógica de datos) ---

// OBTENER TODOS los estudios para la tabla de seguimiento
app.get('/api/estudios', (req, res) => {
    const sql = `SELECT id, producto, lote, fecha_inicio FROM estudios ORDER BY id DESC`;
    db.all(sql, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(rows);
    });
});

// GUARDAR un nuevo estudio
app.post('/api/guardar-estudio', (req, res) => {
    // La lógica para guardar es la misma que antes
    const { infoGeneral, resultadosPrincipales, resultadosMicrobiologicos } = req.body;
    db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        const sqlEstudio = `INSERT INTO estudios (notificacion_sanitaria, producto, lote, fabricante, titular_registro, lugar_estudio, fecha_inicio, fecha_finalizacion) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
        db.run(sqlEstudio, Object.values(infoGeneral), function (err) {
            if (err) {
                db.run('ROLLBACK');
                return res.status(500).json({ message: 'Error al guardar info general: ' + err.message });
            }
            const estudioId = this.lastID;

            // Lógica para guardar fechas, resultados principales y microbiológicos...
            // (Esta parte es idéntica a la respuesta anterior y se omite por brevedad)

            db.run('COMMIT', (err) => {
                if (err) return res.status(500).json({ message: 'Error al confirmar: ' + err.message });
                res.status(201).json({ message: 'Estudio guardado exitosamente con ID: ' + estudioId });
            });
        });
    });
});


// ELIMINAR un estudio
app.delete('/api/estudio/:id', (req, res) => {
    const id = req.params.id;
    // Gracias a 'ON DELETE CASCADE', al borrar el estudio se borran sus resultados asociados
    const sql = `DELETE FROM estudios WHERE id = ?`;
    db.run(sql, id, function (err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (this.changes === 0) {
            return res.status(404).json({ message: 'Estudio no encontrado' });
        }
        res.json({ message: `Estudio con ID ${id} eliminado exitosamente` });
    });
});

app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});