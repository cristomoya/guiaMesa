// ============================================================
// GESTIÓN DE MÚLTIPLES EXPEDIENTES Y PUNTOS DE CONTROL
// expediente-manager.js — incluir antes de sidebar.js
// ============================================================

const ExpedienteManager = (() => {

    const STORAGE_KEYS = {
        LIST:    'em_expedientes_list',     // array de { id, nombre, ref, xmlBinding, creadoEn, actualizadoEn }
        ACTIVE:  'em_expediente_activo',    // id del expediente activo
        STATE:   (id) => `em_state_${id}`,  // estado de flujo para un expediente
        DATA:    (id) => `em_data_${id}`,   // datos XML de un expediente
        CHECKS:  (id) => `em_checks_${id}`  // puntos de control de un expediente
    };

    // ── Utilidades ──────────────────────────────────────────

    function uid() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    }

    function now() { return Date.now(); }

    function readJSON(key, fallback = null) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : fallback;
        } catch { return fallback; }
    }

    function writeJSON(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    }

    function collectRecoveredExpedientes(list) {
        const recovered = new Map(
            Array.isArray(list)
                ? list.filter(entry => entry && entry.id).map(entry => [String(entry.id), entry])
                : []
        );
        const idPatterns = [
            /^em_state_(.+)$/,
            /^em_data_(.+)$/,
            /^em_checks_(.+)$/,
            /^dm_diag_(.+)$/
        ];
        const activeId = getActiveId();
        if (activeId && !recovered.has(activeId)) {
            recovered.set(activeId, null);
        }

        for (let i = 0; i < localStorage.length; i += 1) {
            const key = localStorage.key(i);
            if (!key) continue;
            const match = idPatterns.map((pattern) => key.match(pattern)).find(Boolean);
            if (!match || !match[1]) continue;
            const id = String(match[1]).trim();
            if (!id || recovered.has(id)) continue;
            recovered.set(id, null);
        }

        return Array.from(recovered.entries()).map(([id, entry], index) => {
            if (entry && typeof entry === 'object') return entry;
            const xmlData = readJSON(STORAGE_KEYS.DATA(id), null);
            const recoveredName = String((xmlData && (xmlData.nombreProyecto || xmlData.expediente)) || '').trim();
            const recoveredRef = String((xmlData && xmlData.expediente) || '').trim();
            const updatedAt = Number((xmlData && xmlData.__xmlLoadedAt) || 0) || now();
            return {
                id,
                nombre: recoveredName ? (xmlData.nombreProyecto || `Expediente ${recoveredRef}`) : `Expediente recuperado ${index + 1}`,
                ref: recoveredRef,
                creadoEn: updatedAt,
                actualizadoEn: updatedAt
            };
        });
    }

    // ── Lista de expedientes ─────────────────────────────────

    function getList() {
        const stored = readJSON(STORAGE_KEYS.LIST, []);
        const list = collectRecoveredExpedientes(Array.isArray(stored) ? stored : []);
        let changed = false;

        const normalized = list.map(entry => {
            if (entry && entry.xmlBinding) return entry;
            const xmlData = readJSON(STORAGE_KEYS.DATA(entry.id), null);
            if (!xmlData) return entry;
            changed = true;
            return {
                ...entry,
                xmlBinding: {
                    fileName: String(xmlData.__xmlFileName || '').trim(),
                    contractFolderId: String(xmlData.expediente || '').trim(),
                    loadedAt: Number(xmlData.__xmlLoadedAt) || now()
                }
            };
        });

        if (!Array.isArray(stored) || stored.length !== normalized.length) {
            changed = true;
        } else if (stored.some((entry, index) => !entry || entry.id !== normalized[index].id)) {
            changed = true;
        }
        if (changed) saveList(normalized);
        return normalized;
    }

    function saveList(list) {
        writeJSON(STORAGE_KEYS.LIST, list);
    }

    function getActiveId() {
        return localStorage.getItem(STORAGE_KEYS.ACTIVE) || null;
    }

    function setActiveId(id) {
        const normalizedId = id == null ? '' : String(id).trim();
        if (normalizedId) {
            localStorage.setItem(STORAGE_KEYS.ACTIVE, normalizedId);
        } else {
            localStorage.removeItem(STORAGE_KEYS.ACTIVE);
        }
        try {
            window.dispatchEvent(new CustomEvent('em:active-expediente-changed', {
                detail: { id: normalizedId || null }
            }));
        } catch (_) {}
    }

    // ── CRUD expedientes ─────────────────────────────────────

    function createExpediente(nombre, ref = '') {
        const id = uid();
        const entry = { id, nombre: nombre.trim() || 'Sin nombre', ref: ref.trim(), creadoEn: now(), actualizadoEn: now() };
        const list = getList();
        list.unshift(entry);
        saveList(list);
        return id;
    }

    function renameExpediente(id, newNombre) {
        const list = getList().map(e =>
            e.id === id ? { ...e, nombre: newNombre.trim() || e.nombre, actualizadoEn: now() } : e
        );
        saveList(list);
    }

    function deleteExpediente(id) {
        const list = getList().filter(e => e.id !== id);
        saveList(list);
        localStorage.removeItem(STORAGE_KEYS.STATE(id));
        localStorage.removeItem(STORAGE_KEYS.DATA(id));
        localStorage.removeItem(STORAGE_KEYS.CHECKS(id));
        if (getActiveId() === id) {
            const next = list[0];
            setActiveId(next ? next.id : null);
        }
    }

    function touchExpediente(id) {
        const list = getList().map(e =>
            e.id === id ? { ...e, actualizadoEn: now() } : e
        );
        saveList(list);
    }

    function setExpedienteXMLBinding(id, xmlBinding) {
        const normalized = xmlBinding && typeof xmlBinding === 'object' ? {
            fileName: String(xmlBinding.fileName || '').trim(),
            contractFolderId: String(xmlBinding.contractFolderId || '').trim(),
            loadedAt: Number(xmlBinding.loadedAt) || now()
        } : null;

        const list = getList().map(e => {
            if (e.id !== id) return e;
            return {
                ...e,
                xmlBinding: normalized,
                actualizadoEn: now()
            };
        });
        saveList(list);
    }

    function clearExpedienteXMLBinding(id) {
        const list = getList().map(e => {
            if (e.id !== id) return e;
            const clone = { ...e, actualizadoEn: now() };
            delete clone.xmlBinding;
            return clone;
        });
        saveList(list);
    }

    function applyXMLIdentityToExpediente(id, data) {
        const expedienteNum = String((data && data.expediente) || '').trim();
        const nombreProyecto = String((data && data.nombreProyecto) || '').trim();
        if (!expedienteNum && !nombreProyecto) return;

        const list = getList().map(e => {
            if (e.id !== id) return e;
            const next = { ...e, actualizadoEn: now() };

            if (nombreProyecto) {
                next.nombre = nombreProyecto;
            } else if (expedienteNum) {
                next.nombre = `Expediente ${expedienteNum}`;
            }

            if (expedienteNum) {
                next.ref = expedienteNum;
            }
            return next;
        });
        saveList(list);
    }

    // ── Estado de flujo por expediente ───────────────────────

    function loadFlowState(id) {
        return readJSON(STORAGE_KEYS.STATE(id), null);
    }

    function saveFlowState(id, stateObj) {
        writeJSON(STORAGE_KEYS.STATE(id), stateObj);
        touchExpediente(id);
    }

    function loadXMLData(id) {
        return readJSON(STORAGE_KEYS.DATA(id), null);
    }

    function saveXMLData(id, data) {
        writeJSON(STORAGE_KEYS.DATA(id), data);
        setExpedienteXMLBinding(id, {
            fileName: data && data.__xmlFileName ? data.__xmlFileName : '',
            contractFolderId: data && data.expediente ? data.expediente : '',
            loadedAt: data && data.__xmlLoadedAt ? data.__xmlLoadedAt : now()
        });
        applyXMLIdentityToExpediente(id, data);
        touchExpediente(id);
    }

    function clearXMLData(id) {
        localStorage.removeItem(STORAGE_KEYS.DATA(id));
        clearExpedienteXMLBinding(id);
        touchExpediente(id);
    }

    // ── Puntos de control ────────────────────────────────────

    function getCheckpoints(id) {
        return readJSON(STORAGE_KEYS.CHECKS(id), []);
    }

    function saveCheckpoint(id, label, fluidState, xmlData) {
        const checks = getCheckpoints(id);
        const cp = {
            cpId: uid(),
            label: label.trim() || `Punto ${checks.length + 1}`,
            savedAt: now(),
            step: fluidState.currentStep,
            fluidState: JSON.parse(JSON.stringify(fluidState)),
            xmlData: xmlData ? JSON.parse(JSON.stringify(xmlData)) : null
        };
        checks.unshift(cp);
        writeJSON(STORAGE_KEYS.CHECKS(id), checks);
        touchExpediente(id);
        return cp;
    }

    function deleteCheckpoint(expedienteId, cpId) {
        const checks = getCheckpoints(expedienteId).filter(c => c.cpId !== cpId);
        writeJSON(STORAGE_KEYS.CHECKS(expedienteId), checks);
    }

    // ── Porcentaje de progreso ───────────────────────────────

    function calcProgress(flowStateObj, totalSteps) {
        if (!flowStateObj || !totalSteps) return 0;
        const done = (flowStateObj.completedSteps || []).length;
        return Math.min(100, Math.round((done / totalSteps) * 100));
    }

    // ── API pública ──────────────────────────────────────────

    return {
        getList,
        getActiveId,
        setActiveId,
        createExpediente,
        renameExpediente,
        deleteExpediente,
        loadFlowState,
        saveFlowState,
        loadXMLData,
        saveXMLData,
        clearXMLData,
        setExpedienteXMLBinding,
        clearExpedienteXMLBinding,
        applyXMLIdentityToExpediente,
        getCheckpoints,
        saveCheckpoint,
        deleteCheckpoint,
        calcProgress,
        touchExpediente
    };
})();
