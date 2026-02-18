// ============================================================
// plazo-timer.js
// Temporizadores configurables para pasos "⏳ Esperar plazo"
// del flujo de subsanación y requerimiento.
// Incluir DESPUÉS de sidebar.js (y después de sidebar-patch.js
// si también se usa el módulo multi-expediente).
// ============================================================

(function () {
    'use strict';

    // ── Clave de almacenamiento ──────────────────────────────
    const STORAGE_KEY = 'pt_plazos_v1';

    // ── Patrones que identifican pasos de espera ─────────────
    const WAIT_PATTERNS = [
        /⏳\s*esperar\s+plazo\s+de\s+subsanaci[oó]n/i,
        /⏳\s*esperar\s+plazo\s+de\s+presentaci[oó]n/i,
        /⏳\s*esperar\s+plazo/i,
        /esperar\s+plazo\s+de\s+subsanaci[oó]n/i,
        /esperar\s+plazo\s+de\s+presentaci[oó]n/i,
        /esperar\s+plazo/i
    ];

    // ── Tipo de plazo por patrón ─────────────────────────────
    function detectarTipoPlazo(texto) {
        const t = (texto || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (/subsanac/.test(t)) return 'subsanacion';
        if (/presentac/.test(t)) return 'presentacion';
        return 'generico';
    }

    // ── ¿Es un paso de espera? ───────────────────────────────
    function esEspera(texto) {
        return WAIT_PATTERNS.some(p => p.test(texto || ''));
    }

    // ── Persistencia de plazos ───────────────────────────────

    function cargarPlazos() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : {};
        } catch { return {}; }
    }

    function guardarPlazos(obj) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
    }

    // Clave única por paso: usa el stepId + expediente activo si existe
    function claveStep(stepId) {
        const expId = (typeof ExpedienteManager !== 'undefined')
            ? ExpedienteManager.getActiveId() : 'default';
        return `${expId}_${stepId}`;
    }

    function getPlazoStep(stepId) {
        return cargarPlazos()[claveStep(stepId)] || null;
    }

    function setPlazoStep(stepId, fechaISOFin, label) {
        const plazos = cargarPlazos();
        plazos[claveStep(stepId)] = { fechaFin: fechaISOFin, label, actualizadoEn: Date.now() };
        guardarPlazos(plazos);
    }

    function borrarPlazoStep(stepId) {
        const plazos = cargarPlazos();
        delete plazos[claveStep(stepId)];
        guardarPlazos(plazos);
    }

    // ── Cálculo de tiempo restante ───────────────────────────

    function calcRestante(fechaISOFin) {
        const fin = new Date(fechaISOFin);
        if (isNaN(fin.getTime())) return null;
        const ms = fin - Date.now();
        return ms; // puede ser negativo (expirado)
    }

    function formatRestante(ms) {
        if (ms === null) return '—';
        const abs = Math.abs(ms);
        const expirado = ms < 0;
        const dias  = Math.floor(abs / 86400000);
        const horas = Math.floor((abs % 86400000) / 3600000);
        const mins  = Math.floor((abs % 3600000) / 60000);
        const partes = [];
        if (dias  > 0) partes.push(`${dias}d`);
        if (horas > 0) partes.push(`${horas}h`);
        if (dias  === 0) partes.push(`${mins}m`);
        const txt = partes.join(' ') || '< 1m';
        return expirado ? `−${txt} (expirado)` : txt;
    }

    function nivelUrgencia(ms) {
        if (ms === null) return 'none';
        if (ms < 0)           return 'expirado';
        if (ms < 86400000)    return 'critico';   // < 1 día
        if (ms < 3 * 86400000) return 'urgente'; // < 3 días
        if (ms < 7 * 86400000) return 'proximo'; // < 7 días
        return 'normal';
    }

    // ── Obtener fecha del XML (fecha límite presentación) ────
    function fechaXML() {
        try {
            // Intentar obtener expedienteData del scope global de sidebar.js
            if (typeof expedienteData !== 'undefined' && expedienteData && expedienteData.fechaLimitePresentacion) {
                const d = new Date(expedienteData.fechaLimitePresentacion);
                if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
            }
        } catch { /* ignorar */ }
        return null;
    }

    // ── Widget de temporizador para un nodo ──────────────────

    function crearWidget(stepId, tipo, nodoEl) {
        // Evitar duplicados
        if (nodoEl.querySelector('.pt-widget')) return;

        const guardado = getPlazoStep(stepId);
        const xmlFecha = fechaXML();

        const widget = document.createElement('div');
        widget.className = 'pt-widget';
        widget.dataset.stepId = stepId;

        // Etiqueta según tipo
        const etiquetas = {
            subsanacion:  '📌 Plazo de subsanación',
            presentacion: '📌 Plazo de presentación',
            generico:     '📌 Plazo de espera'
        };
        const labelTipo = etiquetas[tipo] || etiquetas.generico;

        // Sugerencia de fecha del XML
        const sugerenciaHTML = xmlFecha && !guardado
            ? `<button class="pt-btn pt-btn-sugerencia" data-fecha="${xmlFecha}">Usar fecha del XML (${xmlFecha})</button>` : '';

        widget.innerHTML = `
            <div class="pt-header">
                <span class="pt-tipo">${labelTipo}</span>
                <span class="pt-countdown" id="ptCd_${stepId}"></span>
            </div>
            <div class="pt-config" id="ptConfig_${stepId}">
                <div class="pt-row">
                    <label class="pt-lbl">Fecha fin del plazo:</label>
                    <input type="date" class="pt-date-input" id="ptDate_${stepId}" value="${guardado ? guardado.fechaFin.slice(0, 10) : (xmlFecha || '')}">
                    <input type="time" class="pt-time-input" id="ptTime_${stepId}" value="${guardado ? new Date(guardado.fechaFin).toTimeString().slice(0,5) : '23:59'}">
                </div>
                <div class="pt-row">
                    <input type="text" class="pt-label-input" id="ptLabel_${stepId}" placeholder="Etiqueta (ej: Plazo subsanación Exp. 2024/001)" value="${guardado ? guardado.label || '' : ''}">
                </div>
                <div class="pt-actions">
                    ${sugerenciaHTML}
                    <button class="pt-btn pt-btn-primary" id="ptBtnGuardar_${stepId}">⏱ Activar temporizador</button>
                    ${guardado ? `<button class="pt-btn pt-btn-danger" id="ptBtnBorrar_${stepId}">🗑 Eliminar</button>` : ''}
                </div>
            </div>
        `;

        nodoEl.appendChild(widget);

        // Botón guardar
        widget.querySelector(`#ptBtnGuardar_${stepId}`).addEventListener('click', () => {
            const dateVal  = widget.querySelector(`#ptDate_${stepId}`).value;
            const timeVal  = widget.querySelector(`#ptTime_${stepId}`).value || '23:59';
            const labelVal = widget.querySelector(`#ptLabel_${stepId}`).value.trim();
            if (!dateVal) {
                ptAlert(widget, '⚠️ Introduce una fecha para el plazo');
                return;
            }
            const fechaFin = `${dateVal}T${timeVal}:00`;
            setPlazoStep(stepId, fechaFin, labelVal);
            // Refresh del widget
            nodoEl.querySelector('.pt-widget').remove();
            crearWidget(stepId, tipo, nodoEl);
        });

        // Botón borrar
        const btnBorrar = widget.querySelector(`#ptBtnBorrar_${stepId}`);
        if (btnBorrar) {
            btnBorrar.addEventListener('click', () => {
                borrarPlazoStep(stepId);
                nodoEl.querySelector('.pt-widget').remove();
                crearWidget(stepId, tipo, nodoEl);
            });
        }

        // Botón sugerencia XML
        const btnSug = widget.querySelector('.pt-btn-sugerencia');
        if (btnSug) {
            btnSug.addEventListener('click', () => {
                widget.querySelector(`#ptDate_${stepId}`).value = btnSug.dataset.fecha;
            });
        }

        // Iniciar cuenta atrás si hay plazo guardado
        if (guardado) {
            iniciarCuentaAtras(stepId, guardado.fechaFin, widget);
        }
    }

    function ptAlert(widget, msg) {
        let alerta = widget.querySelector('.pt-alerta');
        if (!alerta) {
            alerta = document.createElement('div');
            alerta.className = 'pt-alerta';
            widget.querySelector('.pt-actions').appendChild(alerta);
        }
        alerta.textContent = msg;
        setTimeout(() => alerta.remove(), 3000);
    }

    // ── Cuenta atrás en vivo ──────────────────────────────────

    const _timers = {}; // stepId → intervalId

    function iniciarCuentaAtras(stepId, fechaFin, widget) {
        if (_timers[stepId]) clearInterval(_timers[stepId]);

        const cdEl = widget.querySelector(`#ptCd_${stepId}`);
        if (!cdEl) return;

        const actualizar = () => {
            const ms = calcRestante(fechaFin);
            if (ms === null) return;
            const nivel = nivelUrgencia(ms);
            const texto = formatRestante(ms);
            cdEl.textContent = texto;
            cdEl.className = `pt-countdown pt-cd-${nivel}`;

            // Actualizar borde del widget
            widget.className = `pt-widget pt-widget-${nivel}`;
        };

        actualizar();
        _timers[stepId] = setInterval(actualizar, 60000); // actualizar cada minuto
    }

    // ── Observar renderizado del flujo ────────────────────────
    // Cada vez que sidebar.js re-renderiza el flujo, añadimos
    // el widget a los nodos de espera visibles.

    function attachWidgets() {
        const nodos = document.querySelectorAll('.node');
        nodos.forEach(nodo => {
            // Obtener el texto del nodo
            const titleEl = nodo.querySelector('.node-title, .node-text, h3, p');
            const texto = nodo.textContent || '';
            if (!esEspera(texto)) return;

            // Obtener stepId desde el índice del nodo
            const idx = nodo.getAttribute('data-step-index');
            if (idx === null) return;

            // Usar el id real del step si está disponible
            let stepId = idx;
            if (typeof flowDefinition !== 'undefined' && flowDefinition[parseInt(idx)]) {
                stepId = String(flowDefinition[parseInt(idx)].id);
            }

            const tipo = detectarTipoPlazo(texto);
            crearWidget(stepId, tipo, nodo);
        });
    }

    // ── Observador de cambios en el flowchart ─────────────────

    function setupObserver() {
        const fc = document.getElementById('flowchart');
        if (!fc) return;

        attachWidgets();

        const obs = new MutationObserver(() => {
            // Pequeño debounce para no disparar 50 veces
            clearTimeout(obs._t);
            obs._t = setTimeout(attachWidgets, 80);
        });
        obs.observe(fc, { childList: true, subtree: true });
    }

    // ── Estilos ───────────────────────────────────────────────

    function injectStyles() {
        if (document.getElementById('ptStyles')) return;
        const s = document.createElement('style');
        s.id = 'ptStyles';
        s.textContent = `
        /* ── Widget base ── */
        .pt-widget {
            margin-top: 12px;
            padding: 12px 14px;
            border-radius: 10px;
            background: #f8fafc;
            border: 2px solid #cbd5e1;
            font-size: 13px;
            transition: border-color .3s, background .3s;
        }

        /* ── Niveles de urgencia ── */
        .pt-widget-normal   { border-color: #bfdbfe; background: #eff6ff; }
        .pt-widget-proximo  { border-color: #fde68a; background: #fefce8; }
        .pt-widget-urgente  { border-color: #fdba74; background: #fff7ed; }
        .pt-widget-critico  { border-color: #f87171; background: #fef2f2; animation: pt-pulse 1.5s infinite; }
        .pt-widget-expirado { border-color: #dc2626; background: #fef2f2; }

        @keyframes pt-pulse {
            0%, 100% { box-shadow: 0 0 0 0 rgba(220, 38, 38, .3); }
            50%       { box-shadow: 0 0 0 6px rgba(220, 38, 38, 0); }
        }

        /* ── Header ── */
        .pt-header {
            display: flex; justify-content: space-between; align-items: center;
            margin-bottom: 10px;
        }
        .pt-tipo { font-weight: 700; color: #334155; font-size: 13px; }

        /* ── Cuenta atrás ── */
        .pt-countdown {
            font-weight: 700; font-size: 18px; font-variant-numeric: tabular-nums;
            padding: 2px 10px; border-radius: 8px; min-width: 60px; text-align: center;
        }
        .pt-cd-none     { color: #94a3b8; font-size: 13px; }
        .pt-cd-normal   { background: #dbeafe; color: #1d4ed8; }
        .pt-cd-proximo  { background: #fef9c3; color: #854d0e; }
        .pt-cd-urgente  { background: #ffedd5; color: #9a3412; }
        .pt-cd-critico  { background: #fee2e2; color: #dc2626; }
        .pt-cd-expirado { background: #fca5a5; color: #7f1d1d; }

        /* ── Configuración ── */
        .pt-config { display: flex; flex-direction: column; gap: 8px; }
        .pt-row { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
        .pt-lbl { font-size: 12px; color: #64748b; font-weight: 600; white-space: nowrap; }

        .pt-date-input, .pt-time-input, .pt-label-input {
            border: 1px solid #d1d5db; border-radius: 6px;
            padding: 5px 8px; font-size: 12px;
            outline: none; background: #fff;
            transition: border-color .2s;
        }
        .pt-date-input:focus, .pt-time-input:focus, .pt-label-input:focus {
            border-color: #3b82f6;
        }
        .pt-date-input  { flex: 0 0 auto; }
        .pt-time-input  { width: 70px; }
        .pt-label-input { flex: 1; min-width: 160px; }

        /* ── Acciones ── */
        .pt-actions { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
        .pt-btn {
            border: none; border-radius: 6px; cursor: pointer;
            padding: 5px 11px; font-size: 12px; font-weight: 600; transition: all .2s;
        }
        .pt-btn-primary    { background: #3b82f6; color: #fff; }
        .pt-btn-primary:hover { background: #2563eb; }
        .pt-btn-danger     { background: #fee2e2; color: #b91c1c; }
        .pt-btn-danger:hover { background: #fecaca; }
        .pt-btn-sugerencia { background: #d1fae5; color: #065f46; }
        .pt-btn-sugerencia:hover { background: #a7f3d0; }
        .pt-alerta { font-size: 11px; color: #dc2626; font-weight: 600; }
        `;
        document.head.appendChild(s);
    }

    // ── Arranque ──────────────────────────────────────────────

    function init() {
        injectStyles();
        if (document.readyState === 'complete') setupObserver();
        else window.addEventListener('load', setupObserver);
    }

    init();

})();
