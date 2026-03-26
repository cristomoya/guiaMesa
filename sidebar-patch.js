// Cambios aplicados: panel inline de expedientes simplificado, modal completo para gestionar expedientes y puntos de control, botón flotante de guardado rápido y sincronización con paneles colapsables.
// ============================================================
// PATCH ?" gestión multi-expediente y puntos de control
// sidebar-patch.js  ?" incluir DESPU?S de sidebar.js
// ============================================================
// Sobrescribe las funciones de persistencia de sidebar.js y
// añade el panel de gestión de expedientes en el DOM.
// ============================================================

(function () {
    'use strict';

    // "?"? IDs de almacenamiento legado (migración automática) "?"?
    const LEGACY_FLOW_KEY   = 'flujo_licitacion_mejorado_v1';
    const LEGACY_DATA_KEY   = 'expediente_data';

    // "?"? Referencia al expediente activo en esta sesión "?"?"?"?"?"?"?
    let _activeId = null;

    // "?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?
    // INICIALIZACI"N: resolver expediente activo
    // "?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?

    function resolveActiveExpediente() {
        let id = ExpedienteManager.getActiveId();

        // Migración automática de datos legacy ?' primer expediente
        const legacyFlow = localStorage.getItem(LEGACY_FLOW_KEY);
        const legacyData = localStorage.getItem(LEGACY_DATA_KEY);

        if (!id) {
            const list = ExpedienteManager.getList();
            if (list.length === 0) {
                // Crear expediente por defecto, migrando datos legacy si existen
                id = ExpedienteManager.createExpediente('Expediente principal');
                if (legacyFlow) {
                    try {
                        ExpedienteManager.saveFlowState(id, JSON.parse(legacyFlow));
                    } catch (e) { /* ignorar */ }
                }
                if (legacyData) {
                    try {
                        ExpedienteManager.saveXMLData(id, JSON.parse(legacyData));
                    } catch (e) { /* ignorar */ }
                }
            } else {
                id = list[0].id;
            }
            ExpedienteManager.setActiveId(id);
        }

        _activeId = id;

        // Limpiar claves legacy reales sin pasar por el interceptor de expediente.
        _origRemoveItem.call(localStorage, LEGACY_FLOW_KEY);
        _origRemoveItem.call(localStorage, LEGACY_DATA_KEY);
    }

    // "?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?
    // SOBRESCRITURA DE FUNCIONES DE PERSISTENCIA DE sidebar.js
    // "?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?

    // Inyectar en el scope global donde sidebar.js las declara
    // Las funciones originales están en el scope del IIFE de sidebar.js,
    // pero acceden a variables del cierre. Aquí redefinimos los métodos
    // que sidebar.js expone implícitamente vía DOM/events y los
    // interceptamos redirigiendo la lectura/escritura.

    const _origSave = window._sidebarSaveData;   // puede ser undefined si no está expuesta

    // Redefinir usando MutationObserver para esperar a que sidebar.js
    // termine de inicializar sus variables internas.
    // Estrategia: parchear después de que el script original se ejecute
    // sobreescribiendo las llamadas a localStorage que sidebar.js hace.

    // "?"? Proxy localStorage "?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?
    // Intercepta getItem/setItem para redirigir las claves de sidebar.js
    // al expediente activo.

    const REMAP = {
        [LEGACY_FLOW_KEY]: () => ExpedienteManager.loadFlowState(_activeId),
        [LEGACY_DATA_KEY]: () => ExpedienteManager.loadXMLData(_activeId)
    };

    const _origGetItem = Storage.prototype.getItem;
    const _origSetItem = Storage.prototype.setItem;
    const _origRemoveItem = Storage.prototype.removeItem;

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
            try { ExpedienteManager.saveFlowState(_activeId, JSON.parse(value)); } catch (e) { /* ignorar */ }
            return;
        }
        if (key === LEGACY_DATA_KEY && _activeId) {
            try { ExpedienteManager.saveXMLData(_activeId, JSON.parse(value)); } catch (e) { /* ignorar */ }
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

    // "?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?
    // HELPERS DE ESTADO (acceden a variables de sidebar.js vía
    // la función de captura que añadimos al init)
    // "?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?

    function captureCurrentFlowState() {
        // Lee el estado actual de sidebar.js accediendo al localStorage
        // (que ya está interceptado y devuelve el estado del expediente activo)
        const raw = ExpedienteManager.loadFlowState(_activeId);
        return raw || {};
    }

    // "?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?
    // PANEL DE GESTI"N ?" insertar en el DOM
    // "?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?

    function buildPanel() {
        if (document.getElementById('emPanel')) return;

        const panel = document.createElement('section');
        panel.id = 'emPanel';
        panel.className = 'em-panel collapsible-panel panel-collapsed';
        panel.setAttribute('data-panel-key', 'expedientes');

        const header = document.createElement('div');
        header.className = 'em-header panel-header';

        const toggle = document.createElement('button');
        toggle.className = 'panel-toggle';
        toggle.type = 'button';
        toggle.setAttribute('data-panel-target', 'expedientes');
        toggle.setAttribute('aria-expanded', 'false');

        const toggleLabel = document.createElement('span');
        toggleLabel.textContent = '📁 Expedientes';
        const toggleIcon = document.createElement('span');
        toggleIcon.className = 'panel-toggle-icon';
        toggleIcon.textContent = '▾';
        toggle.appendChild(toggleLabel);
        toggle.appendChild(toggleIcon);

        header.appendChild(toggle);

        const body = document.createElement('div');
        body.className = 'em-body panel-body';
        body.id = 'emBody';

        const summary = document.createElement('div');
        summary.className = 'em-summary';
        summary.id = 'emSummary';

        const summaryName = document.createElement('div');
        summaryName.className = 'em-summary-name';
        summaryName.id = 'emActiveLabel';

        const summaryMeta = document.createElement('div');
        summaryMeta.className = 'em-summary-meta';
        summaryMeta.id = 'emSummaryMeta';

        const progressBar = document.createElement('div');
        progressBar.className = 'em-progress-bar em-progress-bar-inline';
        const progressFill = document.createElement('div');
        progressFill.className = 'em-progress-fill';
        progressFill.id = 'emActiveProgressFill';
        progressBar.appendChild(progressFill);

        const openModalBtn = document.createElement('button');
        openModalBtn.className = 'em-btn em-btn-primary';
        openModalBtn.id = 'emBtnOpenModal';
        openModalBtn.type = 'button';
        openModalBtn.textContent = 'Cambiar expediente';

        summary.appendChild(summaryName);
        summary.appendChild(summaryMeta);
        summary.appendChild(progressBar);
        summary.appendChild(openModalBtn);
        body.appendChild(summary);

        panel.appendChild(header);
        panel.appendChild(body);

        const modal = document.createElement('div');
        modal.id = 'emModal';
        modal.className = 'modal';
        const modalContent = document.createElement('div');
        modalContent.className = 'modal-content em-modal-content';
        const modalHeader = document.createElement('div');
        modalHeader.className = 'modal-header';
        const modalTitle = document.createElement('h2');
        modalTitle.textContent = 'Expedientes';
        const modalClose = document.createElement('button');
        modalClose.className = 'close-btn';
        modalClose.id = 'emBtnCloseModal';
        modalClose.type = 'button';
        modalClose.textContent = '×';
        modalHeader.appendChild(modalTitle);
        modalHeader.appendChild(modalClose);

        const modalTools = document.createElement('div');
        modalTools.className = 'em-modal-tools';
        const btnNuevo = document.createElement('button');
        btnNuevo.className = 'em-btn em-btn-primary';
        btnNuevo.id = 'emBtnNuevo';
        btnNuevo.type = 'button';
        btnNuevo.textContent = '+ Nuevo expediente';
        modalTools.appendChild(btnNuevo);

        const list = document.createElement('div');
        list.id = 'emList';
        list.className = 'em-list';

        const sectionTitle = document.createElement('div');
        sectionTitle.className = 'em-section-title';
        sectionTitle.textContent = 'Puntos de control';

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
        btnGuardarCp.type = 'button';
        btnGuardarCp.textContent = 'Guardar';
        cpBar.appendChild(cpInput);
        cpBar.appendChild(btnGuardarCp);

        const cpList = document.createElement('div');
        cpList.id = 'emCpList';
        cpList.className = 'em-cp-list';

        modalContent.appendChild(modalHeader);
        modalContent.appendChild(modalTools);
        modalContent.appendChild(list);
        modalContent.appendChild(sectionTitle);
        modalContent.appendChild(cpBar);
        modalContent.appendChild(cpList);
        modal.appendChild(modalContent);

        const quickBtn = document.getElementById('btnQuickCheckpoint');

        const content = document.querySelector('.content') || document.body;
        content.insertAdjacentElement('afterbegin', panel);
        document.body.appendChild(modal);

        toggle.addEventListener('click', () => {
            if (window.SidebarFlowAPI && typeof window.SidebarFlowAPI.togglePanelState === 'function') {
                window.SidebarFlowAPI.togglePanelState('expedientes');
            }
        });
        openModalBtn.addEventListener('click', openExpedientesModal);
        btnNuevo.addEventListener('click', crearNuevoExpediente);
        btnGuardarCp.addEventListener('click', guardarPuntoControl);
        modalClose.addEventListener('click', closeExpedientesModal);
        modal.addEventListener('click', (e) => {
            if (e.target.id === 'emModal') closeExpedientesModal();
        });
        if (quickBtn) quickBtn.addEventListener('click', guardarPuntoControlRapido);

        refreshPanel();
    }

    function openExpedientesModal() {
        const modal = document.getElementById('emModal');
        if (modal) modal.classList.add('active');
    }

    function closeExpedientesModal() {
        const modal = document.getElementById('emModal');
        if (modal) modal.classList.remove('active');
    }

    function refreshPanel() {
        renderExpedienteList();
        renderCheckpointList();
        updateActiveLabel();
        updateQuickCheckpointButton();
        if (window.SidebarFlowAPI && typeof window.SidebarFlowAPI.refreshUiPanels === 'function') {
            window.SidebarFlowAPI.refreshUiPanels();
        }
    }

    function updateActiveLabel() {
        const lbl = document.getElementById('emActiveLabel');
        if (!lbl) return;
        const list = ExpedienteManager.getList();
        const active = list.find(e => e.id === _activeId);
        lbl.textContent = active ? active.nombre : '';
        const summaryMeta = document.getElementById('emSummaryMeta');
        const progressFill = document.getElementById('emActiveProgressFill');
        if (summaryMeta) {
            const flowState = active ? ExpedienteManager.loadFlowState(active.id) : null;
            const total = (typeof flowDefinition !== 'undefined') ? flowDefinition.length : 0;
            const pct = ExpedienteManager.calcProgress(flowState, total);
            const checks = active ? ExpedienteManager.getCheckpoints(active.id).length : 0;
            summaryMeta.textContent = active ? `${pct}% completado · ${checks} puntos de control` : 'Sin expediente activo';
            if (progressFill) progressFill.style.width = `${pct}%`;
        }
    }

    function updateQuickCheckpointButton() {
        const quickBtn = document.getElementById('btnQuickCheckpoint');
        if (!quickBtn) return;
        quickBtn.hidden = !_activeId;
    }

    // "?"? Lista de expedientes "?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?

    function renderExpedienteList() {
        const container = document.getElementById('emList');
        if (!container) return;
        container.replaceChildren();
        const list = ExpedienteManager.getList();
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
                xmlBadge.textContent = `XML ${xmlLabel}`;
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
            itemMain.addEventListener('click', () => activarExpediente(exp.id));
            renameBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const nuevo = prompt('Nuevo nombre:', exp.nombre);
                if (nuevo) {
                    ExpedienteManager.renameExpediente(exp.id, nuevo);
                    refreshPanel();
                }
            });
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm(`Eliminar el expediente "${exp.nombre}" y todos sus datos? Esta accion no se puede deshacer.`)) {
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

    // "?"? Puntos de control "?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?

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
            cpMeta.textContent = `${fecha} - Paso ${cp.step + 1} - ${pct}%`;
            cpInfo.appendChild(cpName);
            cpInfo.appendChild(cpMeta);
            const cpActions = document.createElement('div');
            cpActions.className = 'em-cp-actions';
            const restoreBtn = document.createElement('button');
            restoreBtn.className = 'em-btn em-btn-xs em-btn-restore';
            restoreBtn.dataset.cp = cp.cpId;
            restoreBtn.title = 'Restaurar este punto';
            restoreBtn.textContent = 'Restaurar';
            const delBtn = document.createElement('button');
            delBtn.className = 'em-btn em-btn-xs em-btn-danger';
            delBtn.dataset.cp = cp.cpId;
            delBtn.dataset.action = 'del';
            delBtn.title = 'Eliminar punto';
            delBtn.textContent = 'Eliminar';
            cpActions.appendChild(restoreBtn);
            cpActions.appendChild(delBtn);
            item.appendChild(cpInfo);
            item.appendChild(cpActions);
            restoreBtn.addEventListener('click', () => restaurarPuntoControl(cp.cpId));
            delBtn.addEventListener('click', () => {
                if (confirm(`Eliminar el punto de control "${cp.label}"?`)) {
                    ExpedienteManager.deleteCheckpoint(_activeId, cp.cpId);
                    renderCheckpointList();
                }
            });
            container.appendChild(item);
        });
    }
    // "?"? Acciones "?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?

    function crearNuevoExpediente() {
        const nombre = prompt('Nombre del nuevo expediente:');
        if (!nombre || !nombre.trim()) return;
        const ref = prompt('Referencia/número de expediente (opcional):') || '';
        const id = ExpedienteManager.createExpediente(nombre, ref);

        // Inicializar el nuevo expediente siempre en estado limpio.
        ExpedienteManager.saveFlowState(id, {
            currentStep: 0,
            completedSteps: [],
            decisions: {},
            stepNotes: {},
            stepTimestamps: {},
            stepStartTimes: {}
        });
        ExpedienteManager.clearXMLData(id);
        if (window.DiagramManager && typeof window.DiagramManager.getCatalogEntries === 'function' && typeof window.DiagramManager.setDiagramForExpediente === 'function') {
            const catalog = window.DiagramManager.getCatalogEntries();
            if (Array.isArray(catalog) && catalog.length > 0) {
                const options = catalog.map((entry, index) => `${index}. ${entry.nombre}`).join('\n');
                const selected = prompt(
                    `Selecciona el diagrama para el nuevo expediente:\n${options}\n\nDeja vacio o usa 0 para el predeterminado.`,
                    '0'
                );
                const index = Number.parseInt(String(selected || '0').trim(), 10);
                const chosen = Number.isInteger(index) && catalog[index] ? catalog[index] : catalog[0];
                window.DiagramManager.setDiagramForExpediente(id, chosen.id, { apply: false });
            }
        }

        activarExpediente(id);
    }

    function activarExpediente(id) {
        if (id === _activeId) return;
        if (typeof saveData === 'function') saveData();
        if (typeof saveExpedienteData === 'function') saveExpedienteData();
        _activeId = id;
        ExpedienteManager.setActiveId(id);
        recargarEstadoActivo();
        refreshPanel();
        closeExpedientesModal();
        showEmToast('Expediente cargado');
    }

    function recargarEstadoActivo() {
        // Forzar recarga del estado de sidebar.js usando sus propias funciones
        if (typeof loadData === 'function') loadData();
        if (typeof loadExpedienteData === 'function') loadExpedienteData();
        if (typeof renderFlow === 'function') renderFlow();
        if (typeof focusCurrentStepCard === 'function') focusCurrentStepCard(false);
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

    function guardarPuntoControlRapido() {
        if (!_activeId) return;
        const finalLabel = new Date().toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'medium' });
        const flowState = ExpedienteManager.loadFlowState(_activeId) || {};
        const xmlData = ExpedienteManager.loadXMLData(_activeId);
        const cp = ExpedienteManager.saveCheckpoint(_activeId, finalLabel, flowState, xmlData);
        refreshPanel();
        showEmToast(`Punto guardado: ${cp.label}`);
    }

    function restaurarPuntoControl(cpId) {
        const checks = ExpedienteManager.getCheckpoints(_activeId);
        const cp = checks.find(c => c.cpId === cpId);
        if (!cp) return;
        if (!confirm(`¿Restaurar al punto de control "${cp.label}"? El progreso actual se perderá.`)) return;

        // Guardar estado restaurado
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

    // "?"? Toast propio para no pisar el de sidebar.js "?"?"?"?"?"?"?"?"?"?

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
        setTimeout(() => t.classList.remove('em-toast-show'), 3000);
    }

    // "?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?
    // ESTILOS INLINE (se inyectan dinámicamente)
    // "?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?

    function injectStyles() {
        if (document.getElementById('emStyles')) return;
        const style = document.createElement('style');
        style.id = 'emStyles';
        style.textContent = `
        /* "?"? Panel contenedor "?"? */
        .em-panel {
            background: #ffffff;
            border-radius: 12px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            margin-bottom: 16px;
            border-left: 4px solid #4f46e5;
            overflow: hidden;
            font-size: 14px;
        }

        /* "?"? Cabecera "?"? */
        .em-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 10px 14px;
            background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
            color: white;
            cursor: pointer;
            user-select: none;
            font-weight: 600;
            font-size: 14px;
        }
        .em-header-actions {
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .em-active-label {
            font-size: 12px;
            opacity: 0.85;
            max-width: 140px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .em-toggle-icon {
            font-size: 16px;
            line-height: 1;
        }

        /* "?"? Cuerpo "?"? */
        .em-body {
            display: none;
            padding: 12px;
        }

        /* "?"? Lista de expedientes "?"? */
        .em-list {
            display: flex;
            flex-direction: column;
            gap: 6px;
            margin-bottom: 14px;
        }
        .em-item {
            display: flex;
            align-items: stretch;
            gap: 6px;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            overflow: hidden;
            transition: border-color 0.2s;
        }
        .em-item:hover { border-color: #4f46e5; }
        .em-item-active {
            border-color: #4f46e5;
            background: #f5f3ff;
        }
        .em-item-main {
            flex: 1;
            padding: 8px 10px;
            cursor: pointer;
            min-width: 0;
        }
        .em-item-name {
            font-weight: 600;
            color: #111827;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            font-size: 13px;
        }
        .em-item-meta {
            display: flex;
            gap: 8px;
            align-items: center;
            margin-top: 3px;
            font-size: 11px;
            color: #6b7280;
        }
        .em-ref {
            background: #ede9fe;
            color: #5b21b6;
            padding: 1px 6px;
            border-radius: 10px;
        }
        .em-pct {
            font-weight: 600;
            color: #4f46e5;
        }
        .em-cp-badge {
            color: #d97706;
        }
        .em-xml-badge {
            max-width: 160px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            background: #dcfce7;
            color: #166534;
            padding: 1px 6px;
            border-radius: 10px;
            font-weight: 600;
        }
        .em-xml-missing {
            background: #fee2e2;
            color: #991b1b;
            padding: 1px 6px;
            border-radius: 10px;
            font-weight: 600;
        }
        .em-progress-bar {
            margin-top: 5px;
            height: 4px;
            background: #e5e7eb;
            border-radius: 2px;
            overflow: hidden;
        }
        .em-progress-fill {
            height: 100%;
            background: linear-gradient(90deg, #4f46e5, #7c3aed);
            border-radius: 2px;
            transition: width 0.4s ease;
        }
        .em-item-actions {
            display: flex;
            flex-direction: column;
            justify-content: center;
            gap: 4px;
            padding: 6px 8px;
            background: #f9fafb;
            border-left: 1px solid #e5e7eb;
        }

        /* "?"? Sección puntos de control "?"? */
        .em-section-title {
            font-size: 12px;
            font-weight: 700;
            color: #374151;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 8px;
            padding-top: 10px;
            border-top: 1px solid #e5e7eb;
        }
        .em-cp-bar {
            display: flex;
            gap: 6px;
            margin-bottom: 8px;
        }
        .em-input {
            flex: 1;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            padding: 6px 10px;
            font-size: 13px;
            outline: none;
            transition: border-color 0.2s;
        }
        .em-input:focus { border-color: #4f46e5; }
        .em-cp-list {
            display: flex;
            flex-direction: column;
            gap: 6px;
            max-height: 220px;
            overflow-y: auto;
        }
        .em-cp-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 10px;
            background: #f9fafb;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
        }
        .em-cp-name {
            font-weight: 600;
            font-size: 13px;
            color: #111827;
        }
        .em-cp-meta {
            font-size: 11px;
            color: #9ca3af;
            margin-top: 2px;
        }
        .em-cp-actions {
            display: flex;
            gap: 4px;
            flex-shrink: 0;
        }

        /* "?"? Botones "?"? */
        .em-btn {
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 13px;
            padding: 6px 12px;
            transition: all 0.2s;
            font-weight: 500;
        }
        .em-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .em-btn-primary { background: #4f46e5; color: white; }
        .em-btn-primary:hover:not(:disabled) { background: #4338ca; }
        .em-btn-sm { padding: 4px 10px; font-size: 12px; }
        .em-btn-xs { padding: 3px 7px; font-size: 11px; background: #e5e7eb; color: #374151; }
        .em-btn-xs:hover:not(:disabled) { background: #d1d5db; }
        .em-btn-danger { background: #fee2e2 !important; color: #b91c1c !important; }
        .em-btn-danger:hover:not(:disabled) { background: #fecaca !important; }
        .em-btn-restore { background: #d1fae5 !important; color: #065f46 !important; }
        .em-btn-restore:hover:not(:disabled) { background: #a7f3d0 !important; }

        /* "?"? Empty state "?"? */
        .em-empty {
            text-align: center;
            color: #9ca3af;
            font-size: 12px;
            padding: 10px 0;
        }

        /* "?"? Toast "?"? */
        .em-toast {
            position: fixed;
            bottom: 70px;
            right: 20px;
            background: #4f46e5;
            color: white;
            padding: 10px 18px;
            border-radius: 8px;
            font-size: 13px;
            font-weight: 500;
            box-shadow: 0 4px 14px rgba(79,70,229,0.4);
            opacity: 0;
            transform: translateY(10px);
            transition: all 0.3s ease;
            z-index: 9999;
            pointer-events: none;
        }
        .em-toast-show {
            opacity: 1;
            transform: translateY(0);
        }
        .em-panel {
            border-left: 4px solid #0f766e;
        }
        .em-summary {
            display: grid;
            gap: 10px;
        }
        .em-summary-name {
            font-weight: 700;
            color: #0f172a;
            font-size: 14px;
        }
        .em-summary-meta {
            font-size: 12px;
            color: #64748b;
        }
        .em-progress-bar-inline {
            margin-top: 0;
            height: 6px;
            border-radius: 999px;
        }
        .em-modal-content {
            max-width: 620px;
            width: calc(100% - 24px);
            max-height: calc(100vh - 24px);
            overflow-y: auto;
        }
        .em-modal-tools {
            display: flex;
            justify-content: flex-end;
            margin-bottom: 12px;
        }
        .em-list {
            max-height: 280px;
            overflow-y: auto;
        }
        @media (max-width: 560px) {
            .em-cp-bar,
            .em-modal-tools {
                flex-direction: column;
            }
            .em-item {
                flex-direction: column;
            }
            .em-item-actions {
                flex-direction: row;
                justify-content: flex-end;
                border-left: none;
                border-top: 1px solid #e5e7eb;
            }
        }
        `;
        document.head.appendChild(style);
    }

    // "?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?
    // ARRANQUE
    // "?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?"?

    function init() {
        injectStyles();
        resolveActiveExpediente();
        window.addEventListener('em:active-expediente-changed', (event) => {
            const nextId = event && event.detail ? event.detail.id : null;
            if (!nextId || nextId === _activeId) return;
            _activeId = nextId;
            recargarEstadoActivo();
            refreshPanel();
        });
        // Esperar a que sidebar.js haya construido el DOM
        const ready = () => {
            buildPanel();
            // Actualizar panel al avanzar pasos (escucha cambios en el contador)
            const observer = new MutationObserver(() => refreshPanel());
            const stepCounter = document.getElementById('stepCount');
            if (stepCounter) observer.observe(stepCounter, { childList: true, characterData: true, subtree: true });
        };
        if (document.readyState === 'complete') { ready(); }
        else { window.addEventListener('load', ready); }
    }

    init();

})();



