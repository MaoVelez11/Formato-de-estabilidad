// Archivo: server.js
const express = require('express');
const path = require('path');
const db = require('./database.js');

const app = express();
const PORT = 3000;

// Middlewares
app.use(express.static(path.join(__dirname, 'public'))); // Servir archivos estáticos (HTML, CSS, logo)
app.use(express.json()); // Para poder leer JSON del body de las peticiones

// --- API Endpoints ---

// Guardar/Actualizar datos del módulo de seguimiento
app.post('/api/estudio', (req, res) => {
    const data = req.body;
    const sql = `
        INSERT INTO estudios (consecutivo, referencia, producto, registro_sanitario, lote, descripcion, pruebas, observaciones, unidades, fecha_liberacion, fecha_inicio_camaras)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(lote) DO UPDATE SET
            producto=excluded.producto,
            observaciones=excluded.observaciones,
            unidades=excluded.unidades;
    `;
    const params = [data.consecutivo, data.referencia, data.producto, data.registro_sanitario, data.lote, data.descripcion, data.pruebas, data.observaciones, data.unidades, data.fecha_liberacion, data.fecha_inicio_camaras];

    db.run(sql, params, function(err) {
        if (err) {
            res.status(400).json({"error": err.message});
            return;
        }
        res.json({
            "message": "success",
            "data": data,
            "id": this.lastID
        });
    });
});

// Guardar los datos del formato completo
app.post('/api/resultados', (req, res) => {
    const { lote, resultados } = req.body; // Se espera un lote y un array de resultados

    const sql = `INSERT INTO resultados (lote_estudio, tipo_estabilidad, parametro, tiempo, especificacion, resultado) VALUES (?, ?, ?, ?, ?, ?)`;

    db.serialize(() => {
        const stmt = db.prepare(sql);
        for (const r of resultados) {
            stmt.run(lote, r.tipo, r.parametro, r.tiempo, r.especificacion, r.resultado);
        }
        stmt.finalize((err) => {
            if (err) {
                return res.status(400).json({ "error": err.message });
            }
            res.json({ "message": `Resultados para el lote ${lote} guardados.` });
        });
    });
});

// Iniciar el servidor
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}/seguimiento.html`);
});