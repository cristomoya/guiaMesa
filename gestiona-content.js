(function () {
    function normalizeLabel(text) {
        return String(text || '')
            .replace(/\s+/g, ' ')
            .replace(/[:]/g, '')
            .trim()
            .toLowerCase();
    }

    function cleanValue(text) {
        return String(text || '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function createExtractedData() {
        return {
            expediente: '',
            fechaApertura: '',
            serieDocumental: '',
            nombreProyecto: '',
            organismo: '',
            procedimiento: '',
            tipoContrato: '',
            contacto: {
                telefono: '',
                email: '',
                direccion: ''
            },
            criteriosTecnicos: [],
            criteriosFinancieros: [],
            requisitos: []
        };
    }

    function mapLabelToField(data, label, value) {
        if (!value) return;

        if (label.includes('n. expediente') || label.includes('numero expediente')) {
            data.expediente = value;
            return;
        }
        if (label.includes('f. apertura') || label.includes('fecha apertura')) {
            data.fechaApertura = value;
            return;
        }
        if (label.includes('serie documental')) {
            data.serieDocumental = value;
            if (!data.tipoContrato) data.tipoContrato = value;
            return;
        }
        if (label.includes('asunto')) {
            data.nombreProyecto = value;
            return;
        }
        if (label.includes('organo') || label.includes('órgano') || label.includes('departamento')) {
            data.organismo = value;
            return;
        }
        if (label.includes('procedimiento')) {
            data.procedimiento = value;
        }
    }

    function extractExpedienteFromTables() {
        const tables = Array.from(document.querySelectorAll('table'));
        for (const table of tables) {
            const rows = Array.from(table.querySelectorAll('tr'));
            if (rows.length === 0) continue;

            const data = createExtractedData();
            let hasExpediente = false;

            rows.forEach((row) => {
                const cells = row.querySelectorAll('td');
                if (cells.length < 2) return;

                const label = normalizeLabel(cells[0].textContent);
                const value = cleanValue(cells[1].textContent);
                if (!label || !value) return;

                mapLabelToField(data, label, value);
                if (label.includes('expediente')) hasExpediente = true;
            });

            if (!hasExpediente || !data.expediente) continue;

            data.__sourceUrl = window.location.href;
            data.__pageTitle = document.title || '';
            return data;
        }

        return null;
    }

    const runtimeApi = typeof browser !== 'undefined'
        ? browser.runtime
        : (typeof chrome !== 'undefined' ? chrome.runtime : null);

    if (!runtimeApi || !runtimeApi.onMessage) return;

    runtimeApi.onMessage.addListener((message) => {
        if (!message || message.type !== 'gestiona:extract-expediente') {
            return undefined;
        }

        return Promise.resolve({
            ok: true,
            data: extractExpedienteFromTables()
        });
    });
})();
