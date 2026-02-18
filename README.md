# MANUAL DE USUARIO FINAL
## Extension Firefox: Seguimiento de actividades de la mesa de contratacion

### Portada del documento
- Codigo de documento: `MAN-EXT-FF-001`
- Version: `1.2.0`
- Estado: `Vigente`
- Fecha de emision: `17/02/2026`
- Fecha de ultima revision: `18/02/2026`
- Sistema: `Extension Firefox - Barra lateral`
- Archivo: `README-extension-firefox.md`

### Control de aprobacion
- Elaborado por: `Equipo funcional`
- Revisado por: `Responsable tecnico`
- Aprobado por: `Responsable del servicio`

### Control de cambios
| Version | Fecha       | Autor            | Descripcion del cambio |
|---------|-------------|------------------|------------------------|
| 1.2.0   | 18/02/2026  | Equipo funcional | Se incorpora gestion multi-expediente, puntos de control y temporizadores configurables de plazos |
| 1.1.0   | 18/02/2026  | Equipo funcional | Actualizacion del manual con timeline detallada, autocompletado de pasos del sistema y detalle ampliado de expediente XML |
| 1.0.0   | 17/02/2026  | Equipo funcional | Emision inicial del manual institucional |

## 1. Objeto
Establecer las instrucciones oficiales para instalar, operar y mantener la extension Firefox de seguimiento del flujo de licitacion, incluyendo uso funcional, tratamiento de datos y resolucion de incidencias.

## 2. Alcance
Este manual aplica a usuarios funcionales que operan el flujo de actividades de la mesa de contratacion mediante la barra lateral de Firefox.

Incluye:
- Instalacion temporal para uso interno.
- Ejecucion de la operativa diaria.
- Gestion de datos de expediente XML.
- Gestion de multiples expedientes en paralelo.
- Puntos de control para guardar/restaurar estado.
- Temporizadores de plazos en pasos de espera.
- Seguimiento del avance y tiempos.
- Recuperacion ante errores funcionales.

## 3. Referencias
- `manifest.json`
- `sidebar.html`
- `sidebar.css`
- `sidebar.js`
- `expediente-manager.js`
- `sidebar-patch.js`
- `plazo-timer.js`
- `guia.html`
- `images/`

## 4. Requisitos previos
- Navegador Firefox version `142.0` o superior (segun `strict_min_version`).
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
3. Verificar disponibilidad de controles: `Retroceder`, `Continuar`, `Reiniciar`, `Cargar XML`, `Limpiar Datos`, `Mostrar/Ocultar` (timeline).

## 6. Operacion funcional
## 6.1 Navegacion principal
- `Continuar`: completa el paso actual y avanza al siguiente.
- `Retroceder`: retorna al paso visible anterior.
- `Reiniciar`: reinicia la secuencia operativa.
- Click en el paso actual: marca el paso como completado y avanza (solo pasos manuales).
- Pasos actor `Sistema`: se completan automaticamente.

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
- Edicion de notas mediante modal (`Guardar`).

## 6.4 Uso de referencias PLACSP
- Si el paso dispone de referencia, usar `Ver en PLACSP`.
- El sistema abre `guia.html` en el marcador asociado.

## 7. Gestion de expediente XML
## 7.1 Carga de datos
1. Pulsar `Cargar XML`.
2. Seleccionar fichero `.xml`.
3. Verificar que aparecen datos de contexto del expediente en `Datos del Expediente`.
4. Verificar inyeccion de contexto en el paso actual (si aplica al acto).

## 7.2 Limpieza de datos
1. Pulsar `Limpiar Datos`.
2. Confirmar visualmente la eliminacion de datos de expediente.

## 7.3 Gestion multi-expediente
- Panel `Expedientes` para crear, activar, renombrar y eliminar expedientes.
- Cada expediente conserva su propio progreso, decisiones, notas, timeline y XML.
- Al cambiar de expediente se recarga automaticamente su estado.

## 7.4 Puntos de control
- En el panel `Expedientes`, usar `Guardar` en `Puntos de control`.
- Cada punto guarda estado del flujo y datos XML del expediente activo.
- Opcion `Restaurar` para volver a un punto guardado.

## 8. Seguimiento y medicion
## 8.1 Timeline
- `Mostrar/Ocultar` despliega o contrae la timeline.
- Presenta estado de ejecucion por paso y separadores por fase.

## 8.2 Indicadores disponibles
- `Tiempo Total`.
- `Paso Actual`.
- `Pasos Completados`.
- `Fecha Inicio`.

## 8.3 Temporizadores de plazo
- En pasos tipo `Esperar plazo`, se muestra un widget de temporizador.
- Permite configurar fecha/hora fin y etiqueta del plazo.
- Si existe `Fecha Limite` en XML, puede usarse como sugerencia.
- El estado visual cambia por nivel: normal, proximo, urgente, critico o expirado.

## 9. Persistencia y continuidad
La extension conserva en almacenamiento local:
- Paso actual.
- Historial de pasos completados.
- Decisiones seleccionadas.
- Notas.
- Tiempos de ejecucion.
- Marcas temporales de inicio y fin por paso.
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
2. Validar que el XML no tenga errores de parseo.
3. Validar estructura del XML de expediente PLACSP.
4. Probar con un XML alternativo.

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
- `guia.js`: utilidades auxiliares de la guia.
- `expediente-manager.js`: gestion de expedientes, estados y checkpoints.
- `sidebar-patch.js`: integracion de panel multi-expediente y migracion de datos legacy.
- `plazo-timer.js`: temporizadores de pasos de espera y cuenta atras.
