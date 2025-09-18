// Archivo: database.js
const sqlite3 = require('sqlite3').verbose();

// Conectarse al archivo de la base de datos. Se creará si no existe.
const db = new sqlite3.Database('./stability.db', (err) => {
    if (err) {
        console.error("Error abriendo la base de datos: " + err.message);
    } else {
        console.log("Base de datos conectada!");
    }
});

// Usamos db.serialize para asegurar que los comandos se ejecuten en orden
db.serialize(() => {
    console.log("Creando tablas si no existen...");

    // Tabla 1: Clientes (Identificados por el titular)
    db.run(`
        CREATE TABLE IF NOT EXISTS Clientes (
            id_cliente INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre_titular TEXT NOT NULL UNIQUE
        )
    `);

    // Tabla 2: Productos
    db.run(`
        CREATE TABLE IF NOT EXISTS Productos (
            id_producto INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre_producto TEXT NOT NULL,
            referencia TEXT UNIQUE
        )
    `);

    // Tabla 3: Estudios (Conecta Clientes y Productos a través de un Lote)
    db.run(`
        CREATE TABLE IF NOT EXISTS Estudios (
            id_estudio INTEGER PRIMARY KEY AUTOINCREMENT,
            lote TEXT NOT NULL UNIQUE,
            registro_sanitario TEXT,
            descripcion TEXT,
            pruebas TEXT,
            observaciones TEXT,
            unidades INTEGER,
            fecha_liberacion DATE,
            fecha_inicio_camaras DATE,
            id_cliente INTEGER,
            id_producto INTEGER,
            FOREIGN KEY (id_cliente) REFERENCES Clientes(id_cliente),
            FOREIGN KEY (id_producto) REFERENCES Productos(id_producto)
        )
    `);

    // Tabla 4: Resultados (Almacena cada medición de un estudio)
    db.run(`
        CREATE TABLE IF NOT EXISTS Resultados (
            id_resultado INTEGER PRIMARY KEY AUTOINCREMENT,
            id_estudio INTEGER,
            parametro TEXT NOT NULL,
            tiempo TEXT NOT NULL,
            especificacion TEXT,
            resultado TEXT,
            FOREIGN KEY (id_estudio) REFERENCES Estudios(id_estudio)
        )
    `, (err) => {
        if (err) {
            console.error("Error creando tabla Resultados:", err.message);
        } else {
            console.log("Estructura de la base de datos lista.");
        }
    });
});

module.exports = db;