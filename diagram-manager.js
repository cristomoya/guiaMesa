// ============================================================
// diagram-manager.js  v2
// Permite asociar un fichero .puml a cada expediente y
// reconstruir el flowDefinition dinámicamente al cambiar.
// Incluir DESPUÉS de sidebar.js y sidebar-patch.js (si se usa).
// ============================================================

(function () {
    'use strict';

    // ── Claves de almacenamiento ─────────────────────────────
    const DIAG_KEY     = (id) => `dm_diag_${id}`;
    const REGISTRY_KEY = 'dm_registry';

    // ── Capturar diagrama embebido ANTES de que nada lo mute ─
    const BUILT_IN_SOURCE = (() => {
        const el = document.getElementById('plantumlSource');
        return el ? el.textContent.trim() : '';
    })();

    const BUILT_IN_META = {
        id: '__builtin__',
        nombre: 'Procedimiento abierto (predeterminado)',
        descripcion: 'Diagrama incluido con la extensión.',
        icono: '📋',
        fuente: 'builtin',
        fechaCarga: null
    };

    // ── Rendimiento / anti-bloqueo ───────────────────────────
    const FLOW_CACHE_LIMIT = 8;
    const MAX_PUML_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB
    const flowCache = new Map(); // key: source, value: parsed flowDefinition
    let lastAppliedSource = null;
    let applyToken = 0;
    let expChangeObserver = null;
    let expChangeTimer = null;

    // ── Catálogo ─────────────────────────────────────────────

    function getRegistry() {
        try { return JSON.parse(localStorage.getItem(REGISTRY_KEY) || '[]'); }
        catch { return []; }
    }
    function saveRegistry(list) {
        localStorage.setItem(REGISTRY_KEY, JSON.stringify(list));
    }
    function addToRegistry(meta, source) {
        const reg = getRegistry().filter(r => r.id !== meta.id);
        reg.unshift({ ...meta, source });
        saveRegistry(reg.slice(0, 20));
    }
    function removeFromRegistry(id) {
        saveRegistry(getRegistry().filter(r => r.id !== id));
    }

    // ── Diagrama por expediente ──────────────────────────────

    function getActiveDiagram(expId) {
        try { return JSON.parse(localStorage.getItem(DIAG_KEY(expId)) || 'null'); }
        catch { return null; }
    }
    function setActiveDiagram(expId, meta, source) {
        localStorage.setItem(DIAG_KEY(expId), JSON.stringify({ meta, source }));
    }
    function clearActiveDiagram(expId) {
        localStorage.removeItem(DIAG_KEY(expId));
    }

    // ── Aplicar diagrama ─────────────────────────────────────

    function getCachedFlowDefinition(source) {
        if (flowCache.has(source)) {
            return flowCache.get(source);
        }
        if (typeof buildFlowDefinition !== 'function') return null;
        const parsed = buildFlowDefinition(source);
        flowCache.set(source, parsed);
        if (flowCache.size > FLOW_CACHE_LIMIT) {
            const oldestKey = flowCache.keys().next().value;
            flowCache.delete(oldestKey);
        }
        return parsed;
    }

    function applyDiagram(source, options = {}) {
        const force = Boolean(options.force);
        const normalized = String(source || '');
        if (!normalized) return;
        if (!force && normalized === lastAppliedSource) return;

        const token = ++applyToken;
        const run = () => {
            if (token !== applyToken) return;

        // Actualizar <script id="plantumlSource"> en memoria
        const el = document.getElementById('plantumlSource');
            if (el) el.textContent = normalized;

        // Reconstruir flowDefinition (array declarado con const en sidebar.js IIFE)
        // sidebar.js expone buildFlowDefinition en window; flowDefinition NO es global,
        // pero el array está referenciado en window.flowDefinition si sidebar-patch lo expone,
        // o podemos acceder a él indirectamente disparando los eventos que sidebar.js escucha.
        //
        // Estrategia robusta: disparar un CustomEvent que sidebar.js pueda escuchar,
        // y como fallback reasignar directamente si flowDefinition es global.
            try {
                let applied = false;
                if (window.SidebarFlowAPI && typeof window.SidebarFlowAPI.replaceFlowDefinition === 'function') {
                    applied = window.SidebarFlowAPI.replaceFlowDefinition(normalized, { resetState: false });
                } else {
                    const newDef = getCachedFlowDefinition(normalized);
                    if (Array.isArray(newDef) && Array.isArray(window.flowDefinition)) {
                        window.flowDefinition.length = 0;
                        newDef.forEach(s => window.flowDefinition.push(s));
                        if (typeof renderFlow === 'function') renderFlow();
                        if (typeof focusCurrentStepCard === 'function') {
                            requestAnimationFrame(() => focusCurrentStepCard(false));
                        }
                        applied = true;
                    }
                }
                if (!applied) {
                    console.warn('[diagram-manager] no se pudo aplicar el diagrama');
                    return;
                }
                lastAppliedSource = normalized;
            } catch (e) {
                console.warn('[diagram-manager] applyDiagram:', e);
            }
        };

        // Cede el hilo para evitar congelar UI en cambios encadenados.
        setTimeout(run, 0);
    }

    function loadDiagramForExpediente(expId) {
        const saved = getActiveDiagram(expId);
        applyDiagram(saved && saved.source ? saved.source : BUILT_IN_SOURCE);
    }

    // ── Utilidades ───────────────────────────────────────────

    function uid() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    }

    function parsePumlMeta(source) {
        const meta = { nombre: '', descripcion: '', icono: '📄' };
        source.split('\n').slice(0, 15).forEach(line => {
            const m = line.match(/^\/\/\s*(nombre|descripcion|icono)\s*:\s*(.+)$/i);
            if (!m) return;
            const k = m[1].toLowerCase();
            if (k === 'nombre')      meta.nombre      = m[2].trim();
            if (k === 'descripcion') meta.descripcion = m[2].trim();
            if (k === 'icono')       meta.icono       = m[2].trim();
        });
        return meta;
    }

    function getActiveExpId() {
        return (typeof ExpedienteManager !== 'undefined')
            ? (ExpedienteManager.getActiveId() || 'default')
            : 'default';
    }

    function showDmToast(msg) {
        let t = document.getElementById('dmToast');
        if (!t) {
            t = document.createElement('div');
            t.id = 'dmToast';
            t.className = 'dm-toast';
            document.body.appendChild(t);
        }
        t.textContent = msg;
        t.classList.add('dm-toast-show');
        clearTimeout(t._timer);
        t._timer = setTimeout(() => t.classList.remove('dm-toast-show'), 3000);
    }

    // ─────────────────────────────────────────────────────────
    // PANEL — inserción robusta en el DOM
    // ─────────────────────────────────────────────────────────

    function insertPanel(panel) {
        // Intentar insertar ANTES del flowchart, que siempre existe
        const flowchart = document.getElementById('flowchart');
        if (flowchart && flowchart.parentNode) {
            flowchart.parentNode.insertBefore(panel, flowchart);
            return;
        }
        // Fallback: al inicio de .content
        const content = document.querySelector('.content');
        if (content) {
            content.insertAdjacentElement('afterbegin', panel);
            return;
        }
        // Último recurso
        document.body.appendChild(panel);
    }

    function buildPanel() {
        if (document.getElementById('dmPanel')) {
            refreshPanel();
            return;
        }

        const panel = document.createElement('div');
        panel.id = 'dmPanel';
        panel.className = 'dm-panel';
        const header = document.createElement('div');
        header.className = 'dm-header';
        header.id = 'dmHeaderToggle';
        const title = document.createElement('span');
        title.textContent = 'Diagrama de flujo';
        const headerRight = document.createElement('div');
        headerRight.className = 'dm-header-right';
        const activeName = document.createElement('span');
        activeName.className = 'dm-active-name';
        activeName.id = 'dmActiveName';
        const toggleIcon = document.createElement('span');
        toggleIcon.className = 'dm-toggle-icon';
        toggleIcon.id = 'dmToggleIcon';
        toggleIcon.textContent = '▾';
        headerRight.appendChild(activeName);
        headerRight.appendChild(toggleIcon);
        header.appendChild(title);
        header.appendChild(headerRight);

        const body = document.createElement('div');
        body.className = 'dm-body';
        body.id = 'dmBody';
        body.style.display = 'none';
        const currentCard = document.createElement('div');
        currentCard.className = 'dm-current';
        currentCard.id = 'dmCurrentCard';
        body.appendChild(currentCard);

        const sectionCatalog = document.createElement('div');
        sectionCatalog.className = 'dm-section-title';
        sectionCatalog.textContent = 'Diagramas disponibles';
        body.appendChild(sectionCatalog);
        const catalog = document.createElement('div');
        catalog.id = 'dmCatalog';
        catalog.className = 'dm-catalog';
        body.appendChild(catalog);

        const sectionLoad = document.createElement('div');
        sectionLoad.className = 'dm-section-title';
        sectionLoad.textContent = 'Cargar fichero .puml';
        body.appendChild(sectionLoad);
        const uploadArea = document.createElement('div');
        uploadArea.className = 'dm-upload-area';
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.id = 'dmFileInput';
        fileInput.accept = '.puml,.txt';
        fileInput.style.display = 'none';
        const fileLabel = document.createElement('label');
        fileLabel.htmlFor = 'dmFileInput';
        fileLabel.className = 'dm-btn dm-btn-primary';
        fileLabel.textContent = 'Seleccionar fichero .puml';
        const hint = document.createElement('span');
        hint.className = 'dm-hint';
        hint.appendChild(document.createTextNode('Cabecera opcional en el fichero:'));
        hint.appendChild(document.createElement('br'));
        const h1 = document.createElement('code');
        h1.textContent = '// nombre: Mi proceso';
        hint.appendChild(h1);
        hint.appendChild(document.createElement('br'));
        const h2 = document.createElement('code');
        h2.textContent = '// descripcion: Breve descripcion';
        hint.appendChild(h2);
        hint.appendChild(document.createElement('br'));
        const h3 = document.createElement('code');
        h3.textContent = '// icono: *';
        hint.appendChild(h3);
        uploadArea.appendChild(fileInput);
        uploadArea.appendChild(fileLabel);
        uploadArea.appendChild(hint);
        body.appendChild(uploadArea);

        const resetWrap = document.createElement('div');
        resetWrap.style.marginTop = '10px';
        const resetBtn = document.createElement('button');
        resetBtn.className = 'dm-btn dm-btn-secondary';
        resetBtn.id = 'dmBtnReset';
        resetBtn.textContent = 'Usar diagrama predeterminado';
        resetWrap.appendChild(resetBtn);
        body.appendChild(resetWrap);

        panel.appendChild(header);
        panel.appendChild(body);

        insertPanel(panel);

        // ── Listeners ────────────────────────────────────────

        // Toggle abre/cierra — el click en el header completo,
        // excepto cuando se pulsa un botón/label interno
        header.addEventListener('click', (e) => {
            if (e.target.closest('button, label, input, a')) return;
            const body = document.getElementById('dmBody');
            const icon = document.getElementById('dmToggleIcon');
            const isOpen = body.style.display !== 'none';
            body.style.display = isOpen ? 'none' : 'block';
            icon.textContent   = isOpen ? '▾' : '▴';
        });

        // Cargar fichero .puml
        fileInput.addEventListener('change', handleFileLoad);

        // Botón reset
        resetBtn.addEventListener('click', () => {
            if (!confirm('¿Restaurar el diagrama predeterminado?\nEl progreso actual se conserva.')) return;
            const expId = getActiveExpId();
            clearActiveDiagram(expId);
            applyDiagram(BUILT_IN_SOURCE);
            refreshPanel();
            showDmToast('↩ Diagrama predeterminado restaurado');
        });

        refreshPanel();
    }

    // ── Refresh ──────────────────────────────────────────────

    function refreshPanel() {
        renderCurrentCard();
        renderCatalog();
        updateHeaderName();
    }

    function updateHeaderName() {
        const lbl = document.getElementById('dmActiveName');
        if (!lbl) return;
        const saved = getActiveDiagram(getActiveExpId());
        lbl.textContent = saved ? saved.meta.nombre : BUILT_IN_META.nombre;
    }

    function renderCurrentCard() {
        const card = document.getElementById('dmCurrentCard');
        if (!card) return;
        card.replaceChildren();

        const saved   = getActiveDiagram(getActiveExpId());
        const meta    = saved ? saved.meta : BUILT_IN_META;
        const builtin = !saved || meta.fuente === 'builtin';
        const steps   = (typeof flowDefinition !== 'undefined') ? flowDefinition.length : '—';
        const fecha   = meta.fechaCarga
            ? new Date(meta.fechaCarga).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })
            : 'Incluido con la extensión';

        const row = document.createElement('div');
        row.className = 'dm-cur-row';
        const icon = document.createElement('span');
        icon.className = 'dm-cur-icon';
        icon.textContent = meta.icono || '*';
        const info = document.createElement('div');
        info.className = 'dm-cur-info';
        const name = document.createElement('div');
        name.className = 'dm-cur-name';
        name.textContent = meta.nombre || '';
        info.appendChild(name);
        if (meta.descripcion) {
            const desc = document.createElement('div');
            desc.className = 'dm-cur-desc';
            desc.textContent = meta.descripcion;
            info.appendChild(desc);
        }
        const metaRow = document.createElement('div');
        metaRow.className = 'dm-cur-meta';
        if (!builtin && meta.fuente) {
            const fileSpan = document.createElement('span');
            fileSpan.textContent = meta.fuente;
            metaRow.appendChild(fileSpan);
        }
        const stepsSpan = document.createElement('span');
        stepsSpan.textContent = `${steps} pasos`;
        metaRow.appendChild(stepsSpan);
        const dateSpan = document.createElement('span');
        dateSpan.textContent = fecha;
        metaRow.appendChild(dateSpan);
        info.appendChild(metaRow);
        const badge = document.createElement('span');
        badge.className = `dm-cur-badge ${builtin ? 'dm-badge-builtin' : 'dm-badge-custom'}`;
        badge.textContent = builtin ? 'Predeterminado' : 'Personalizado';
        row.appendChild(icon);
        row.appendChild(info);
        row.appendChild(badge);
        card.appendChild(row);
    }

    function renderCatalog() {
        const container = document.getElementById('dmCatalog');
        if (!container) return;
        container.replaceChildren();

        const expId    = getActiveExpId();
        const saved    = getActiveDiagram(expId);
        const activeId = saved ? saved.meta.id : '__builtin__';
        const reg      = getRegistry();
        const all      = [BUILT_IN_META, ...reg];

        all.forEach(entry => {
            const isActive  = entry.id === activeId;
            const isBuiltin = entry.id === '__builtin__';

            const item = document.createElement('div');
            item.className = 'dm-cat-item' + (isActive ? ' dm-cat-active' : '');
            const main = document.createElement('div');
            main.className = 'dm-cat-main';
            const icon = document.createElement('span');
            icon.className = 'dm-cat-icon';
            icon.textContent = entry.icono || '*';
            const info = document.createElement('div');
            info.className = 'dm-cat-info';
            const name = document.createElement('div');
            name.className = 'dm-cat-name';
            name.textContent = entry.nombre || '';
            info.appendChild(name);
            if (entry.descripcion) {
                const desc = document.createElement('div');
                desc.className = 'dm-cat-desc';
                desc.textContent = entry.descripcion;
                info.appendChild(desc);
            }
            if (entry.fuente && !isBuiltin) {
                const file = document.createElement('div');
                file.className = 'dm-cat-file';
                file.textContent = entry.fuente;
                info.appendChild(file);
            }
            main.appendChild(icon);
            main.appendChild(info);
            if (isActive) {
                const active = document.createElement('span');
                active.className = 'dm-cat-check';
                active.textContent = 'Activo';
                main.appendChild(active);
            }
            const actions = document.createElement('div');
            actions.className = 'dm-cat-actions';
            let btnApply = null;
            let btnDel = null;
            if (!isActive) {
                btnApply = document.createElement('button');
                btnApply.className = 'dm-btn dm-btn-xs dm-btn-apply';
                btnApply.dataset.id = entry.id;
                btnApply.textContent = 'Usar';
                actions.appendChild(btnApply);
            }
            if (!isBuiltin) {
                btnDel = document.createElement('button');
                btnDel.className = 'dm-btn dm-btn-xs dm-btn-danger';
                btnDel.dataset.del = entry.id;
                btnDel.textContent = 'Eliminar';
                actions.appendChild(btnDel);
            }
            item.appendChild(main);
            item.appendChild(actions);

            // Usar
            if (btnApply) {
                btnApply.addEventListener('click', () => {
                    if (isBuiltin) {
                        clearActiveDiagram(expId);
                        applyDiagram(BUILT_IN_SOURCE);
                    } else {
                        const found = reg.find(r => r.id === entry.id);
                        if (found) {
                            setActiveDiagram(expId, { ...found, source: undefined }, found.source);
                            applyDiagram(found.source);
                        }
                    }
                    refreshPanel();
                    showDmToast(`✅ Diagrama "${entry.nombre}" aplicado`);
                });
            }

            // Eliminar del catálogo
            if (btnDel) {
                btnDel.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (!confirm(`¿Eliminar "${entry.nombre}" del catálogo?`)) return;
                    removeFromRegistry(entry.id);
                    if (isActive) {
                        clearActiveDiagram(expId);
                        applyDiagram(BUILT_IN_SOURCE);
                    }
                    refreshPanel();
                });
            }

            container.appendChild(item);
        });

        if (reg.length === 0) {
            const hint = document.createElement('p');
            hint.className = 'dm-empty-hint';
            hint.textContent = 'Carga un fichero .puml para añadirlo al catálogo.';
            container.appendChild(hint);
        }
    }

    // ── Cargar fichero ────────────────────────────────────────

    function handleFileLoad(e) {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > MAX_PUML_SIZE_BYTES) {
            showDmToast('⚠️ Fichero demasiado grande (>2 MB).');
            e.target.value = '';
            return;
        }
        const reader = new FileReader();
        reader.onload = (ev) => {
            const source = (ev.target.result || '').trim();
            if (!source) { showDmToast('⚠️ El fichero está vacío'); return; }
            if (!source.includes('@startuml')) {
                showDmToast('⚠️ Fichero inválido: falta @startuml'); return;
            }

            const parsed = parsePumlMeta(source);
            const meta = {
                id: uid(),
                nombre:      parsed.nombre      || file.name.replace(/\.(puml|txt)$/i, ''),
                descripcion: parsed.descripcion || '',
                icono:       parsed.icono       || '📄',
                fuente:      file.name,
                fechaCarga:  Date.now()
            };

            addToRegistry(meta, source);
            const expId = getActiveExpId();
            setActiveDiagram(expId, meta, source);
            applyDiagram(source, { force: true });
            refreshPanel();
            showDmToast(`✅ Diagrama "${meta.nombre}" cargado`);
            e.target.value = '';
        };
        reader.readAsText(file);
    }

    // ── Hook cambio de expediente ─────────────────────────────

    function hookExpedienteChange() {
        // sidebar-patch.js actualiza #emActiveLabel al cambiar de expediente
        const waitForLabel = () => {
            const target = document.getElementById('emActiveLabel');
            if (!target) return; // no hay multi-expediente, no hace falta

            if (expChangeObserver) return;
            expChangeObserver = new MutationObserver(() => {
                clearTimeout(expChangeTimer);
                expChangeTimer = setTimeout(() => {
                    const expId = getActiveExpId();
                    loadDiagramForExpediente(expId);
                    refreshPanel();
                }, 120);
            });
            expChangeObserver.observe(target, { childList: true, characterData: true, subtree: true });
        };
        // Intentar inmediatamente y con pequeño delay por si el panel tarda
        waitForLabel();
        setTimeout(waitForLabel, 500);
    }

    // ── Estilos ───────────────────────────────────────────────

    function injectStyles() {
        if (document.getElementById('dmStyles')) return;
        const s = document.createElement('style');
        s.id = 'dmStyles';
        s.textContent = `
        .dm-panel {
            background:#fff; border-radius:12px;
            box-shadow:0 2px 10px rgba(0,0,0,.09);
            margin-bottom:14px; border-left:4px solid #7c3aed;
            overflow:hidden; font-size:13px;
        }
        .dm-header {
            display:flex; justify-content:space-between; align-items:center;
            padding:10px 14px;
            background:linear-gradient(135deg,#7c3aed 0%,#6d28d9 100%);
            color:#fff; cursor:pointer; user-select:none;
            font-weight:700; font-size:14px;
        }
        .dm-header-right { display:flex; align-items:center; gap:8px; }
        .dm-active-name {
            font-size:12px; opacity:.85; max-width:160px;
            overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
        }
        .dm-toggle-icon { font-size:16px; }
        .dm-body { padding:12px 14px; }
        .dm-current {
            background:#f5f3ff; border:1px solid #ddd6fe;
            border-radius:8px; padding:10px 12px; margin-bottom:12px;
        }
        .dm-cur-row { display:flex; gap:10px; align-items:flex-start; }
        .dm-cur-icon { font-size:26px; flex-shrink:0; }
        .dm-cur-info { flex:1; min-width:0; }
        .dm-cur-name { font-weight:700; color:#1e1b4b; font-size:14px; }
        .dm-cur-desc { font-size:12px; color:#6b7280; margin-top:2px; }
        .dm-cur-meta {
            display:flex; gap:10px; flex-wrap:wrap;
            font-size:11px; color:#9ca3af; margin-top:5px;
        }
        .dm-cur-badge {
            padding:2px 8px; border-radius:10px; font-size:11px;
            font-weight:700; white-space:nowrap; flex-shrink:0;
        }
        .dm-badge-custom  { background:#ede9fe; color:#6d28d9; }
        .dm-badge-builtin { background:#e0e7ff; color:#3730a3; }
        .dm-catalog {
            display:flex; flex-direction:column; gap:6px;
            margin-bottom:12px; max-height:260px; overflow-y:auto;
        }
        .dm-cat-item {
            display:flex; justify-content:space-between; align-items:center;
            padding:8px 10px; border:1px solid #e5e7eb; border-radius:8px;
            background:#fafafa; gap:8px; transition:border-color .2s;
        }
        .dm-cat-item:hover { border-color:#7c3aed; }
        .dm-cat-active { border-color:#7c3aed; background:#f5f3ff; }
        .dm-cat-main { display:flex; gap:8px; align-items:center; flex:1; min-width:0; }
        .dm-cat-icon { font-size:20px; flex-shrink:0; }
        .dm-cat-info { min-width:0; }
        .dm-cat-name {
            font-weight:600; color:#111827; font-size:13px;
            white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
        }
        .dm-cat-desc { font-size:11px; color:#6b7280; }
        .dm-cat-file { font-size:10px; color:#9ca3af; }
        .dm-cat-check { font-size:11px; font-weight:700; color:#7c3aed; white-space:nowrap; }
        .dm-cat-actions { display:flex; gap:4px; flex-shrink:0; }
        .dm-section-title {
            font-size:11px; font-weight:700; text-transform:uppercase;
            letter-spacing:.5px; color:#374151; margin:10px 0 6px;
        }
        .dm-upload-area {
            display:flex; flex-direction:column; gap:6px;
            padding:10px; background:#f9fafb;
            border:1px dashed #d1d5db; border-radius:8px;
        }
        .dm-hint { font-size:11px; color:#6b7280; line-height:1.7; }
        .dm-hint code {
            background:#e5e7eb; padding:1px 5px; border-radius:4px;
            font-family:monospace; font-size:11px;
        }
        .dm-empty-hint {
            text-align:center; font-size:12px; color:#9ca3af; padding:8px 0; margin:0;
        }
        .dm-btn {
            border:none; border-radius:6px; cursor:pointer;
            padding:6px 12px; font-size:13px; font-weight:600;
            transition:all .2s; display:inline-block; text-align:center;
        }
        .dm-btn:disabled { opacity:.4; cursor:not-allowed; }
        .dm-btn-primary   { background:#7c3aed; color:#fff; }
        .dm-btn-primary:hover:not(:disabled) { background:#6d28d9; }
        .dm-btn-secondary { background:#e5e7eb; color:#374151; }
        .dm-btn-secondary:hover:not(:disabled) { background:#d1d5db; }
        .dm-btn-xs { padding:3px 8px; font-size:11px; background:#e5e7eb; color:#374151; }
        .dm-btn-xs:hover:not(:disabled) { background:#d1d5db; }
        .dm-btn-apply  { background:#d1fae5!important; color:#065f46!important; }
        .dm-btn-apply:hover:not(:disabled) { background:#a7f3d0!important; }
        .dm-btn-danger { background:#fee2e2!important; color:#b91c1c!important; }
        .dm-btn-danger:hover:not(:disabled) { background:#fecaca!important; }
        .dm-toast {
            position:fixed; bottom:110px; right:20px;
            background:#7c3aed; color:#fff;
            padding:10px 18px; border-radius:8px; font-size:13px; font-weight:500;
            box-shadow:0 4px 14px rgba(124,58,237,.4);
            opacity:0; transform:translateY(10px); transition:all .3s;
            z-index:9999; pointer-events:none;
        }
        .dm-toast-show { opacity:1; transform:translateY(0); }
        `;
        document.head.appendChild(s);
    }

    // ── Arranque ──────────────────────────────────────────────

    function init() {
        injectStyles();

        // Capturar diagrama del expediente activo antes de renderizar
        const expId = getActiveExpId();
        const saved = getActiveDiagram(expId);
        if (saved && saved.source) {
            applyDiagram(saved.source);
        }

        // Insertar panel en cuanto el DOM esté disponible
        function mountWhenReady() {
            // flowchart debe existir (lo crea sidebar.js al inicializar)
            const flowchart = document.getElementById('flowchart');
            if (flowchart) {
                buildPanel();
                hookExpedienteChange();
            } else {
                // Reintentar cada 100 ms hasta que exista
                setTimeout(mountWhenReady, 100);
            }
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', mountWhenReady);
        } else {
            mountWhenReady();
        }
    }

    // ── API pública ───────────────────────────────────────────
    window.DiagramManager = { loadDiagramForExpediente, applyDiagram, getActiveDiagram, refreshPanel };

    init();

})();
