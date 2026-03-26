// ============================================================
// PATCH – gestión multi-expediente y puntos de control
// sidebar-patch.js – incluir DESPUÉS de expediente-manager.js
//                    e ANTES de sidebar.js
// ============================================================

(function () {
    'use strict';

    // ─── IDs de almacenamiento legado (migración automática) ───
    const LEGACY_FLOW_KEY = 'flujo_licitacion_mejorado_v1';
    const LEGACY_DATA_KEY = 'expediente_data';

    // ─── Referencia al expediente activo en esta sesión ────────
    let _activeId = null;

    // ─── Acceso DIRECTO a localStorage sin pasar por el proxy ──
    // (se define antes de instalar el proxy)
    const _origGetItem    = Storage.prototype.getItem;
    const _origSetItem    = Storage.prototype.setItem;
    const _origRemoveItem = Storage.prototype.removeItem;

    function rawGet(key)        { return _origGetItem.call(localStorage, key); }
    function rawSet(key, value) { return _origSetItem.call(localStorage, key, value); }
    function rawDel(key)        { return _origRemoveItem.call(localStorage, key); }

    // ─── INICIALIZACIÓN ─────────────────────────────────────────
    // Lee la lista de expedientes directamente del storage (sin proxy)
    // para garantizar que obtenemos todos los expedientes guardados.

    function resolveActiveExpediente() {
        // 1. Leer la lista DIRECTAMENTE (bypass del proxy que aún no está activo)
        let list = [];
        try {
            const raw = rawGet('em_expedientes_list');
            list = raw ? JSON.parse(raw) : [];
            if (!Array.isArray(list)) list = [];
        } catch (e) {
            list = [];
        }

        // 2. Leer el ID activo guardado
        let savedActiveId = null;
        try {
            savedActiveId = rawGet('em_expediente_activo') || null;
        } catch (e) { /* ignorar */ }

        // 3. Verificar si el ID activo existe en la lista
        const activeExists = savedActiveId && list.some(e => e.id === savedActiveId);

        if (list.length === 0) {
            // No hay expedientes: crear uno por defecto migrando datos legacy si existen
            const legacyFlow = rawGet(LEGACY_FLOW_KEY);
            const legacyData = rawGet(LEGACY_DATA_KEY);

            _activeId = ExpedienteManager.createExpediente('Expediente principal');

            if (legacyFlow) {
                try { ExpedienteManager.saveFlowState(_activeId, JSON.parse(legacyFlow)); }
                catch (e) { /* ignorar */ }
            }
            if (legacyData) {
                try { ExpedienteManager.saveXMLData(_activeId, JSON.parse(legacyData)); }
                catch (e) { /* ignorar */ }
            }

            // Limpiar claves legacy
            rawDel(LEGACY_FLOW_KEY);
            rawDel(LEGACY_DATA_KEY);

        } else if (activeExists) {
            // El ID activo es válido: usarlo
            _activeId = savedActiveId;

        } else {
            // Hay expedientes pero el ID activo no es válido: usar el primero
            _activeId = list[0].id;
        }

        ExpedienteManager.setActiveId(_activeId);
    }

    // ─── PROXY DE localStorage ──────────────────────────────────
    // Redirige las claves legacy de sidebar.js al expediente activo.
    // Se instala DESPUÉS de resolver el expediente activo.

    Storage.prototype.getItem = function (key) {
        if (key === LEGACY_FLOW_KEY && _activeId) {
            const v = ExpedienteManager.loadFlowState(_activeId);
            return v ? JSON.stringify(v) : null;
        }
        if (key === LEGACY_DATA_KEY && _activeId) {
            const v = ExpedienteManager.loadXMLData(_activeId);
            return v ? JSON.stringify(v) : null;
        }
        return _origGetItem.call(this, key);
    };

    Storage.prototype.setItem = function (key, value) {
        if (key === LEGACY_FLOW_KEY && _activeId) {
            try { ExpedienteManager.saveFlowState(_activeId, JSON.parse(value)); }
            catch (e) { /* ignorar */ }
            return;
        }
        if (key === LEGACY_DATA_KEY && _activeId) {
            try { ExpedienteManager.saveXMLData(_activeId, JSON.parse(value)); }
            catch (e) { /* ignorar */ }
            if (document.getElementById('emPanel')) refreshPanel();
            return;
        }
        _origSetItem.call(this, key, value);
    };

    Storage.prototype.removeItem = function (key) {
        if (key === LEGACY_DATA_KEY && _activeId) {
            ExpedienteManager.clearXMLData(_activeId);
            if (document.getElementById('emPanel')) refreshPanel();
            return;
        }
        _origRemoveItem.call(this, key);
    };

    // ─── PANEL DE GESTIÓN ───────────────────────────────────────

    function buildPanel() {
        if (document.getElementById('emPanel')) return;

        const panel = document.createElement('div');
        panel.id = 'emPanel';
        panel.className = 'em-panel';

        // Cabecera
        const header = document.createElement('div');
        header.className = 'em-header';
        header.id = 'emHeaderToggle';

        const title = document.createElement('span');
        title.textContent = 'Expedientes';

        const headerActions = document.createElement('div');
        headerActions.className = 'em-header-actions';

        const activeLabel = document.createElement('span');
        activeLabel.className = 'em-active-label';
        activeLabel.id = 'emActiveLabel';

        const btnNuevo = document.createElement('button');
        btnNuevo.className = 'em-btn em-btn-sm em-btn-primary';
        btnNuevo.id = 'emBtnNuevo';
        btnNuevo.title = 'Nuevo expediente';
        btnNuevo.textContent = '+ Nuevo';

        const toggleIcon = document.createElement('span');
        toggleIcon.className = 'em-toggle-icon';
        toggleIcon.id = 'emToggleIcon';
        toggleIcon.textContent = 'v';

        headerActions.appendChild(activeLabel);
        headerActions.appendChild(btnNuevo);
        headerActions.appendChild(toggleIcon);
        header.appendChild(title);
        header.appendChild(headerActions);

        // Cuerpo
        const body = document.createElement('div');
        body.className = 'em-body';
        body.id = 'emBody';

        const list = document.createElement('div');
        list.id = 'emList';
        list.className = 'em-list';

        const sectionTitle = document.createElement('div');
        sectionTitle.className = 'em-section-title';
        sectionTitle.appendChild(document.createTextNode('Puntos de control – '));
        const cpName = document.createElement('span');
        cpName.id = 'emCpExpedienteNombre';
        sectionTitle.appendChild(cpName);

        const cpBar = document.createElement('div');
        cpBar.className = 'em-cp-bar';

        const cpInput = document.createElement('input');
        cpInput.type = 'text';
        cpInput.id = 'emCpLabel';
        cpInput.className = 'em-input';
        cpInput.placeholder = 'Nombre del punto de control...';
        cpInput.maxLength = 60;

        const btnGuardarCp = document.createElement('button');
        btnGuardarCp.className = 'em-btn em-btn-primary';
        btnGuardarCp.id = 'emBtnGuardarCp';
        btnGuardarCp.textContent = 'Guardar';

        cpBar.appendChild(cpInput);
        cpBar.appendChild(btnGuardarCp);

        const cpList = document.createElement('div');
        cpList.id = 'emCpList';
        cpList.className = 'em-cp-list';

        body.appendChild(list);
        body.appendChild(sectionTitle);
        body.appendChild(cpBar);
        body.appendChild(cpList);

        panel.appendChild(header);
        panel.appendChild(body);

        const content = document.querySelector('.content') || document.body;
        content.insertAdjacentElement('afterbegin', panel);

        // Listeners
        document.getElementById('emHeaderToggle').addEventListener('click', (e) => {
            if (e.target.closest('button') && e.target.id !== 'emHeaderToggle') return;
            togglePanel();
        });

        document.getElementById('emBtnNuevo').addEventListener('click', (e) => {
            e.stopPropagation();
            crearNuevoExpediente();
        });

        document.getElementById('emBtnGuardarCp').addEventListener('click', guardarPuntoControl);

        refreshPanel();
    }

    let _panelOpen = false;

    function togglePanel() {
        _panelOpen = !_panelOpen;
        const body = document.getElementById('emBody');
        const icon = document.getElementById('emToggleIcon');
        if (body) body.style.display = _panelOpen ? 'block' : 'none';
        if (icon) icon.textContent = _panelOpen ? '^' : 'v';
    }

    function refreshPanel() {
        renderExpedienteList();
        renderCheckpointList();
        updateActiveLabel();
    }

    function updateActiveLabel() {
        const lbl = document.getElementById('emActiveLabel');
        if (!lbl) return;
        // Leer la lista directamente para garantizar datos frescos
        const list = getListDirect();
        const active = list.find(e => e.id === _activeId);
        lbl.textContent = active ? active.nombre : '';

        const cpNombre = document.getElementById('emCpExpedienteNombre');
        if (cpNombre) cpNombre.textContent = active ? active.nombre : '';
    }

    // Lee la lista de expedientes directamente (sin pasar por el proxy)
    function getListDirect() {
        try {
            const raw = rawGet('em_expedientes_list');
            const list = raw ? JSON.parse(raw) : [];
            return Array.isArray(list) ? list : [];
        } catch (e) {
            return [];
        }
    }

    // ─── Lista de expedientes ───────────────────────────────────

    function renderExpedienteList() {
        const container = document.getElementById('emList');
        if (!container) return;
        container.replaceChildren();

        // Usar la lectura directa para garantizar que se ven todos los expedientes
        const list = getListDirect();

        if (list.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'em-empty';
            empty.textContent = 'Sin expedientes guardados';
            container.appendChild(empty);
            return;
        }

        list.forEach(exp => {
            const isActive = exp.id === _activeId;
            const flowState = ExpedienteManager.loadFlowState(exp.id);
            const total = (typeof flowDefinition !== 'undefined') ? flowDefinition.length : 0;
            const pct = ExpedienteManager.calcProgress(flowState, total);
            const checks = ExpedienteManager.getCheckpoints(exp.id).length;

            const item = document.createElement('div');
            item.className = 'em-item' + (isActive ? ' em-item-active' : '');

            const itemMain = document.createElement('div');
            itemMain.className = 'em-item-main';
            itemMain.dataset.id = exp.id;

            const itemName = document.createElement('div');
            itemName.className = 'em-item-name';
            itemName.title = exp.nombre;
            itemName.textContent = exp.nombre;

            const itemMeta = document.createElement('div');
            itemMeta.className = 'em-item-meta';

            if (exp.ref) {
                const ref = document.createElement('span');
                ref.className = 'em-ref';
                ref.textContent = exp.ref;
                itemMeta.appendChild(ref);
            }

            const pctSpan = document.createElement('span');
            pctSpan.className = 'em-pct';
            pctSpan.textContent = `${pct}%`;
            itemMeta.appendChild(pctSpan);

            if (checks) {
                const cpBadge = document.createElement('span');
                cpBadge.className = 'em-cp-badge';
                cpBadge.textContent = `CP ${checks}`;
                itemMeta.appendChild(cpBadge);
            }

            if (exp.xmlBinding && (exp.xmlBinding.fileName || exp.xmlBinding.contractFolderId)) {
                const xmlBadge = document.createElement('span');
                xmlBadge.className = 'em-xml-badge';
                const xmlLabel = exp.xmlBinding.fileName || exp.xmlBinding.contractFolderId;
                xmlBadge.title = `XML asociado: ${xmlLabel}`;
                xmlBadge.textContent = `XML`;
                itemMeta.appendChild(xmlBadge);
            } else {
                const xmlMissing = document.createElement('span');
                xmlMissing.className = 'em-xml-missing';
                xmlMissing.textContent = 'Sin XML';
                itemMeta.appendChild(xmlMissing);
            }

            const progressBar = document.createElement('div');
            progressBar.className = 'em-progress-bar';
            const progressFill = document.createElement('div');
            progressFill.className = 'em-progress-fill';
            progressFill.style.width = `${pct}%`;
            progressBar.appendChild(progressFill);

            itemMain.appendChild(itemName);
            itemMain.appendChild(itemMeta);
            itemMain.appendChild(progressBar);

            const itemActions = document.createElement('div');
            itemActions.className = 'em-item-actions';

            const renameBtn = document.createElement('button');
            renameBtn.className = 'em-btn em-btn-xs';
            renameBtn.dataset.action = 'rename';
            renameBtn.dataset.id = exp.id;
            renameBtn.title = 'Renombrar';
            renameBtn.textContent = 'Renombrar';

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'em-btn em-btn-xs em-btn-danger';
            deleteBtn.dataset.action = 'delete';
            deleteBtn.dataset.id = exp.id;
            deleteBtn.title = 'Eliminar';
            deleteBtn.textContent = 'Eliminar';
            deleteBtn.disabled = list.length === 1;

            itemActions.appendChild(renameBtn);
            itemActions.appendChild(deleteBtn);
            item.appendChild(itemMain);
            item.appendChild(itemActions);

            // Activar expediente al hacer clic en la zona principal
            itemMain.addEventListener('click', () => activarExpediente(exp.id));

            renameBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const nuevo = prompt('Nuevo nombre:', exp.nombre);
                if (nuevo && nuevo.trim()) {
                    ExpedienteManager.renameExpediente(exp.id, nuevo.trim());
                    refreshPanel();
                }
            });

            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm(`¿Eliminar el expediente "${exp.nombre}" y todos sus datos?\nEsta acción no se puede deshacer.`)) {
                    ExpedienteManager.deleteExpediente(exp.id);
                    if (_activeId === exp.id) {
                        _activeId = ExpedienteManager.getActiveId();
                        recargarEstadoActivo();
                    }
                    refreshPanel();
                }
            });

            container.appendChild(item);
        });
    }

    // ─── Puntos de control ──────────────────────────────────────

    function renderCheckpointList() {
        const container = document.getElementById('emCpList');
        if (!container) return;
        container.replaceChildren();

        const checks = ExpedienteManager.getCheckpoints(_activeId);

        if (checks.length === 0) {
            const empty = document.createElement('div');
            empty.className = 'em-empty';
            empty.textContent = 'Sin puntos de control guardados';
            container.appendChild(empty);
            return;
        }

        checks.forEach(cp => {
            const fecha = new Date(cp.savedAt).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });
            const total = (typeof flowDefinition !== 'undefined') ? flowDefinition.length : 0;
            const pct = ExpedienteManager.calcProgress(cp.fluidState, total);

            const item = document.createElement('div');
            item.className = 'em-cp-item';

            const cpInfo = document.createElement('div');
            cpInfo.className = 'em-cp-info';

            const cpName = document.createElement('div');
            cpName.className = 'em-cp-name';
            cpName.textContent = cp.label;

            const cpMeta = document.createElement('div');
            cpMeta.className = 'em-cp-meta';
            cpMeta.textContent = `${fecha} – Paso ${cp.step + 1} – ${pct}%`;

            cpInfo.appendChild(cpName);
            cpInfo.appendChild(cpMeta);

            const cpActions = document.createElement('div');
            cpActions.className = 'em-cp-actions';

            const restoreBtn = document.createElement('button');
            restoreBtn.className = 'em-btn em-btn-xs em-btn-restore';
            restoreBtn.title = 'Restaurar este punto';
            restoreBtn.textContent = 'Restaurar';

            const delBtn = document.createElement('button');
            delBtn.className = 'em-btn em-btn-xs em-btn-danger';
            delBtn.title = 'Eliminar punto';
            delBtn.textContent = 'Eliminar';

            cpActions.appendChild(restoreBtn);
            cpActions.appendChild(delBtn);
            item.appendChild(cpInfo);
            item.appendChild(cpActions);

            restoreBtn.addEventListener('click', () => restaurarPuntoControl(cp.cpId));
            delBtn.addEventListener('click', () => {
                if (confirm(`¿Eliminar el punto de control "${cp.label}"?`)) {
                    ExpedienteManager.deleteCheckpoint(_activeId, cp.cpId);
                    renderCheckpointList();
                }
            });

            container.appendChild(item);
        });
    }

    // ─── Acciones ───────────────────────────────────────────────

    function crearNuevoExpediente() {
        const nombre = prompt('Nombre del nuevo expediente:');
        if (!nombre || !nombre.trim()) return;
        const ref = prompt('Referencia/número de expediente (opcional):') || '';
        const id = ExpedienteManager.createExpediente(nombre.trim(), ref.trim());

        ExpedienteManager.saveFlowState(id, {
            currentStep: 0,
            completedSteps: [],
            decisions: {},
            stepNotes: {},
            stepTimestamps: {},
            stepStartTimes: {}
        });
        ExpedienteManager.clearXMLData(id);

        activarExpediente(id);
    }

    function activarExpediente(id) {
        if (id === _activeId) return;
        _activeId = id;
        ExpedienteManager.setActiveId(id);
        try {
            window.dispatchEvent(new CustomEvent('em:active-expediente-changed', { detail: { id } }));
        } catch (_) {}
        recargarEstadoActivo();
        refreshPanel();
        showEmToast('Expediente cargado');
    }

    function recargarEstadoActivo() {
        if (typeof loadData === 'function') loadData();
        if (typeof loadExpedienteData === 'function') loadExpedienteData();
        if (typeof renderFlow === 'function') renderFlow();
        if (typeof focusCurrentStepCard === 'function') {
            requestAnimationFrame(() => focusCurrentStepCard(false));
        }
    }

    function guardarPuntoControl() {
        const labelInput = document.getElementById('emCpLabel');
        const label = labelInput ? labelInput.value.trim() : '';
        const finalLabel = label || `Punto ${new Date().toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}`;

        const flowState = ExpedienteManager.loadFlowState(_activeId) || {};
        const xmlData   = ExpedienteManager.loadXMLData(_activeId);

        const cp = ExpedienteManager.saveCheckpoint(_activeId, finalLabel, flowState, xmlData);
        if (labelInput) labelInput.value = '';
        renderCheckpointList();
        showEmToast(`Punto guardado: ${cp.label}`);
    }

    function restaurarPuntoControl(cpId) {
        const checks = ExpedienteManager.getCheckpoints(_activeId);
        const cp = checks.find(c => c.cpId === cpId);
        if (!cp) return;
        if (!confirm(`¿Restaurar al punto de control "${cp.label}"?\nEl progreso actual se perderá.`)) return;

        ExpedienteManager.saveFlowState(_activeId, cp.fluidState);
        if (cp.xmlData) {
            ExpedienteManager.saveXMLData(_activeId, cp.xmlData);
        } else {
            ExpedienteManager.clearXMLData(_activeId);
        }

        recargarEstadoActivo();
        refreshPanel();
        showEmToast(`Restaurado: ${cp.label}`);
    }

    // ─── Toast ──────────────────────────────────────────────────

    function showEmToast(msg) {
        let t = document.getElementById('emToast');
        if (!t) {
            t = document.createElement('div');
            t.id = 'emToast';
            t.className = 'em-toast';
            document.body.appendChild(t);
        }
        t.textContent = msg;
        t.classList.add('em-toast-show');
        clearTimeout(t._timer);
        t._timer = setTimeout(() => t.classList.remove('em-toast-show'), 3000);
    }

    // ─── Estilos ─────────────────────────────────────────────────

    function injectStyles() {
        if (document.getElementById('emStyles')) return;
        const style = document.createElement('style');
        style.id = 'emStyles';
        style.textContent = `
        .em-panel {
            background:#fff; border-radius:12px;
            box-shadow:0 2px 10px rgba(0,0,0,.1);
            margin-bottom:16px; border-left:4px solid #4f46e5;
            overflow:hidden; font-size:14px;
        }
        .em-header {
            display:flex; align-items:center; justify-content:space-between;
            padding:10px 14px;
            background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%);
            color:#fff; cursor:pointer; user-select:none;
            font-weight:600; font-size:14px;
        }
        .em-header-actions { display:flex; align-items:center; gap:8px; }
        .em-active-label {
            font-size:12px; opacity:.85; max-width:140px;
            overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
        }
        .em-toggle-icon { font-size:16px; line-height:1; }
        .em-body { display:none; padding:12px; }
        .em-list { display:flex; flex-direction:column; gap:6px; margin-bottom:14px; }
        .em-item {
            display:flex; align-items:stretch; gap:6px;
            border:1px solid #e5e7eb; border-radius:8px;
            overflow:hidden; transition:border-color .2s;
        }
        .em-item:hover { border-color:#4f46e5; }
        .em-item-active { border-color:#4f46e5; background:#f5f3ff; }
        .em-item-main { flex:1; padding:8px 10px; cursor:pointer; min-width:0; }
        .em-item-name {
            font-weight:600; color:#111827; white-space:nowrap;
            overflow:hidden; text-overflow:ellipsis; font-size:13px;
        }
        .em-item-meta {
            display:flex; gap:8px; align-items:center;
            margin-top:3px; font-size:11px; color:#6b7280;
        }
        .em-ref { background:#ede9fe; color:#5b21b6; padding:1px 6px; border-radius:10px; }
        .em-pct { font-weight:600; color:#4f46e5; }
        .em-cp-badge { color:#d97706; }
        .em-xml-badge {
            background:#dcfce7; color:#166534;
            padding:1px 6px; border-radius:10px; font-weight:600;
        }
        .em-xml-missing {
            background:#fee2e2; color:#991b1b;
            padding:1px 6px; border-radius:10px; font-weight:600;
        }
        .em-progress-bar {
            margin-top:5px; height:4px; background:#e5e7eb;
            border-radius:2px; overflow:hidden;
        }
        .em-progress-fill {
            height:100%;
            background:linear-gradient(90deg,#4f46e5,#7c3aed);
            border-radius:2px; transition:width .4s ease;
        }
        .em-item-actions {
            display:flex; flex-direction:column; justify-content:center;
            gap:4px; padding:6px 8px; background:#f9fafb;
            border-left:1px solid #e5e7eb;
        }
        .em-section-title {
            font-size:12px; font-weight:700; color:#374151;
            text-transform:uppercase; letter-spacing:.5px;
            margin-bottom:8px; padding-top:10px;
            border-top:1px solid #e5e7eb;
        }
        .em-cp-bar { display:flex; gap:6px; margin-bottom:8px; }
        .em-input {
            flex:1; border:1px solid #d1d5db; border-radius:6px;
            padding:6px 10px; font-size:13px; outline:none;
            transition:border-color .2s;
        }
        .em-input:focus { border-color:#4f46e5; }
        .em-cp-list {
            display:flex; flex-direction:column; gap:6px;
            max-height:220px; overflow-y:auto;
        }
        .em-cp-item {
            display:flex; justify-content:space-between; align-items:center;
            padding:8px 10px; background:#f9fafb;
            border:1px solid #e5e7eb; border-radius:8px;
        }
        .em-cp-name { font-weight:600; font-size:13px; color:#111827; }
        .em-cp-meta { font-size:11px; color:#9ca3af; margin-top:2px; }
        .em-cp-actions { display:flex; gap:4px; flex-shrink:0; }
        .em-btn {
            border:none; border-radius:6px; cursor:pointer;
            font-size:13px; padding:6px 12px; transition:all .2s; font-weight:500;
        }
        .em-btn:disabled { opacity:.4; cursor:not-allowed; }
        .em-btn-primary { background:#4f46e5; color:#fff; }
        .em-btn-primary:hover:not(:disabled) { background:#4338ca; }
        .em-btn-sm { padding:4px 10px; font-size:12px; }
        .em-btn-xs { padding:3px 7px; font-size:11px; background:#e5e7eb; color:#374151; }
        .em-btn-xs:hover:not(:disabled) { background:#d1d5db; }
        .em-btn-danger { background:#fee2e2!important; color:#b91c1c!important; }
        .em-btn-danger:hover:not(:disabled) { background:#fecaca!important; }
        .em-btn-restore { background:#d1fae5!important; color:#065f46!important; }
        .em-btn-restore:hover:not(:disabled) { background:#a7f3d0!important; }
        .em-empty { text-align:center; color:#9ca3af; font-size:12px; padding:10px 0; }
        .em-toast {
            position:fixed; bottom:70px; right:20px;
            background:#4f46e5; color:#fff;
            padding:10px 18px; border-radius:8px;
            font-size:13px; font-weight:500;
            box-shadow:0 4px 14px rgba(79,70,229,.4);
            opacity:0; transform:translateY(10px);
            transition:all .3s ease; z-index:9999; pointer-events:none;
        }
        .em-toast-show { opacity:1; transform:translateY(0); }
        `;
        document.head.appendChild(style);
    }

    // ─── ARRANQUE ───────────────────────────────────────────────

    function init() {
        injectStyles();

        // Resolver el expediente activo ANTES de instalar el proxy
        // para que la lectura de la lista sea siempre directa y fiable.
        resolveActiveExpediente();

        // Insertar el panel cuando el DOM esté listo
        const ready = () => {
            buildPanel();

            // Observar cambios en el contador de pasos para refrescar el panel
            const observer = new MutationObserver(() => refreshPanel());
            const stepCounter = document.getElementById('stepCount');
            if (stepCounter) {
                observer.observe(stepCounter, { childList: true, characterData: true, subtree: true });
            }
        };

        if (document.readyState === 'complete') {
            ready();
        } else {
            window.addEventListener('load', ready);
        }
    }

    init();

})();
