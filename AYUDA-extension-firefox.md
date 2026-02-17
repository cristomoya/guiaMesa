# MANUAL DE USUARIO FINAL
## Extension Firefox: Seguimiento de actividades de la mesa de contratacion

### Portada del documento
- Codigo de documento: `MAN-EXT-FF-001`
- Version: `1.0.0`
- Estado: `Vigente`
- Fecha de emision: `17/02/2026`
- Fecha de ultima revision: `17/02/2026`
- Sistema: `Extension Firefox - Barra lateral`
- Archivo: `README-extension-firefox.md`

### Control de aprobacion
- Elaborado por: `Equipo funcional`
- Revisado por: `Responsable tecnico`
- Aprobado por: `Responsable del servicio`

### Control de cambios
| Version | Fecha       | Autor            | Descripcion del cambio |
|---------|-------------|------------------|------------------------|
| 1.0.0   | 17/02/2026  | Equipo funcional | Emision inicial del manual institucional |

## 1. Objeto
Establecer las instrucciones oficiales para instalar, operar y mantener la extension Firefox de seguimiento del flujo de licitacion, incluyendo uso funcional, tratamiento de datos y resolucion de incidencias.

## 2. Alcance
Este manual aplica a usuarios funcionales que operan el flujo de actividades de la mesa de contratacion mediante la barra lateral de Firefox.

Incluye:
- Instalacion temporal para uso interno.
- Ejecucion de la operativa diaria.
- Gestion de datos de expediente XML.
- Seguimiento del avance y tiempos.
- Recuperacion ante errores funcionales.

## 3. Referencias
- `manifest.json`
- `sidebar.html`
- `sidebar.css`
- `sidebar.js`
- `guia.html`
- `images/`

## 4. Requisitos previos
- Navegador Firefox compatible con `manifest_version: 2`.
- Disponibilidad de todos los archivos de la extension en una misma carpeta.
- Permiso de usuario para cargar complementos temporales en Firefox.

## 5. Instalacion y activacion
## 5.1 Carga temporal del complemento
1. Abrir `about:debugging#/runtime/this-firefox`.
2. Seleccionar `Cargar complemento temporal...`.
3. Elegir el archivo `manifest.json`.
4. Abrir barra lateral y seleccionar `Seguimiento Licitacion`.

## 5.2 Validacion inicial
1. Confirmar que se visualiza el panel lateral.
2. Confirmar carga del diagrama de pasos.
3. Verificar disponibilidad de controles: `Retroceder`, `Continuar`, `Reiniciar`, `Cargar XML`, `Limpiar Datos`.

## 6. Operacion funcional
## 6.1 Navegacion principal
- `Continuar`: completa el paso actual y avanza al siguiente.
- `Retroceder`: retorna al paso visible anterior.
- `Reiniciar`: reinicia la secuencia operativa.

Atajos:
- `->` continuar
- `<-` retroceder

## 6.2 Lectura visual de estados
- Paso actual: nodo resaltado.
- Paso completado: nodo marcado como completado.
- Decision: nodo con seleccion obligatoria `Si` o `No`.
- Bucle: nodo con retorno de flujo.
- Sistema: paso con posible autocompletado.
- `FASE N`: marcador de salto entre actos administrativos.

## 6.3 Uso de notas
- Cada paso activo o completado puede registrar notas.
- Las notas se conservan para sesiones posteriores.

## 6.4 Uso de referencias PLACSP
- Si el paso dispone de referencia, usar `Ver en PLACSP`.
- El sistema abre `guia.html` en el marcador asociado.

## 7. Gestion de expediente XML
## 7.1 Carga de datos
1. Pulsar `Cargar XML`.
2. Seleccionar fichero `.xml`.
3. Verificar que aparecen datos de contexto del expediente.

## 7.2 Limpieza de datos
1. Pulsar `Limpiar Datos`.
2. Confirmar visualmente la eliminacion de datos de expediente.

## 8. Seguimiento y medicion
## 8.1 Timeline
- `Mostrar/Ocultar` despliega o contrae la timeline.
- Presenta estado de ejecucion por paso.

## 8.2 Indicadores disponibles
- Pasos completados.
- Porcentaje de avance.
- Inicio y fin por paso.
- Duracion por actividad cuando aplica.

## 9. Persistencia y continuidad
La extension conserva en almacenamiento local:
- Paso actual.
- Historial de pasos completados.
- Decisiones seleccionadas.
- Notas.
- Tiempos de ejecucion.
- Datos de expediente XML.

Procedimiento de reinicio completo:
1. Ejecutar `Reiniciar`.
2. Ejecutar `Limpiar Datos`.

## 10. Incidencias y recuperacion
## 10.1 La extension no aparece en barra lateral
1. Revisar carga de `manifest.json`.
2. Recargar complemento desde `about:debugging`.

## 10.2 No se muestran imagenes o referencias
1. Verificar carpeta `images/`.
2. Verificar archivo `guia.html` en raiz del proyecto.

## 10.3 Error al cargar XML
1. Confirmar extension `.xml`.
2. Validar estructura del XML.
3. Probar con un XML alternativo.

## 10.4 Estado inconsistente del flujo
1. Pulsar `Reiniciar`.
2. Pulsar `Limpiar Datos`.
3. Cerrar y reabrir barra lateral.

## 11. Empaquetado para distribucion interna
1. Comprimir el contenido de la carpeta de la extension.
2. No comprimir la carpeta contenedora.
3. Renombrar el `.zip` a `.xpi`.

## 12. Anexo tecnico breve
Archivos principales:
- `manifest.json`: declaracion del complemento Firefox.
- `sidebar.html`: estructura de interfaz y flujo.
- `sidebar.css`: estilos de visualizacion.
- `sidebar.js`: logica funcional y persistencia.
