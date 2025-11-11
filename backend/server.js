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

// Mensaje espía para ver todas las solicitudes (útil para depurar)
app.use((req, res, next) => {
    console.log(`--> Solicitud recibida: ${req.method} ${req.url}`);
    next();
});

// 3. CONEXIÓN A LA BASE DE DATOS
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: '1109',
    database: 'samara_cosmetics'
});

// ------------------- RUTAS DE LA API (ENDPOINTS) -------------------

// CREATE: Insertar un nuevo producto. 
app.post('/api/productos', async (req, res) => {
    console.log("✅ Éxito: Se ha entrado en la ruta POST /api/productos");
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const { resultados, ...producto } = req.body;

        const [result] = await connection.query("INSERT INTO productos_estabilidad SET ?", producto);
        
        if (resultados && resultados.length > 0) {
            const sqlResultados = "INSERT INTO resultados_analisis (producto_lote, tipo_estabilidad, analisis, parametro_evaluado, tiempo, especificacion, resultado) VALUES ?";
            const valuesResultados = resultados.map(r => [ producto.lote, r.tipo_estabilidad, r.analisis, r.parametro_evaluado, r.tiempo, r.especificacion, r.resultado ]);
            await connection.query(sqlResultados, [valuesResultados]);
        }
        
        await connection.commit();
        res.status(201).json({ 
            message: "Producto agregado con éxito", 
            consecutivo: result.insertId 
        });
    } catch (error) {
        await connection.rollback();
        console.error("Error al crear producto:", error);
        res.status(500).json({ message: "Error al crear el producto", error: error.message });
    } finally {
        connection.release();
    }
});

app.post('/api/productos/:lote/cerrar', async (req, res) => {
    try {
        const { lote } = req.params;
        const sql = "UPDATE productos_estabilidad SET cerrado = TRUE WHERE lote = ?";
        const [result] = await pool.query(sql, [lote]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Producto no encontrado" });
        }
        res.json({ message: "Producto cerrado con éxito. Ya no podrá ser modificado." });
    } catch (error) {
        console.error("Error al cerrar el producto:", error);
        res.status(500).json({ message: "Error en el servidor al cerrar el producto" });
    }
});



app.get('/api/productos', async (req, res) => {
    try {
        // MODIFICACIÓN: Añadido "WHERE cerrado = FALSE" para ocultar los completados
        const sql = "SELECT * FROM productos_estabilidad WHERE cerrado = FALSE ORDER BY consecutivo ASC";
        const [rows] = await pool.query(sql);
        res.json(rows);
    } catch (error) {
        console.error("Error al obtener todos los productos:", error);
        res.status(500).json({ message: "Error al obtener los productos", error: error.message });
    }
});

// READ (Búsqueda): Obtener productos filtrados 
app.get('/api/productos/buscar', async (req, res) => {
    try {
        const { termino } = req.query;
        if (!termino || termino.trim() === '') {
            const sql = "SELECT * FROM productos_estabilidad ORDER BY consecutivo ASC";
            const [allRows] = await pool.query(sql);
            return res.json(allRows);
        }
        const searchTerm = `%${termino}%`;
        const sql = `
            SELECT * FROM productos_estabilidad 
            WHERE producto LIKE ? OR lote LIKE ? OR referencia LIKE ?
            ORDER BY consecutivo ASC
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

// UPDATE: Actualizar un producto existente
app.put('/api/productos/:lote', async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const { lote } = req.params;
        const { resultados, ...producto } = req.body;
        const camposParaActualizar = {};
        for (const key in producto) {
            if (producto[key] !== null && producto[key] !== undefined && producto[key] !== '') {
                camposParaActualizar[key] = producto[key];
            }
        }
        if (Object.keys(camposParaActualizar).length > 0) {
            await connection.query("UPDATE productos_estabilidad SET ? WHERE lote = ?", [camposParaActualizar, lote]);
        }
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

// DELETE: Eliminar un producto
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