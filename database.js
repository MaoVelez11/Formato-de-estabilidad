// Archivo: database.js
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./stability.db', (err) => {
    if (err) {
        console.error("Error abriendo la base de datos: " + err.message);
    } else {
        console.log("Base de datos conectada!");
    }
});

// Creación de las tablas si no existen
db.serialize(() => {
    // Tabla para el módulo de seguimiento
    db.run(`
        CREATE TABLE IF NOT EXISTS estudios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            consecutivo INTEGER UNIQUE,
            referencia TEXT,
            producto TEXT,
            registro_sanitario TEXT,
            lote TEXT UNIQUE,
            descripcion TEXT,
            pruebas TEXT,
            observaciones TEXT,
            unidades INTEGER,
            fecha_liberacion DATE,
            fecha_inicio_camaras DATE
        )
    `);

    // Tabla para los datos del formato completo
    // Relacionada por el número de lote
    db.run(`
        CREATE TABLE IF NOT EXISTS resultados (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            lote_estudio TEXT,
            tipo_estabilidad TEXT, -- 'Acelerada' o 'Natural'
            parametro TEXT,
            tiempo TEXT, -- 'T0', 'T1', 'T3', etc.
            especificacion TEXT,
            resultado TEXT, -- 'Cumple', 'No Cumple', o el valor numérico
            FOREIGN KEY (lote_estudio) REFERENCES estudios(lote)
        )
    `);
});

module.exports = db;