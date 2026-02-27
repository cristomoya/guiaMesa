# Changelog

## [1.3.3] - 2026-02-27

### Added
- Navegación directa por paso: selector `Ir a paso` para fijar el paso activo sin recorrer todo el flujo.
- Persistencia visual de controles principales con barra de navegación `sticky` (`Retroceder`, `Continuar`, `Reiniciar`).
- Soporte de carga de diagrama externo desde `sidebar.html` usando `data-src` en `plantumlSource`.
- Fallback de carga para entornos `file://` cuando falla CORS (lectura mediante `iframe` oculto).
- Resolución tolerante de nombre de fichero con/sin tilde para `Contratacion`/`Contratación`.

### Changed
- Reordenación de scripts en `sidebar.html` para cargar `sidebar.js` antes de `diagram-manager.js`.
- Mejora del parser de actores y tokens PlantUML para evitar saltos de bloques por parseo incorrecto.
- Soporte de enlaces `bookmark:` en dos formatos:
  - Anclas de `guia.html` (ej. `bookmark37`).
  - URLs completas (ej. `https://...`).

### Fixed
- Corrección de render de canales (swimlanes) con nombres largos y espacios.
- Eliminación de residuos `://...` en tarjetas causados por parseo parcial de `bookmark:`.
- Endurecimiento de listeners para evitar fallo global cuando faltan elementos opcionales del DOM.
- Correcciones de codificación UTF-8 en `sidebar.html` y `sidebar.css`.

### Documentation
- Externalización del diagrama embebido a fichero `.puml` referenciado por `data-src`.
- Eliminación de líneas `note right:` del diagrama embebido para simplificar el render operativo.
