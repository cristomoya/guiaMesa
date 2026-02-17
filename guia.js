(function () {
  var lista = document.getElementById('indice-lista');
  if (!lista) return;

  var headings = Array.prototype.slice.call(document.querySelectorAll('h1, h2, h3, h4'));
  var items = [];

  headings.forEach(function (h, idx) {
    var text = (h.textContent || '').replace(/\s+/g, ' ').trim();
    if (!text) return;
    if (text.toLowerCase() === 'índice del documento') return;

    var targetId = h.id;
    if (!targetId) {
      var a = h.querySelector('a[name]');
      if (a && a.getAttribute('name')) {
        targetId = a.getAttribute('name');
      } else {
        targetId = 'indice-target-' + idx;
        h.id = targetId;
      }
    }

    items.push({
      level: Number((h.tagName || 'H2').replace('H', '')) || 2,
      text: text,
      href: '#' + targetId
    });
  });

  if (!items.length) {
    var li = document.createElement('li');
    li.textContent = 'No se encontraron encabezados.';
    lista.replaceChildren(li);
    return;
  }

  lista.replaceChildren();
  items.forEach(function (it) {
    var lvl = Math.min(Math.max(it.level, 1), 4);
    var li = document.createElement('li');
    li.className = 'n' + lvl;
    var a = document.createElement('a');
    a.setAttribute('href', it.href);
    a.textContent = it.text;
    li.appendChild(a);
    lista.appendChild(li);
  });
})();

// Remapea rutas exportadas del HTML original a la carpeta local images/
(function () {
  var imgs = document.querySelectorAll('img[src]');
  imgs.forEach(function (img) {
    var src = img.getAttribute('src') || '';
    if (!/PLACSP_LE_OA_Celebraci/i.test(src)) return;
    var m = src.match(/(Image_[0-9]+\.(?:png|jpg))/i);
    if (!m) return;
    img.setAttribute('src', 'images/' + m[1]);
  });
})();

// Evita re-navegar al mismo hash (#bookmark...) para no duplicar entradas de historial.
(function () {
  document.addEventListener('click', function (ev) {
    var link = ev.target.closest('a[href^="#"]');
    if (!link) return;
    var href = link.getAttribute('href') || '';
    if (!href || href === '#') return;
    if (window.location.hash === href) {
      ev.preventDefault();
      var id = href.slice(1);
      var target = document.querySelector('[name="' + CSS.escape(id) + '"], #' + CSS.escape(id));
      if (target && typeof target.scrollIntoView === 'function') {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  });
})();

