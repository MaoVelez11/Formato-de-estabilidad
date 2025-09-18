// Archivo: server.js
const express = require('express');
const path = require('path');
const db = require('./database.js'); // Usa tu database.js original de 4 tablas
const app = express();
const PORT = 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// --- FUNCIONES ASÍNCRONAS PARA LA DB ---
// (Estas son tus funciones, un poco mejoradas para manejar errores)
const getAsync = (sql, params = []) => new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
});
const runAsync = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function(err) { err ? reject(err) : resolve(this); });
});


// --- ENDPOINT MODIFICADO PARA MANEJAR MÚLTIPLES ESTUDIOS ---
app.post('/api/estudio', async (req, res) => {
    // 1. Ahora esperamos un ARRAY de estudios del body
    const estudios = req.body;
    if (!Array.isArray(estudios) || estudios.length === 0) {
        return res.status(400).json({ "error": "Se esperaba una lista de estudios." });
    }

    try {
        // Usamos una transacción para asegurar que todo se guarde o nada se guarde
        await runAsync("BEGIN TRANSACTION");

        // 2. Iteramos sobre cada estudio enviado desde el formulario
        for (const estudio of estudios) {
            const { titular, producto, referencia, lote, ...datosEstudio } = estudio;

            if (!titular || !producto || !lote) {
                // Si encontramos un error, revertimos la transacción y paramos
                await runAsync("ROLLBACK");
                return res.status(400).json({ "error": `La fila con lote '${lote || ''}' tiene campos obligatorios vacíos (Titular, Producto, Lote).` });
            }

            // 3. Obtener o crear Cliente
            await runAsync(`INSERT INTO Clientes (nombre_titular) VALUES (?) ON CONFLICT(nombre_titular) DO NOTHING`, [titular]);
            const cliente = await getAsync(`SELECT id_cliente FROM Clientes WHERE nombre_titular = ?`, [titular]);

            // 4. Obtener o crear Producto
            await runAsync(`INSERT INTO Productos (nombre_producto, referencia) VALUES (?, ?) ON CONFLICT(referencia) DO NOTHING`, [producto, referencia]);
            const prod = await getAsync(`SELECT id_producto FROM Productos WHERE referencia = ?`, [referencia]);

            // 5. Insertar o Actualizar el Estudio principal
            const sqlEstudio = `
                INSERT INTO Estudios (lote, registro_sanitario, descripcion, pruebas, observaciones, unidades, id_cliente, id_producto)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(lote) DO UPDATE SET
                    registro_sanitario=excluded.registro_sanitario,
                    descripcion=excluded.descripcion,
                    pruebas=excluded.pruebas,
                    observaciones=excluded.observaciones,
                    unidades=excluded.unidades;
            `;
            await runAsync(sqlEstudio, [lote, datosEstudio.registro_sanitario, datosEstudio.descripcion, datosEstudio.pruebas, datosEstudio.observaciones, datosEstudio.total_unidades, cliente.id_cliente, prod.id_producto]);
            
            // 6. Obtener el ID del estudio que acabamos de guardar
            const estudioDB = await getAsync(`SELECT id_estudio FROM Estudios WHERE lote = ?`, [lote]);

            // 7. Guardar los resultados (fechas de T0, T1, T3...) en la tabla 'Resultados'
            // Primero, borramos los resultados viejos para evitar duplicados
            await runAsync(`DELETE FROM Resultados WHERE id_estudio = ?`, [estudioDB.id_estudio]);
            
            const stmtResultados = db.prepare(`INSERT INTO Resultados (id_estudio, parametro, tiempo, resultado) VALUES (?, ?, ?, ?)`);
            
            // Mapeamos los campos del formulario a los parámetros de la tabla Resultados
            const camposDeTiempo = {
                "Acelerada T0": datosEstudio.acelerada_t0, "Acelerada T1": datosEstudio.acelerada_t1, "Acelerada T2": datosEstudio.acelerada_t2, "Acelerada T3": datosEstudio.acelerada_t3,
                "Natural T3": datosEstudio.natural_t3, "Natural T6": datosEstudio.natural_t6, "Natural T9": datosEstudio.natural_t9, "Natural T12": datosEstudio.natural_t12,
                "Natural T18": datosEstudio.natural_t18, "Natural T24": datosEstudio.natural_t24, "Natural T27": datosEstudio.natural_t27, "Natural T30": datosEstudio.natural_t30,
                "Natural T33": datosEstudio.natural_t33, "Natural T36": datosEstudio.natural_t36
            };
            
            for (const [tiempo, resultado] of Object.entries(camposDeTiempo)) {
                if (resultado) { // Solo guardamos si hay una fecha
                    stmtResultados.run(estudioDB.id_estudio, "Fecha de Muestra", tiempo, resultado);
                }
            }
            await new Promise((resolve, reject) => stmtResultados.finalize(err => err ? reject(err) : resolve()));
        }

        // Si todo salió bien, confirmamos los cambios en la base de datos
        await runAsync("COMMIT");
        res.json({ message: `Se procesaron ${estudios.length} estudios exitosamente.` });

    } catch (error) {
        // Si algo falló, revertimos todos los cambios
        await runAsync("ROLLBACK");
        console.error("Error al procesar la lista de estudios:", error.message);
        res.status(500).json({ "error": error.message });
    }
});


// Dejamos el endpoint de resultados por si lo usas en otra página
app.post('/api/resultados', async (req, res) => {
    // ... tu código original para /api/resultados ...
});


app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});