// 1. IMPORTAR LIBRERÍAS
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const path = require('path');

// 2. CONFIGURACIÓN INICIAL
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// 3. CONEXIÓN A LA BASE DE DATOS
const pool = mysql.createPool({
    host: 'localhost',
    user: 'samara_user',
    password: 'Samara.2025',
    database: 'samara_cosmetics'
});

// ------------------- RUTAS DE LA API (ENDPOINTS) -------------------

// CREATE: Insertar un nuevo producto y todos sus resultados
app.post('/api/productos', async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const { resultados, ...producto } = req.body;
        await connection.query("INSERT INTO productos_estabilidad SET ?", producto);
        if (resultados && resultados.length > 0) {
            const sqlResultados = "INSERT INTO resultados_analisis (producto_lote, tipo_estabilidad, analisis, parametro_evaluado, tiempo, especificacion, resultado) VALUES ?";
            const valuesResultados = resultados.map(r => [ producto.lote, r.tipo_estabilidad, r.analisis, r.parametro_evaluado, r.tiempo, r.especificacion, r.resultado ]);
            await connection.query(sqlResultados, [valuesResultados]);
        }
        await connection.commit();
        res.status(201).json({ message: "Producto agregado con éxito" });
    } catch (error) {
        await connection.rollback();
        console.error("Error al crear producto:", error);
        res.status(500).json({ message: "Error al crear el producto", error: error.message });
    } finally {
        connection.release();
    }
});

// READ (Todos): Obtener todos los productos
app.get('/api/productos', async (req, res) => {
    try {
        const sql = "SELECT * FROM productos_estabilidad ORDER BY creado_en DESC";
        const [rows] = await pool.query(sql);
        res.json(rows);
    } catch (error) {
        console.error("Error al obtener productos:", error);
        res.status(500).json({ message: "Error al obtener los productos", error: error.message });
    }
});

// READ (Búsqueda): Obtener productos filtrados
app.get('/api/productos/buscar', async (req, res) => {
    try {
        const { termino } = req.query;
        if (!termino || termino.trim() === '') {
            const [allRows] = await pool.query("SELECT * FROM productos_estabilidad ORDER BY creado_en DESC");
            return res.json(allRows);
        }
        const searchTerm = `%${termino}%`;
        const sql = `
            SELECT * FROM productos_estabilidad 
            WHERE producto LIKE ? OR lote LIKE ? OR referencia LIKE ?
            ORDER BY creado_en DESC
        `;
        const [rows] = await pool.query(sql, [searchTerm, searchTerm, searchTerm]);
        res.json(rows);
    } catch (error) {
        console.error("Error al buscar productos:", error);
        res.status(500).json({ message: "Error al buscar productos", error: error.message });
    }
});

// READ (Uno solo con sus resultados): Obtener un producto por su lote
app.get('/api/productos/:lote', async (req, res) => {
    try {
        const { lote } = req.params;
        const [productoRows] = await pool.query("SELECT * FROM productos_estabilidad WHERE lote = ?", [lote]);
        if (productoRows.length === 0) {
            return res.status(404).json({ message: "Producto no encontrado" });
        }
        const [resultadosRows] = await pool.query("SELECT * FROM resultados_analisis WHERE producto_lote = ?", [lote]);
        const productoCompleto = { ...productoRows[0], resultados: resultadosRows };
        res.json(productoCompleto);
    } catch (error) {
        console.error("Error al obtener un producto:", error);
        res.status(500).json({ message: "Error al obtener el producto", error: error.message });
    }
});

// UPDATE: Actualizar un producto existente (versión mejorada que no borra datos)
app.put('/api/productos/:lote', async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const { lote } = req.params;
        const { resultados, ...producto } = req.body;

        // Filtra los campos para no actualizar con valores vacíos o nulos
        const camposParaActualizar = {};
        for (const key in producto) {
            // ¡ESTA ES LA LÍNEA CLAVE! Solo incluye campos que no sean nulos, indefinidos O vacíos.
            if (producto[key] !== null && producto[key] !== undefined && producto[key] !== '') {
                camposParaActualizar[key] = producto[key];
            }
        }

        // Solo ejecuta el UPDATE si hay al menos un campo con datos para actualizar
        if (Object.keys(camposParaActualizar).length > 0) {
            await connection.query("UPDATE productos_estabilidad SET ? WHERE lote = ?", [camposParaActualizar, lote]);
        }
        
        // La lógica para actualizar los 'resultados' (si vienen del otro formulario) se mantiene
        if (resultados) {
            await connection.query("DELETE FROM resultados_analisis WHERE producto_lote = ?", [lote]);
            if (resultados.length > 0) {
                const sqlResultados = "INSERT INTO resultados_analisis (producto_lote, tipo_estabilidad, analisis, parametro_evaluado, tiempo, especificacion, resultado) VALUES ?";
                const valuesResultados = resultados.map(r => [ lote, r.tipo_estabilidad, r.analisis, r.parametro_evaluado, r.tiempo, r.especificacion, r.resultado ]);
                await connection.query(sqlResultados, [valuesResultados]);
            }
        }

        await connection.commit();
        res.json({ message: "Producto actualizado con éxito" });
    } catch (error) {
        await connection.rollback();
        console.error("Error al actualizar producto:", error);
        res.status(500).json({ message: "Error al actualizar el producto", error: error.message });
    } finally {
        connection.release();
    }
});

// DELETE: Eliminar un producto (los resultados se borran en cascada)
app.delete('/api/productos/:lote', async (req, res) => {
    try {
        const { lote } = req.params;
        await pool.query("DELETE FROM productos_estabilidad WHERE lote = ?", [lote]);
        res.json({ message: "Producto eliminado con éxito" });
    } catch (error) {
        console.error("Error al eliminar producto:", error);
        res.status(500).json({ message: "Error al eliminar el producto", error: error.message });
    }
});

// 4. INICIAR EL SERVIDOR
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`✅ Servidor escuchando en http://localhost:${PORT}`);
    console.log("   Ahora puedes abrir tu aplicación en http://localhost:3000/seguimiento.html");
});