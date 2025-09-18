document.getElementById('guardarBtn').addEventListener('click', guardarEstudio);

function guardarEstudio() {
    // 1. Recolectar Información General
    const infoGeneral = {
        notificacion_sanitaria: document.getElementById('notificacion_sanitaria').value,
        producto: document.getElementById('producto').value,
        lote: document.getElementById('lote').value,
        fabricante: document.getElementById('fabricante').value,
        titular_registro: document.getElementById('titular_registro').value,
        lugar_estudio: document.getElementById('lugar_estudio').value,
        fecha_inicio: document.getElementById('fecha_inicio').value,
        fecha_finalizacion: document.getElementById('fecha_finalizacion').value,
    };

    // 2. Recolectar Resultados Principales (Acelerada y Natural)
    const resultadosPrincipales = [];
    
    // Función para procesar una tabla principal (Acelerada o Natural)
    const procesarTablaPrincipal = (tablaId, tipoEstudio) => {
        const tabla = document.getElementById(tablaId);
        const headers = Array.from(tabla.querySelectorAll('thead th')).map(th => th.textContent);
        const filas = tabla.querySelectorAll('tbody tr');

        filas.forEach(fila => {
            const parametro = fila.querySelector('td[data-param]').dataset.param;
            const celdas = fila.querySelectorAll('td');
            for (let i = 4; i < celdas.length; i++) { // Empezar desde la columna de resultados
                const tiempo = headers[i];
                const resultado = celdas[i].querySelector('select, input').value;
                if (resultado) {
                    resultadosPrincipales.push({ tipo_estudio: tipoEstudio, parametro, tiempo, resultado });
                }
            }
        });
    };
    
    procesarTablaPrincipal('tablaAcelerada', 'Acelerada');
    procesarTablaPrincipal('tablaNatural', 'Natural');

    // 3. Recolectar Resultados Microbiológicos
    const resultadosMicrobiologicos = [];
    
    const procesarTablaMicro = (tablaId, tipoEstudio) => {
        const tabla = document.getElementById(tablaId);
        const filas = tabla.querySelectorAll('tbody tr');

        filas.forEach(fila => {
            const celdas = fila.querySelectorAll('td');
            const tiempo = celdas[0].textContent;
            resultadosMicrobiologicos.push({
                tipo_estudio: tipoEstudio,
                tiempo: tiempo,
                recuento_mesofilos: celdas[1].querySelector('input').value,
                pseudomona: celdas[2].querySelector('input').value,
                ecoli: celdas[3].querySelector('input').value,
                staphylococcus: celdas[4].querySelector('input').value,
            });
        });
    };

    procesarTablaMicro('microNatural', 'Natural');
    procesarTablaMicro('microAcelerada', 'Acelerada');
    
    // 4. Consolidar todos los datos en un solo objeto
    const datosCompletos = {
        infoGeneral,
        resultadosPrincipales,
        resultadosMicrobiologicos,
    };
    
    // 5. Enviar al Back-end
    fetch('/api/guardar-estudio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datosCompletos)
    })
    .then(response => response.json())
    .then(data => {
        mostrarMensaje(data.message, 'exito');
        console.log('Respuesta del servidor:', data);
    })
    .catch(error => {
        mostrarMensaje('Error al guardar. Revise la consola.', 'error');
        console.error('Error:', error);
    });
}

function mostrarMensaje(texto, tipo) {
    const elMensaje = document.getElementById('mensaje');
    elMensaje.textContent = texto;
    elMensaje.className = tipo; // 'exito' o 'error'
    elMensaje.style.display = 'block';
}