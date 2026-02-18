const PLANTUML_SOURCE = document.getElementById('plantumlSource').textContent;
        const PLACSP_DOC_URL = encodeURI('guia.html');
        const PLACSP_ASSETS_DIR = 'images';
        const SHOW_PHASE_VISUALS = false;
        
        //... Definición de fases del proceso
        const PROCESS_PHASES = [
            { 
                name: 'Apertura y Calificación', 
                keywords: ['apertura', 'calificación administrativa', 'descifrar', 'firmas'],
                icon: '📁',
                startStep: 1
            },
            { 
                name: 'Subsanación', 
                keywords: ['subsanable', 'subsanación', 'subsanar'],
                icon: '📝',
                startStep: 27
            },
            { 
                name: 'Apertura Criterios', 
                keywords: ['apertura de criterios', 'sobres cifrados'],
                icon: '🔒',
                startStep: 64
            },
            { 
                name: 'Valoración', 
                keywords: ['valoración', 'criterios', 'puntuación'],
                icon: '⭐',
                startStep: 65
            
            },
            { 
                name: 'Requerimiento', 
                keywords: ['requerimiento', 'mejor valorado'],
                icon: '📋',
                startStep: 70
            },
            { 
                name: 'Propuesta Adjudicación', 
                keywords: ['propuesta', 'adjudicación', 'adjudicatario'],
                icon: '🎯',
                startStep: 71
            }
        ];
        
        const PLACSP_BOOKMARK_RULES = [
            { re: /apertura y calificaci[oó]n administrativa|calificaci[oó]n administrativa/, bookmark: 'bookmark37' },
            { re: /acto de subsanaci[oó]n de firma|subsanaci[oó]n de firma/, bookmark: 'bookmark120' },
            { re: /subsanar firma|firma subsanable/, bookmark: 'bookmark61' },
            { re: /Gestionar Ofertas Retiradas o a incluir/, bookmark: 'bookmark49' },
            { re: /valoraci[oó]n manual/, bookmark: 'bookmark78' },
            { re: /carga autom[aá]tica|incorporar valoraciones/, bookmark: 'bookmark79' },
            { re: /valoraci[oó]n|criterios|puntuaci[oó]n/, bookmark: 'bookmark71' },
            { re: /propuesta de adjudicaci[oó]n|proponer adjudicaci[oó]n|adjudicatario/, bookmark: 'bookmark80' },
            { re: /informe de propuesta/, bookmark: 'bookmark87' },
            { re: /mejor valorado.*requerimiento|requerimiento de documentaci[oó]n/, bookmark: 'bookmark90' },
            { re: /apertura de requerimiento/, bookmark: 'bookmark96' },
            { re: /solicitud de aclaraci[oó]n|otras comunicaciones|aclaraci[oó]n/, bookmark: 'bookmark133' },
            { re: /justificaci[oó]n.*oferta anormalmente baja/, bookmark: 'bookmark141' }
        ];

        const flowDefinition = buildFlowDefinition(PLANTUML_SOURCE);

        function normalizeStepText(text) {
            return String(text || '')
                .replace(/\s+/g, ' ')
                .replace(/\s*;\s*$/, '')
                .trim();
        }

        function normalizeForMatch(text) {
            return String(text || '')
                .toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/\s+/g, ' ')
                .trim();
        }

        function normalizeDecisionValue(value) {
            const v = normalizeForMatch(value);
            if (v === 'si') return 'SI';
            if (v === 'no') return 'NO';
            return String(value || '');
        }

        function parseStepPayload(rawText) {
            const full = String(rawText || '').trim();
            const imageMatch = full.match(/\bimg:(\S+)/i);
            const bookmarkMatch = full.match(/\b(?:bm|bookmark):([#A-Za-z0-9_-]+)/i);
            let imageUrl = imageMatch ? imageMatch[1] : null;
            let bookmark = bookmarkMatch ? bookmarkMatch[1] : null;
            if (imageUrl && !/^https?:\/\//i.test(imageUrl) && !imageUrl.startsWith('/')) {
                imageUrl = `${PLACSP_ASSETS_DIR}/${imageUrl}`;
            }
            if (bookmark && bookmark.startsWith('#')) {
                bookmark = bookmark.slice(1);
            }
            const text = normalizeStepText(
                full
                    .replace(/\bimg:\S+/ig, '')
                    .replace(/\b(?:bm|bookmark):[#A-Za-z0-9_-]+/ig, '')
                    .trim()
            );
            return { text, imageUrl, bookmark };
        }

        function parsePhaseCue(text) {
            const match = normalizeStepText(text).match(/^fase\s*(\d+)\s*[:\-]?\s*(.*)$/i);
            if (!match) return null;
            return {
                number: Number(match[1]),
                title: normalizeStepText(match[2] || '')
            };
        }

        function getPlacspBookmarkForStep(step) {
            if (step && step.bookmark) return step.bookmark;
            const txt = normalizeForMatch(step && step.texto ? step.texto : '');
            if (!txt) return null;
            for (const rule of PLACSP_BOOKMARK_RULES) {
                if (rule.re.test(txt)) return rule.bookmark;
            }
            return null;
        }

        function openPlacspBookmark(bookmark) {
            const url = bookmark ? `${PLACSP_DOC_URL}#${bookmark}` : PLACSP_DOC_URL;
            window.open(url, '_blank', 'noopener,noreferrer');
        }

        function getActorColor(actor) {
            const colors = {
                'OA': '#667eea',
                'Sistema': '#28a745',
                'Licitador': '#fbbf24'
            };
            return colors[actor] || '#6c757d';
        }

        function buildFlowDefinition(source) {
            const steps = [];
            let id = 1;
            let currentActor = 'OA';
            const branchStack = [];
            const loopStack = [];
            const tokenRegex = /\|([^|\r\n]+)\||#([0-9A-Fa-f]{6,8})\s*:\s*([\s\S]*?);|:\s*([\s\S]*?);|if\s*\(([\s\S]*?)\)\s*(?:then|is)|\belse\b(?:\s*\(([\s\S]*?)\))?|\bendif\b|repeat\b|repeat while\s*\(([\s\S]*?)\)/gi;
            let match;

            function getActiveConditions() {
                return branchStack.map(item => ({ decision: item.decision, valor: item.valor }));
            }

            while ((match = tokenRegex.exec(source)) !== null) {
                const token = String(match[0] || '').trim().toLowerCase();

                // Cambio de actor
                if (match[1]) {
                    currentActor = normalizeStepText(match[1]);
                    continue;
                }

                // Acción con color
                if (match[3]) {
                    const payload = parseStepPayload(match[3]);
                    if (payload.text) {
                        const stepId = id++;
                        const phaseCue = parsePhaseCue(payload.text);
                        steps.push({
                            id: stepId,
                            tipo: 'accion',
                            texto: payload.text,
                            color: `#${match[2].slice(0, 6)}`,
                            actor: currentActor,
                            imageUrl: payload.imageUrl,
                            bookmark: payload.bookmark,
                            isPhaseCue: Boolean(phaseCue),
                            phaseNumber: phaseCue ? phaseCue.number : null,
                            phaseTitle: phaseCue ? phaseCue.title : null,
                            condiciones: getActiveConditions()
                        });
                        
                        // Marcar inicio de loop si estamos dentro de uno
                        if (loopStack.length > 0 && !loopStack[loopStack.length - 1].startId) {
                            loopStack[loopStack.length - 1].startId = stepId;
                        }
                    }
                    continue;
                }

                // Acción sin color
                if (match[4]) {
                    const payload = parseStepPayload(match[4]);
                    if (payload.text) {
                        const stepId = id++;
                        const phaseCue = parsePhaseCue(payload.text);
                        steps.push({
                            id: stepId,
                            tipo: 'accion',
                            texto: payload.text,
                            color: '#A7D3F2',
                            actor: currentActor,
                            imageUrl: payload.imageUrl,
                            bookmark: payload.bookmark,
                            isPhaseCue: Boolean(phaseCue),
                            phaseNumber: phaseCue ? phaseCue.number : null,
                            phaseTitle: phaseCue ? phaseCue.title : null,
                            condiciones: getActiveConditions()
                        });
                        
                        if (loopStack.length > 0 && !loopStack[loopStack.length - 1].startId) {
                            loopStack[loopStack.length - 1].startId = stepId;
                        }
                    }
                    continue;
                }

                // Decisión (if)
                if (match[5]) {
                    const text = normalizeStepText(match[5]);
                    if (text) {
                        const decisionId = id++;
                        steps.push({
                            id: decisionId,
                            tipo: 'decision',
                            texto: text,
                            opciones: ['Sí', 'No'],
                            actor: currentActor,
                            condiciones: getActiveConditions()
                        });
                        branchStack.push({ decision: decisionId, valor: 'SI' });
                    }
                    continue;
                }

                // Else
                if (token.startsWith('else')) {
                    if (branchStack.length > 0) {
                        branchStack[branchStack.length - 1].valor = 'NO';
                    }
                    continue;
                }

                // Endif
                if (token === 'endif') {
                    if (branchStack.length > 0) {
                        branchStack.pop();
                    }
                    continue;
                }

                // Repeat (inicio de bucle)
                if (token === 'repeat') {
                    loopStack.push({ startId: null });
                    continue;
                }

                // Repeat while (condición de bucle)
                if (match[7]) {
                    const text = normalizeStepText(match[7]);
                    if (text && loopStack.length > 0) {
                        const loopInfo = loopStack.pop();
                        const loopId = id++;
                        steps.push({
                            id: loopId,
                            tipo: 'loop',
                            texto: text,
                            opciones: ['Sí', 'No'],
                            actor: currentActor,
                            goto: loopInfo.startId, // Volver al inicio del loop
                            condiciones: getActiveConditions()
                        });
                    }
                    continue;
                }
            }

            steps.push({ 
                id: id++, 
                tipo: 'fin', 
                texto: '✅ Proceso Completado', 
                actor: 'Sistema',
                color: '#28a745'
            });
            
            return steps;
        }

        let currentStep = 0;
        let completedSteps = new Set();
        let decisions = {};
        let stepNotes = {};
        let currentNodeId = null;
        let autoAdvanceTimer = null;
        let stepTimestamps = {}; // Nuevo: almacenar cuándo se completó cada paso
        let stepStartTimes = {}; // Nuevo: almacenar cuándo se empezó cada paso
        let expedienteData = null; // Datos cargados del XML del expediente

        function loadData() {
            const saved = localStorage.getItem('flujo_licitacion_mejorado_v1');
            if (saved) {
                const data = JSON.parse(saved);
                currentStep = data.currentStep || 0;
                completedSteps = new Set(data.completedSteps || []);
                decisions = data.decisions || {};
                stepNotes = data.stepNotes || {};
                stepTimestamps = data.stepTimestamps || {};
                stepStartTimes = data.stepStartTimes || {};
                
                // Registrar inicio del paso actual si no existe
                const currentDef = flowDefinition[currentStep];
                if (currentDef && !stepStartTimes[currentDef.id]) {
                    stepStartTimes[currentDef.id] = Date.now();
                }
            }
        }

        function saveData() {
            const data = {
                currentStep,
                completedSteps: Array.from(completedSteps),
                decisions,
                stepNotes,
                stepTimestamps,
                stepStartTimes
            };
            localStorage.setItem('flujo_licitacion_mejorado_v1', JSON.stringify(data));
        }

        function shouldShowStep(step) {
            if (!step || !step.condiciones || step.condiciones.length === 0) return true;
            for (const cond of step.condiciones) {
                const decidedValue = decisions[cond.decision];
                if (decidedValue !== cond.valor) return false;
            }
            return true;
        }

        function getCurrentPhase() {
            for (let i = PROCESS_PHASES.length - 1; i >= 0; i--) {
                if (currentStep >= PROCESS_PHASES[i].startStep) {
                    return PROCESS_PHASES[i];
                }
            }
            return PROCESS_PHASES[0];
        }

        function updatePhaseProgress() {
            if (!SHOW_PHASE_VISUALS) return;
            const grid = document.getElementById('phasesGrid');
            if (!grid) return;
            grid.replaceChildren();
            
            PROCESS_PHASES.forEach(phase => {
                const item = document.createElement('div');
                item.className = 'phase-item';
                
                // Marcar como completada si el paso actual está más allá
                if (currentStep >= phase.startStep + 10) {
                    item.classList.add('completed');
                }
                
                const icon = document.createElement('span');
                icon.className = 'icon';
                icon.textContent = phase.icon;
                const label = document.createElement('span');
                label.textContent = phase.name;
                item.appendChild(icon);
                item.appendChild(label);
                
                grid.appendChild(item);
            });
        }

        function getVisibleActors() {
            const actors = [];
            const seen = new Set();
            flowDefinition.forEach((step) => {
                if (!shouldShowStep(step)) return;
                const actor = step.actor || 'OA';
                if (seen.has(actor)) return;
                seen.add(actor);
                actors.push(actor);
            });
            return actors;
        }

        function renderFlow() {
            const flowchart = document.getElementById('flowchart');
            flowchart.innerHTML = '';
            const compactSidebar = flowchart.clientWidth <= 900;

            const flowContainer = document.createElement('div');
            flowContainer.className = 'flow-container swimlanes-layout';

            const visibleSteps = [];
            flowDefinition.forEach((step, index) => {
                if (shouldShowStep(step)) visibleSteps.push({ step, index });
            });
            const actors = getVisibleActors();
            if (visibleSteps.length === 0 || actors.length === 0) {
                const empty = document.createElement('div');
                empty.className = 'phase-separator';
                empty.textContent = 'No hay actividades visibles con las decisiones actuales';
                flowContainer.appendChild(empty);
                flowchart.appendChild(flowContainer);
                updateStats();
                updatePhaseProgress();
                return;
            }

            if (!compactSidebar) {
                const laneHeaders = document.createElement('div');
                laneHeaders.className = 'swimlane-headers';
                laneHeaders.style.gridTemplateColumns = `repeat(${actors.length}, minmax(220px, 1fr))`;
                actors.forEach(actor => {
                    const header = document.createElement('div');
                    header.className = 'swimlane-header';
                    header.textContent = actor;
                    header.style.background = getActorColor(actor);
                    laneHeaders.appendChild(header);
                });
                flowContainer.appendChild(laneHeaders);
            }

            let lastPhaseIndex = -1;

            visibleSteps.forEach(({ step, index }, visibleIndex) => {

                // Insertar separador de fase
                const currentPhaseIndex = PROCESS_PHASES.findIndex(p => 
                    PROCESS_PHASES.indexOf(p) === PROCESS_PHASES.length - 1 || 
                    index < PROCESS_PHASES[PROCESS_PHASES.indexOf(p) + 1]?.startStep
                );
                
                if (SHOW_PHASE_VISUALS && currentPhaseIndex > lastPhaseIndex && currentPhaseIndex >= 0) {
                    const separator = document.createElement('div');
                    separator.className = 'phase-separator';
                    separator.textContent = `${PROCESS_PHASES[currentPhaseIndex].icon} FASE ${currentPhaseIndex + 1}: ${PROCESS_PHASES[currentPhaseIndex].name.toUpperCase()}`;
                    flowContainer.appendChild(separator);
                    lastPhaseIndex = currentPhaseIndex;
                }

                const row = document.createElement('div');
                row.className = 'swimlane-row';
                if (compactSidebar) {
                    row.style.gridTemplateColumns = '1fr';
                    const cell = document.createElement('div');
                    cell.className = 'swimlane-cell';
                    const node = createNode(step, index, { showActorBadge: true });
                    cell.appendChild(node);
                    row.appendChild(cell);
                } else {
                    row.style.gridTemplateColumns = `repeat(${actors.length}, minmax(220px, 1fr))`;
                    actors.forEach(actor => {
                        const cell = document.createElement('div');
                        cell.className = 'swimlane-cell';
                        if (actor === step.actor) {
                            const node = createNode(step, index, { showActorBadge: false });
                            cell.appendChild(node);
                        }
                        row.appendChild(cell);
                    });
                }
                flowContainer.appendChild(row);

                if (visibleIndex < visibleSteps.length - 1) {
                    const arrowRow = document.createElement('div');
                    arrowRow.className = 'swimlane-arrow-row';
                    const arrow = document.createElement('span');
                    arrow.className = 'swimlane-arrow';
                    arrow.textContent = step.tipo === 'loop' && step.goto ? '↑' : (step.isPhaseCue ? '⇣' : '↓');
                    if (index < currentStep) arrow.classList.add('completed');
                    if (step.tipo === 'loop' && step.goto) arrow.classList.add('loop-back');
                    if (step.isPhaseCue) arrow.classList.add('phase-jump-arrow');
                    arrowRow.appendChild(arrow);
                    flowContainer.appendChild(arrowRow);
                }
            });

            flowchart.appendChild(flowContainer);
            updateStats();
            updatePhaseProgress();
            // Actualizar timeline si está visible
            const timelineContent = document.getElementById('timelineContent');
            if (timelineContent && timelineContent.classList.contains('active')) {
                updateTimeline();
            }
        }

        function createNode(step, index, options = {}) {
            const node = document.createElement('div');
            node.className = 'node';
            node.setAttribute('data-actor', step.actor);
            node.setAttribute('data-step-index', String(index));
            node.tabIndex = -1;
            const bookmark = getPlacspBookmarkForStep(step);
            const showActorBadge = options.showActorBadge !== false;
            
            if (completedSteps.has(step.id)) node.classList.add('completed');
            if (index === currentStep) {
                node.classList.add('current');
                node.tabIndex = 0;
                // Añadir animación si es un paso del Sistema
                if (step.actor === 'Sistema' && step.tipo !== 'decision' && step.tipo !== 'loop') {
                    node.classList.add('auto-completing');
                }
            }
            if (index > currentStep) node.classList.add('pending');
            if (step.tipo === 'decision') node.classList.add('decision-node');
            if (step.tipo === 'loop') node.classList.add('loop-node');
            if (step.isPhaseCue) node.classList.add('phase-jump-node');

            // Hacer el nodo clickeable para marcar como completado
            if (index === currentStep && step.tipo !== 'decision' && step.tipo !== 'loop' && step.actor !== 'Sistema') {
                node.style.cursor = 'pointer';
                node.title = 'Click para marcar como completado y continuar';
                node.onclick = (e) => {
                    // Evitar conflicto con clicks en botones internos
                    if (e.target.tagName !== 'BUTTON' && e.target.tagName !== 'IMG') {
                        continuarFlujo();
                    }
                };
            }

            // Mostrar badge de actor si cambia
            const prevStep = index > 0 ? flowDefinition[index - 1] : null;
            if (showActorBadge && !step.isPhaseCue && (!prevStep || prevStep.actor !== step.actor)) {
                const actorBadge = document.createElement('div');
                actorBadge.className = 'actor-badge';
                actorBadge.textContent = step.actor;
                if (step.actor === 'Sistema' && index === currentStep) {
                    actorBadge.textContent = step.actor + ' ⚡';
                    actorBadge.title = 'Se completa automáticamente';
                }
                actorBadge.style.background = getActorColor(step.actor);
                node.appendChild(actorBadge);
            }

            const content = document.createElement('div');
            content.className = 'node-content';

            const checkbox = document.createElement('div');
            checkbox.className = 'node-checkbox';
            if (completedSteps.has(step.id)) checkbox.textContent = '✅';
            else if (index === currentStep) checkbox.textContent = '▶';
            content.appendChild(checkbox);

            const text = document.createElement('div');
            text.className = 'node-text';
            text.textContent = step.texto;
            if (step.color) text.style.color = step.color;
            content.appendChild(text);
            
            node.appendChild(content);

            if (step.isPhaseCue) {
                const jumpHint = document.createElement('div');
                jumpHint.className = 'phase-jump-hint';
                jumpHint.textContent = 'Salto de acto administrativo';
                node.appendChild(jumpHint);
            }
            
            // Añadir información contextual del expediente si está disponible
            if (expedienteData && index === currentStep) {
                const contextInfo = getStepContext(step);
                if (contextInfo) {
                    const contextDiv = document.createElement('div');
                    contextDiv.style.marginTop = '12px';
                    contextDiv.style.padding = '10px';
                    contextDiv.style.background = '#f0f4ff';
                    contextDiv.style.borderRadius = '6px';
                    contextDiv.style.fontSize = '13px';
                    contextDiv.style.color = '#495057';
                    contextDiv.style.borderLeft = '3px solid #667eea';
                    contextDiv.replaceChildren(sanitizeHtmlToFragment(contextInfo));
                    node.appendChild(contextDiv);
                }
            }

            // Imagen si existe
            if (step.imageUrl) {
                const media = document.createElement('div');
                media.className = 'node-media';
                const img = document.createElement('img');
                img.src = step.imageUrl;
                img.alt = 'Referencia visual del paso';
                img.loading = 'lazy';
                img.style.cursor = 'pointer';
                img.title = bookmark ? 'Abrir referencia en PLACSP' : 'Abrir guía en PLACSP';
                img.onclick = () => openPlacspBookmark(bookmark);
                media.appendChild(img);
                node.appendChild(media);
            }

            // Opciones de decisión o loop
            if ((step.tipo === 'decision' || step.tipo === 'loop') && index === currentStep && !decisions[step.id]) {
                const options = document.createElement('div');
                options.className = 'decision-options';
                
                step.opciones.forEach(opcion => {
                    const btn = document.createElement('button');
                    btn.className = 'btn-decision ' + (opcion === 'Sí' ? 'yes' : 'no');
                    btn.textContent = opcion;
                    btn.onclick = () => handleDecision(step.id, opcion);
                    options.appendChild(btn);
                });
                
                node.appendChild(options);
            }

            // Acciones (notas y enlaces)
            if (index <= currentStep && step.tipo !== 'loop') {
                const actions = document.createElement('div');
                actions.className = 'node-actions';
                
                const notesBtn = document.createElement('button');
                notesBtn.className = 'btn-notes';
                notesBtn.textContent = stepNotes[step.id] ? '📝 Ver notas' : '📝 Añadir nota';
                notesBtn.onclick = () => openNotes(step.id, step.texto);
                actions.appendChild(notesBtn);

                if (bookmark) {
                    const docBtn = document.createElement('button');
                    docBtn.className = 'btn-doc-link';
                    docBtn.textContent = '🔗 Ver en PLACSP';
                    docBtn.onclick = () => openPlacspBookmark(bookmark);
                    actions.appendChild(docBtn);
                }
                
                node.appendChild(actions);
            }

            return node;
        }

        function sanitizeHtmlToFragment(html) {
            const parser = new DOMParser();
            const doc = parser.parseFromString(String(html || ''), 'text/html');
            doc.querySelectorAll('script,style,iframe,object,embed,link,meta').forEach(el => el.remove());
            doc.querySelectorAll('*').forEach(el => {
                for (const attr of Array.from(el.attributes)) {
                    const name = attr.name.toLowerCase();
                    const value = String(attr.value || '').trim().toLowerCase();
                    if (name.startsWith('on')) {
                        el.removeAttribute(attr.name);
                        continue;
                    }
                    if ((name === 'href' || name === 'src') && value.startsWith('javascript:')) {
                        el.removeAttribute(attr.name);
                    }
                }
            });
            const frag = document.createDocumentFragment();
            while (doc.body.firstChild) frag.appendChild(doc.body.firstChild);
            return frag;
        }

        function focusCurrentStepCard(scrollToCard = true) {
            const flowchart = document.getElementById('flowchart');
            if (!flowchart) return;

            const currentNode = flowchart.querySelector(`.node[data-step-index="${currentStep}"]`) || flowchart.querySelector('.node.current');
            if (!currentNode) return;

            try {
                currentNode.focus({ preventScroll: true });
            } catch (e) {
                currentNode.focus();
            }

            if (scrollToCard) {
                // Evita el efecto de "subir y bajar": solo acerca la tarjeta si queda fuera de vista.
                currentNode.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'nearest' });
            }
        }

        function handleDecision(stepId, decision) {
            decisions[stepId] = normalizeDecisionValue(decision);
            continuarFlujo();
        }

        function continuarFlujo() {
            if (!Array.isArray(flowDefinition) || flowDefinition.length === 0) {
                showToast('⚠️ No se pudo cargar el esquema');
                return;
            }
            const currentDef = flowDefinition[currentStep];
            
            if ((currentDef.tipo === 'decision' || currentDef.tipo === 'loop') && !decisions[currentDef.id]) {
                showToast('⚠️ Selecciona una opción antes de continuar');
                return;
            }
            
            // Registrar timestamp de completado
            if (!stepTimestamps[currentDef.id]) {
                stepTimestamps[currentDef.id] = Date.now();
            }
            
            completedSteps.add(currentDef.id);
            
            // Manejar goto (loops)
            if (currentDef.goto && decisions[currentDef.id] === 'SI') {
                const gotoIndex = flowDefinition.findIndex(s => s.id === currentDef.goto);
                if (gotoIndex !== -1) {
                    if (gotoIndex <= currentStep) {
                        resetLoopSegmentState(gotoIndex, currentStep);
                    }
                    currentStep = gotoIndex;
                    
                    // Registrar inicio del nuevo paso
                    const newDef = flowDefinition[currentStep];
                    if (newDef && !stepStartTimes[newDef.id]) {
                        stepStartTimes[newDef.id] = Date.now();
                    }
                    
                    saveData();
                    renderFlow();
                    requestAnimationFrame(() => focusCurrentStepCard(true));
                    autoAdvanceSystemSteps();
                    return;
                }
            }
            
            let nextStep = currentStep + 1;
            while (nextStep < flowDefinition.length && !shouldShowStep(flowDefinition[nextStep])) {
                nextStep++;
            }
            
            if (nextStep >= flowDefinition.length) {
                showToast('🎉 ¡Proceso completado exitosamente!');
                return;
            }
            
            currentStep = nextStep;
            
            // Registrar inicio del siguiente paso
            const nextDef = flowDefinition[currentStep];
            if (nextDef && !stepStartTimes[nextDef.id]) {
                stepStartTimes[nextDef.id] = Date.now();
            }
            
            saveData();
            renderFlow();
            requestAnimationFrame(() => focusCurrentStepCard(true));
            
            // Auto-avanzar si el siguiente paso es del Sistema
            autoAdvanceSystemSteps();
        }

        function autoAdvanceSystemSteps() {
            // Auto-completar pasos del Sistema
            if (currentStep < flowDefinition.length) {
                const currentDef = flowDefinition[currentStep];
                
                // Si el paso actual es del Sistema, auto-completarlo después de un breve delay
                if (currentDef.actor === 'Sistema' && currentDef.tipo !== 'decision' && currentDef.tipo !== 'loop') {
                    if (autoAdvanceTimer) {
                        clearTimeout(autoAdvanceTimer);
                    }
                    
                    autoAdvanceTimer = setTimeout(() => {
                        // Registrar timestamp de completado
                        if (!stepTimestamps[currentDef.id]) {
                            stepTimestamps[currentDef.id] = Date.now();
                        }
                        
                        completedSteps.add(currentDef.id);
                        
                        let nextStep = currentStep + 1;
                        while (nextStep < flowDefinition.length && !shouldShowStep(flowDefinition[nextStep])) {
                            nextStep++;
                        }
                        
                        if (nextStep < flowDefinition.length) {
                            currentStep = nextStep;
                            
                            // Registrar inicio del siguiente paso
                            const nextDef = flowDefinition[currentStep];
                            if (nextDef && !stepStartTimes[nextDef.id]) {
                                stepStartTimes[nextDef.id] = Date.now();
                            }
                            
                            saveData();
                            renderFlow();
                            requestAnimationFrame(() => focusCurrentStepCard(true));
                            // Recursivamente auto-avanzar si el siguiente también es del Sistema
                            autoAdvanceSystemSteps();
                        } else {
                            saveData();
                showToast('🎉 ¡Proceso completado exitosamente!');
                        }
                    }, 800); // Delay de 800ms para que el usuario vea el paso del Sistema
                }
            }
        }

        function retrocederFlujo() {
            if (!Array.isArray(flowDefinition) || flowDefinition.length === 0) {
                showToast('⚠️ No se pudo cargar el esquema');
                return;
            }

            if (autoAdvanceTimer) {
                clearTimeout(autoAdvanceTimer);
                autoAdvanceTimer = null;
            }

            let prevStep = currentStep - 1;
            while (prevStep >= 0 && !shouldShowStep(flowDefinition[prevStep])) {
                prevStep--;
            }

            if (prevStep < 0) {
                showToast('ℹ Ya estás en el primer paso');
                return;
            }

            const prevDef = flowDefinition[prevStep];
            completedSteps.delete(prevDef.id);
            if (prevDef.tipo === 'decision' || prevDef.tipo === 'loop') {
                delete decisions[prevDef.id];
            }

            currentStep = prevStep;
            saveData();
            renderFlow();
            requestAnimationFrame(() => focusCurrentStepCard(true));
        }

        function resetLoopSegmentState(startIndex, endIndex) {
            for (let i = startIndex; i <= endIndex; i++) {
                const step = flowDefinition[i];
                completedSteps.delete(step.id);
                if (step.tipo === 'decision' || step.tipo === 'loop') {
                    delete decisions[step.id];
                }
            }
        }

        function reiniciarFlujo() {
            if (confirm('¿Estás seguro de reiniciar todo el proceso? Se perderá el progreso actual.')) {
                if (autoAdvanceTimer) {
                    clearTimeout(autoAdvanceTimer);
                    autoAdvanceTimer = null;
                }
                currentStep = 0;
                completedSteps.clear();
                decisions = {};
                stepNotes = {};
                stepTimestamps = {};
                stepStartTimes = {};
                
                // Registrar inicio del primer paso
                const firstDef = flowDefinition[0];
                if (firstDef) {
                    stepStartTimes[firstDef.id] = Date.now();
                }
                
                saveData();
                renderFlow();
                requestAnimationFrame(() => focusCurrentStepCard(true));
                showToast('🔄 Proceso reiniciado');
            }
        }

        function openNotes(stepId, stepText) {
            currentNodeId = stepId;
            document.getElementById('modalTitle').textContent = stepText;
            document.getElementById('notasTextarea').value = stepNotes[stepId] || '';
            document.getElementById('notasModal').classList.add('active');
        }

        function cerrarModal() {
            document.getElementById('notasModal').classList.remove('active');
        }

        function guardarNotas() {
            if (currentNodeId !== null) {
                stepNotes[currentNodeId] = document.getElementById('notasTextarea').value;
                saveData();
                renderFlow();
                requestAnimationFrame(() => focusCurrentStepCard(false));
                cerrarModal();
                showToast('✅ Notas guardadas correctamente');
            }
        }

        function updateStats() {
            document.getElementById('stepCount').textContent = completedSteps.size;
            const totalSteps = flowDefinition.filter(s => shouldShowStep(s)).length;
            const percent = Math.round((completedSteps.size / totalSteps) * 100);
            document.getElementById('progressPercent').textContent = percent;
        }

        function showToast(message) {
            const toast = document.getElementById('toast');
            document.getElementById('toastMessage').textContent = message;
            toast.classList.add('show');
            setTimeout(() => toast.classList.remove('show'), 3000);
        }

        function toggleTimeline() {
            const content = document.getElementById('timelineContent');
            const toggleText = document.getElementById('timelineToggleText');
            
            if (content.classList.contains('active')) {
                content.classList.remove('active');
                toggleText.textContent = 'Mostrar';
            } else {
                content.classList.add('active');
                toggleText.textContent = 'Ocultar';
                updateTimeline();
            }
        }

        function loadExpedienteXML(event) {
            const file = event.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const parser = new DOMParser();
                    const xmlDoc = parser.parseFromString(e.target.result, "text/xml");
                    
                    // Verificar si hay errores de parseo
                    const parserError = xmlDoc.querySelector('parsererror');
                    if (parserError) {
                        showToast('❌ Error al leer el archivo XML');
                        return;
                    }

                    expedienteData = parseExpedienteXML(xmlDoc);
                    expedienteData.__xmlFileName = file.name || '';
                    expedienteData.__xmlLoadedAt = Date.now();
                    saveExpedienteData();
                    displayExpedienteInfo();
                    showToast('✅ Expediente cargado correctamente');
                    
                } catch (error) {
                    console.error('Error parsing XML:', error);
                    showToast('❌ Error al procesar el archivo XML');
                }
            };
            reader.readAsText(file);
        }

        function getXMLValue(xmlDoc, tagName, namespace = '') {
            try {
                let element;
                if (namespace) {
                    element = xmlDoc.getElementsByTagNameNS(namespace, tagName)[0];
                } else {
                    element = xmlDoc.getElementsByTagName(tagName)[0];
                }
                return element ? element.textContent.trim() : '';
            } catch (e) {
                return '';
            }
        }

        function getXMLAttribute(xmlDoc, tagName, attrName, namespace = '') {
            try {
                let element;
                if (namespace) {
                    element = xmlDoc.getElementsByTagNameNS(namespace, tagName)[0];
                } else {
                    element = xmlDoc.getElementsByTagName(tagName)[0];
                }
                return element ? element.getAttribute(attrName) || '' : '';
            } catch (e) {
                return '';
            }
        }

        function parseExpedienteXML(xmlDoc) {
            const cbcNS = 'urn:dgpe:names:draft:codice:schema:xsd:CommonBasicComponents-2';
            const cacNS = 'urn:dgpe:names:draft:codice:schema:xsd:CommonAggregateComponents-2';

            const data = {
                // Datos básicos
                expediente: getXMLValue(xmlDoc, 'ContractFolderID', cbcNS),
                uuid: getXMLValue(xmlDoc, 'UUID', cbcNS),
                fechaPublicacion: getXMLValue(xmlDoc, 'IssueDate', cbcNS),
                
                // Í“rgano de contratación
                organismo: getXMLValue(xmlDoc, 'Name', cbcNS),
                nif: '',
                contacto: {
                    telefono: '',
                    email: '',
                    direccion: ''
                },
                
                // Procedimiento
                procedimiento: getXMLAttribute(xmlDoc, 'ProcedureCode', 'name'),
                procedureCode: getXMLValue(xmlDoc, 'ProcedureCode', cbcNS),
                tramitacion: getXMLAttribute(xmlDoc, 'UrgencyCode', 'name'),
                
                // Proyecto
                nombreProyecto: '',
                descripcion: '',
                tipoContrato: getXMLAttribute(xmlDoc, 'TypeCode', 'name'),
                cpv: '',
                
                // Importes
                presupuestoBase: 0,
                presupuestoIVA: 0,
                valorEstimado: 0,
                
                // Plazos
                plazoEjecucion: '',
                plazoEjecucionDias: 0,
                fechaLimitePresentacion: '',
                
                // Garantías
                garantiaDefinitiva: '',
                
                // Criterios
                criteriosTecnicos: [],
                criteriosFinancieros: [],
                requisitos: [],
                
                // Otros
                subcontratacion: false,
                financiacionUE: ''
            };

            // Extraer datos más específicos
            try {
                // NIF y contacto
                const partyIds = xmlDoc.getElementsByTagNameNS(cbcNS, 'ID');
                for (let id of partyIds) {
                    if (id.getAttribute('schemeName') === 'NIF') {
                        data.nif = id.textContent.trim();
                        break;
                    }
                }

                const contacts = xmlDoc.getElementsByTagNameNS(cacNS, 'Contact');
                if (contacts.length > 0) {
                    data.contacto.telefono = getXMLValue(contacts[0], 'Telephone', cbcNS);
                    data.contacto.email = getXMLValue(contacts[0], 'ElectronicMail', cbcNS);
                }

                const addressLines = xmlDoc.getElementsByTagNameNS(cbcNS, 'Line');
                if (addressLines.length > 0) {
                    data.contacto.direccion = addressLines[0].textContent.trim();
                }

                // Nombre del proyecto
                const projectNames = xmlDoc.getElementsByTagNameNS(cbcNS, 'Name');
                for (let name of projectNames) {
                    const parent = name.parentElement;
                    if (parent && parent.localName === 'ProcurementProject') {
                        data.nombreProyecto = name.textContent.trim();
                        break;
                    }
                }

                // Descripción
                const descriptions = xmlDoc.getElementsByTagNameNS(cbcNS, 'Description');
                if (descriptions.length > 0) {
                    data.descripcion = descriptions[0].textContent.trim();
                }

                // CPV
                const cpvCode = getXMLValue(xmlDoc, 'ItemClassificationCode', cbcNS);
                const cpvName = getXMLAttribute(xmlDoc, 'ItemClassificationCode', 'name');
                if (cpvCode && cpvName) {
                    data.cpv = `${cpvCode} - ${cpvName}`;
                }

                // Importes
                data.presupuestoBase = parseFloat(getXMLValue(xmlDoc, 'TaxExclusiveAmount', cbcNS)) || 0;
                data.presupuestoIVA = parseFloat(getXMLValue(xmlDoc, 'TotalAmount', cbcNS)) || 0;
                data.valorEstimado = parseFloat(getXMLValue(xmlDoc, 'EstimatedOverallContractAmount', cbcNS)) || 0;

                // Plazos
                const durationMeasure = getXMLValue(xmlDoc, 'DurationMeasure', cbcNS);
                const durationUnit = getXMLAttribute(xmlDoc, 'DurationMeasure', 'unitCode');
                if (durationMeasure && durationUnit) {
                    data.plazoEjecucionDias = parseInt(durationMeasure);
                    data.plazoEjecucion = `${durationMeasure} ${durationUnit === 'DAY' ? 'días' : durationUnit === 'MONTH' ? 'meses' : 'años'}`;
                }

                data.fechaLimitePresentacion = getXMLValue(xmlDoc, 'EndDate', cbcNS);

                // Garantía definitiva
                const guaranteeRate = getXMLValue(xmlDoc, 'AmountRate', cbcNS);
                if (guaranteeRate) {
                    data.garantiaDefinitiva = `${guaranteeRate}%`;
                }

                // Financiación UE
                data.financiacionUE = getXMLAttribute(xmlDoc, 'FundingProgramCode', 'name');

                // Criterios técnicos
                const techCriteria = xmlDoc.getElementsByTagNameNS(cacNS, 'TechnicalEvaluationCriteria');
                for (let criteria of techCriteria) {
                    const name = criteria.getElementsByTagNameNS(cbcNS, 'EvaluationCriteriaTypeCode')[0]?.getAttribute('name');
                    if (name) data.criteriosTecnicos.push(name);
                }

                // Criterios financieros
                const finCriteria = xmlDoc.getElementsByTagNameNS(cacNS, 'FinancialEvaluationCriteria');
                for (let criteria of finCriteria) {
                    const name = criteria.getElementsByTagNameNS(cbcNS, 'EvaluationCriteriaTypeCode')[0]?.getAttribute('name');
                    if (name) data.criteriosFinancieros.push(name);
                }

                // Requisitos específicos
                const reqElements = xmlDoc.getElementsByTagNameNS(cacNS, 'SpecificTendererRequirement');
                for (let req of reqElements) {
                    const name = req.getElementsByTagNameNS(cbcNS, 'RequirementTypeCode')[0]?.getAttribute('name');
                    if (name) data.requisitos.push(name);
                }

            } catch (error) {
                console.error('Error extrayendo datos específicos:', error);
            }

            return data;
        }

        function formatCurrency(amount) {
            return new Intl.NumberFormat('es-ES', {
                style: 'currency',
                currency: 'EUR'
            }).format(amount);
        }

        function displayExpedienteInfo() {
            if (!expedienteData) {
                console.log('No hay datos de expediente para mostrar');
                return;
            }

            let context = `\n\n📄 DATOS DEL EXPEDIENTE:\n`;

            const infoContainer = document.getElementById('expedienteInfo');
            const gridContainer = document.getElementById('expedienteGrid');
            const highlightsContainer = document.getElementById('expedienteHighlights');

            if (!infoContainer || !gridContainer || !highlightsContainer) {
                console.error('No se encontraron los contenedores necesarios');
                return;
            }

            // Mostrar el contenedor
            infoContainer.classList.add('active');

            // Limpiar contenido previo
            gridContainer.innerHTML = '';
            highlightsContainer.innerHTML = '';

            // Campos principales
            const mainFields = [
                { label: 'Expediente', value: expedienteData.expediente },
                { label: 'Organismo', value: expedienteData.organismo },
                { label: 'NIF', value: expedienteData.nif },
                { label: 'Procedimiento', value: expedienteData.procedimiento },
                { label: 'Tipo de Contrato', value: expedienteData.tipoContrato },
                { label: 'Tramitación', value: expedienteData.tramitacion },
                { label: 'Presupuesto Base', value: formatCurrency(expedienteData.presupuestoBase) },
                { label: 'Presupuesto con IVA', value: formatCurrency(expedienteData.presupuestoIVA) },
                { label: 'Plazo Ejecución', value: expedienteData.plazoEjecucion },
                { label: 'Fecha Límite', value: expedienteData.fechaLimitePresentacion },
                { label: 'Garantía Definitiva', value: expedienteData.garantiaDefinitiva },
                { label: 'Contacto', value: expedienteData.contacto.email }
            ];

            mainFields.forEach(field => {
                if (field.value) {
                    const fieldEl = document.createElement('div');
                    fieldEl.className = 'expediente-field';
                    const labelEl = document.createElement('div');
                    labelEl.className = 'expediente-field-label';
                    labelEl.textContent = field.label;
                    const valueEl = document.createElement('div');
                    valueEl.className = 'expediente-field-value';
                    valueEl.textContent = field.value;
                    fieldEl.appendChild(labelEl);
                    fieldEl.appendChild(valueEl);
                    gridContainer.appendChild(fieldEl);
                }
            });

            // Highlights
            highlightsContainer.replaceChildren();
            const highlightsTitle = document.createElement('h4');
            highlightsTitle.textContent = '📋 Información Adicional';
            highlightsContainer.appendChild(highlightsTitle);

            if (expedienteData.nombreProyecto) {
                const projectDiv = document.createElement('div');
                projectDiv.style.marginBottom = '10px';
                const strong = document.createElement('strong');
                strong.textContent = 'Objeto: ';
                projectDiv.appendChild(strong);
                projectDiv.appendChild(document.createTextNode(expedienteData.nombreProyecto));
                highlightsContainer.appendChild(projectDiv);
            }

            if (expedienteData.cpv) {
                const cpvDiv = document.createElement('div');
                cpvDiv.style.marginBottom = '10px';
                const strong = document.createElement('strong');
                strong.textContent = '📋 CPV: ';
                cpvDiv.appendChild(strong);
                cpvDiv.appendChild(document.createTextNode(expedienteData.cpv));
                highlightsContainer.appendChild(cpvDiv);
            }

            // Criterios y requisitos
            const allTags = [
                ...expedienteData.criteriosTecnicos,
                ...expedienteData.criteriosFinancieros,
                ...expedienteData.requisitos
            ];

            if (allTags.length > 0) {
                const tagsContainer = document.createElement('div');
                tagsContainer.style.marginTop = '10px';
                allTags.forEach(tag => {
                    const tagEl = document.createElement('span');
                    tagEl.className = 'expediente-tag';
                    tagEl.textContent = tag;
                    tagsContainer.appendChild(tagEl);
                });
                highlightsContainer.appendChild(tagsContainer);
            }

            console.log('Datos del expediente mostrados correctamente');
        }

        function saveExpedienteData() {
            if (expedienteData) {
                localStorage.setItem('expediente_data', JSON.stringify(expedienteData));
            }
        }

        function loadExpedienteData() {
            const saved = localStorage.getItem('expediente_data');
            if (saved) {
                expedienteData = JSON.parse(saved);
                displayExpedienteInfo();
                return;
            }

            // Si el expediente activo no tiene XML asociado, limpiar estado/UI.
            expedienteData = null;
            const infoContainer = document.getElementById('expedienteInfo');
            if (infoContainer) infoContainer.classList.remove('active');
            const gridContainer = document.getElementById('expedienteGrid');
            if (gridContainer) gridContainer.innerHTML = '';
            const highlightsContainer = document.getElementById('expedienteHighlights');
            if (highlightsContainer) highlightsContainer.innerHTML = '';
            const fileInput = document.getElementById('xmlFileInput');
            if (fileInput) fileInput.value = '';
        }

        function clearExpediente() {
            if (confirm('¿Seguro que quieres eliminar los datos del expediente?')) {
                expedienteData = null;
                localStorage.removeItem('expediente_data');
                
                // Limpiar la interfaz
                const infoContainer = document.getElementById('expedienteInfo');
                if (infoContainer) {
                    infoContainer.classList.remove('active');
                }
                
                const fileInput = document.getElementById('xmlFileInput');
                if (fileInput) {
                    fileInput.value = '';
                }
                
                // Re-renderizar el flujo para quitar los datos contextuales
                renderFlow();
                
                showToast('🗑️ Datos del expediente eliminados');
            }
        }

        function getExpedienteContext() {
            if (!expedienteData) return '';
            
            let context = `\n\n📄 DATOS DEL EXPEDIENTE:\n`;
            context += `Expediente: ${expedienteData.expediente}\n`;
            context += `Objeto: ${expedienteData.nombreProyecto}\n`;
            context += `Procedimiento: ${expedienteData.procedimiento}\n`;
            context += `Tipo: ${expedienteData.tipoContrato}\n`;
            context += `Presupuesto: ${formatCurrency(expedienteData.presupuestoBase)}\n`;
            
            return context;
        }

        function getStepContext(step) {
            if (!expedienteData) return null;

            const texto = normalizeForMatch(step.texto);
            
            // Información relevante según el tipo de paso
            
            // Apertura y calificación administrativa
            if ((texto.includes('apertura') || texto.includes('acceder al acto')) && 
                (texto.includes('calificacion') || texto.includes('administrativa'))) {
                return `
                    <strong>📋 Expediente:</strong> ${expedienteData.expediente}<br>
                    <strong>📝 Objeto:</strong> ${expedienteData.nombreProyecto}<br>
                    <strong>💰 Presupuesto:</strong> ${formatCurrency(expedienteData.presupuestoBase)}<br>
                    <strong>📅 Límite presentación:</strong> ${expedienteData.fechaLimitePresentacion}
                `;
            }
            
            // Comenzar acto
            if (texto.includes('pulsar') && texto.includes('comenzar')) {
                return `
                    <strong>📄 Expediente:</strong> ${expedienteData.expediente}<br>
                    <strong>🏛️ Órgano:</strong> ${expedienteData.organismo}
                `;
            }
            
            // Revisar ofertas
            if (texto.includes('revisar') && (texto.includes('oferta') || texto.includes('licitador'))) {
                return `
                    <strong>Procedimiento:</strong> ${expedienteData.procedimiento}<br>
                    <strong>⚡ Tramitación:</strong> ${expedienteData.tramitacion}
                `;
            }
            
            // Descifrar/Abrir sobres
            if (texto.includes('descifrar') || (texto.includes('abrir') && texto.includes('sobre'))) {
                return `
                    <strong> Tipo contrato:</strong> ${expedienteData.tipoContrato}<br>
                    <strong>📋 CPV:</strong> ${expedienteData.cpv}
                `;
            }
            
            // Validaciones y firmas
            if (texto.includes('validacion') || texto.includes('firma') || texto.includes('integridad')) {
                return `
                    <strong>✅ Verificar:</strong> Firma electrónica e integridad<br>
                    <strong> Contacto:</strong> ${expedienteData.contacto.email}
                `;
            }
            
            // Requisitos de participación
            if (texto.includes('requisito') && texto.includes('participacion')) {
                const criterios = [...expedienteData.criteriosTecnicos, ...expedienteData.criteriosFinancieros];
                if (criterios.length > 0) {
                    return `
                        <strong>✅ Criterios a verificar:</strong><br>
                        ${criterios.slice(0, 3).map(c => `• ${c}`).join('<br>')}
                        ${criterios.length > 3 ? `<br><em>... y ${criterios.length - 3} más</em>` : ''}
                    `;
                }
            }
            
            // Subsanación
            if (texto.includes('subsana') || texto.includes('subsana')) {
                return `
                    <strong> Plazo:</strong> 3 días hábiles (según LCSP)<br>
                    <strong> Notificar a:</strong> ${expedienteData.contacto.email}<br>
                    <strong> Contacto:</strong> ${expedienteData.contacto.telefono}
                `;
            }
            
            // Calcular estado
            if (texto.includes('calcular') || (texto.includes('registrar') && texto.includes('estado'))) {
                return `
                    <strong> Evaluación según:</strong><br>
                    • Criterios técnicos: ${expedienteData.criteriosTecnicos.length}<br>
                    • Criterios financieros: ${expedienteData.criteriosFinancieros.length}<br>
                    • Requisitos: ${expedienteData.requisitos.length}
                `;
            }
            
            // Comunicaciones
            if (texto.includes('comunicacion') || texto.includes('mensaje')) {
                return `
                    <strong>Email:</strong> ${expedienteData.contacto.email}<br>
                    <strong>Teléfono:</strong> ${expedienteData.contacto.telefono}<br>
                    <strong>📍 Dirección:</strong> ${expedienteData.contacto.direccion}
                `;
            }
            
            // Valoración
            if (texto.includes('valoracion') || texto.includes('criterio') || texto.includes('puntuacion')) {
                return `
                    <strong>Procedimiento:</strong> ${expedienteData.procedimiento}<br>
                    <strong>🎯 Tipo:</strong> ${expedienteData.tipoContrato}<br>
                    <strong>Presupuesto:</strong> ${formatCurrency(expedienteData.presupuestoBase)}
                `;
            }
            
            // Propuesta de adjudicación
            if (texto.includes('adjudicacion') || texto.includes('propuesta') || texto.includes('adjudicatario')) {
                return `
                    <strong>Presupuesto base:</strong> ${formatCurrency(expedienteData.presupuestoBase)}<br>
                    <strong>Con IVA (21%):</strong> ${formatCurrency(expedienteData.presupuestoIVA)}<br>
                    <strong>Garantía definitiva:</strong> ${expedienteData.garantiaDefinitiva}<br>
                    <strong>Plazo ejecución:</strong> ${expedienteData.plazoEjecucion}
                `;
            }
            
            // Requerimiento de documentación
            if (texto.includes('requerimiento') && texto.includes('documentacion')) {
                return `
                    <strong>Plazo ejecución:</strong> ${expedienteData.plazoEjecucion}<br>
                    <strong>Garantía definitiva:</strong> ${expedienteData.garantiaDefinitiva}<br>
                    <strong>Valor estimado:</strong> ${formatCurrency(expedienteData.valorEstimado)}
                `;
            }
            
            // Generar informes
            if (texto.includes('informe')) {
                return `
                    <strong>📋 Expediente:</strong> ${expedienteData.expediente}<br>
                    <strong>📝 Objeto:</strong> ${expedienteData.nombreProyecto}<br>
                    <strong>🏛️ Órgano:</strong> ${expedienteData.organismo}
                `;
            }
            
            // Finalizar
            if (texto.includes('finalizar')) {
                return `
                    <strong>✅ Expediente:</strong> ${expedienteData.expediente}<br>
                    <strong>Importe:</strong> ${formatCurrency(expedienteData.presupuestoIVA)}<br>
                    <strong>🎯 Completado</strong>
                `;
            }
            
            return null;
        }

        function formatDate(timestamp) {
            if (!timestamp) return '-';
            const date = new Date(timestamp);
            return date.toLocaleString('es-ES', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        }

        function formatDuration(ms) {
            if (!ms) return '-';
            const seconds = Math.floor(ms / 1000);
            const minutes = Math.floor(seconds / 60);
            const hours = Math.floor(minutes / 60);
            const days = Math.floor(hours / 24);

            if (days > 0) return `${days}d ${hours % 24}h`;
            if (hours > 0) return `${hours}h ${minutes % 60}m`;
            if (minutes > 0) return `${minutes}m`;
            return `${seconds}s`;
        }

        function calculateTotalDuration() {
            const completedIds = Array.from(completedSteps);
            if (completedIds.length === 0) return 0;

            const timestamps = completedIds
                .map(id => stepTimestamps[id])
                .filter(t => t);

            if (timestamps.length === 0) return 0;

            const startTimes = completedIds
                .map(id => stepStartTimes[id])
                .filter(t => t);

            if (startTimes.length === 0) return 0;

            const firstStart = Math.min(...startTimes);
            const lastComplete = Math.max(...timestamps);

            return lastComplete - firstStart;
        }

        function calculateCurrentStepDuration() {
            const currentDef = flowDefinition[currentStep];
            if (!currentDef) return 0;

            const startTime = stepStartTimes[currentDef.id];
            if (!startTime) return 0;

            return Date.now() - startTime;
        }

        function updateTimeline() {
            updateTimelineStats();
            updateTimelineList();
        }

        function updateTimelineStats() {
            const statsContainer = document.getElementById('timelineStats');
            statsContainer.innerHTML = '';

            const totalDuration = calculateTotalDuration();
            const currentDuration = calculateCurrentStepDuration();
            const completedCount = completedSteps.size;
            const totalSteps = flowDefinition.filter(s => shouldShowStep(s)).length;

            const stats = [
                {
                    label: 'Tiempo Total',
                    value: formatDuration(totalDuration),
                    color: '#667eea'
                },
                {
                    label: 'Paso Actual',
                    value: formatDuration(currentDuration),
                    color: '#fbbf24'
                },
                {
                    label: 'Pasos Completados',
                    value: `${completedCount} / ${totalSteps}`,
                    color: '#28a745'
                },
                {
                    label: 'Fecha Inicio',
                    value: getFirstStepDate(),
                    color: '#6c757d'
                }
            ];

            stats.forEach(stat => {
                const statEl = document.createElement('div');
                statEl.className = 'timeline-stat';
                statEl.style.borderLeftColor = stat.color;
                const labelEl = document.createElement('div');
                labelEl.className = 'timeline-stat-label';
                labelEl.textContent = stat.label;
                const valueEl = document.createElement('div');
                valueEl.className = 'timeline-stat-value';
                valueEl.textContent = stat.value;
                statEl.appendChild(labelEl);
                statEl.appendChild(valueEl);
                statsContainer.appendChild(statEl);
            });
        }

        function getFirstStepDate() {
            const startTimes = Object.values(stepStartTimes);
            if (startTimes.length === 0) return '-';
            const firstTime = Math.min(...startTimes);
            const date = new Date(firstTime);
            return date.toLocaleDateString('es-ES', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
            });
        }

        function updateTimelineList() {
            const listContainer = document.getElementById('timelineList');
            listContainer.innerHTML = '';

            let lastPhaseIndex = -1;

            flowDefinition.forEach((step, index) => {
                if (!shouldShowStep(step)) return;

                // Insertar separador de fase
                const currentPhaseIndex = PROCESS_PHASES.findIndex((p, i) => 
                    i === PROCESS_PHASES.length - 1 || 
                    index < (PROCESS_PHASES[i + 1]?.startStep || Infinity)
                );

                if (SHOW_PHASE_VISUALS && currentPhaseIndex > lastPhaseIndex && currentPhaseIndex >= 0) {
                    const separator = document.createElement('div');
                    separator.className = 'timeline-phase-separator';
                    separator.textContent = `${PROCESS_PHASES[currentPhaseIndex].icon} ${PROCESS_PHASES[currentPhaseIndex].name}`;
                    listContainer.appendChild(separator);
                    lastPhaseIndex = currentPhaseIndex;
                }

                const item = document.createElement('div');
                item.className = 'timeline-item';

                if (completedSteps.has(step.id)) {
                    item.classList.add('completed');
                }
                if (index === currentStep) {
                    item.classList.add('current');
                }

                const icon = document.createElement('div');
                icon.className = 'timeline-item-icon';
                if (completedSteps.has(step.id)) {
                    icon.textContent = '✅';
                } else if (index === currentStep) {
                    icon.textContent = '▶';
                } else {
                    icon.textContent = '○';
                }

                const content = document.createElement('div');
                content.className = 'timeline-item-content';

                const title = document.createElement('div');
                title.className = 'timeline-item-title';
                title.textContent = step.texto;

                const meta = document.createElement('div');
                meta.className = 'timeline-item-meta';

                const actorBadge = document.createElement('span');
                const actorStrong = document.createElement('strong');
                actorStrong.textContent = 'Actor: ';
                actorBadge.appendChild(actorStrong);
                actorBadge.appendChild(document.createTextNode(step.actor));
                meta.appendChild(actorBadge);

                if (stepStartTimes[step.id]) {
                    const startDate = document.createElement('span');
                    startDate.appendChild(document.createTextNode('🕐 '));
                    const startStrong = document.createElement('strong');
                    startStrong.textContent = 'Inicio: ';
                    startDate.appendChild(startStrong);
                    startDate.appendChild(document.createTextNode(formatDate(stepStartTimes[step.id])));
                    meta.appendChild(startDate);
                }

                if (stepTimestamps[step.id]) {
                    const endDate = document.createElement('span');
                    endDate.appendChild(document.createTextNode('✅ '));
                    const endStrong = document.createElement('strong');
                    endStrong.textContent = 'Fin: ';
                    endDate.appendChild(endStrong);
                    endDate.appendChild(document.createTextNode(formatDate(stepTimestamps[step.id])));
                    meta.appendChild(endDate);

                    if (stepStartTimes[step.id]) {
                        const duration = stepTimestamps[step.id] - stepStartTimes[step.id];
                        const durationBadge = document.createElement('span');
                        durationBadge.className = 'timeline-duration';
                        durationBadge.textContent = `⏲️ ${formatDuration(duration)}`;
                        meta.appendChild(durationBadge);
                    }
                } else if (index === currentStep && stepStartTimes[step.id]) {
                    const elapsed = Date.now() - stepStartTimes[step.id];
                    const durationBadge = document.createElement('span');
                    durationBadge.className = 'timeline-duration';
                    durationBadge.textContent = ` ${formatDuration(elapsed)} (en curso)`;
                    meta.appendChild(durationBadge);
                }

                content.appendChild(title);
                content.appendChild(meta);

                item.appendChild(icon);
                item.appendChild(content);

                listContainer.appendChild(item);
            });
        }

        // Event listeners
        document.getElementById('notasModal').addEventListener('click', (e) => {
            if (e.target.id === 'notasModal') cerrarModal();
        });
        document.getElementById('btnRetroceder').addEventListener('click', retrocederFlujo);
        document.getElementById('btnContinuar').addEventListener('click', continuarFlujo);
        document.getElementById('btnReiniciar').addEventListener('click', reiniciarFlujo);
        document.getElementById('btnClearExpediente').addEventListener('click', clearExpediente);
        document.getElementById('btnToggleTimeline').addEventListener('click', toggleTimeline);
        document.getElementById('btnCerrarModal').addEventListener('click', cerrarModal);
        document.getElementById('btnGuardarNotas').addEventListener('click', guardarNotas);
        document.getElementById('xmlFileInput').addEventListener('change', loadExpedienteXML);
        window.addEventListener('resize', () => requestAnimationFrame(renderFlow));

        // Atajos de teclado
        document.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowRight' && !e.ctrlKey && !e.metaKey) {
                continuarFlujo();
            } else if (e.key === 'ArrowLeft' && !e.ctrlKey && !e.metaKey) {
                retrocederFlujo();
            }
        });

        // Inicializar
        loadData();
        loadExpedienteData(); // Cargar datos del expediente si existen
        
        // Registrar inicio del paso actual si no existe
        const currentDef = flowDefinition[currentStep];
        if (currentDef && !stepStartTimes[currentDef.id]) {
            stepStartTimes[currentDef.id] = Date.now();
            saveData();
        }
        
        renderFlow();
        requestAnimationFrame(() => focusCurrentStepCard(false));
        
        // Auto-avanzar pasos del Sistema si estamos en uno al cargar
        setTimeout(() => {
            autoAdvanceSystemSteps();
        }, 500);
