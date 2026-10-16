# Word Desktop Simulator Realistic

Este paquete contiene una simulación local de la interfaz de Microsoft Word de escritorio.

## Ejecutar

1. Descomprime el ZIP.
2. Abre `index.html` directamente en Chrome, Edge o Firefox.
3. No requiere instalación, servidor ni conexión a internet.

## Archivos

- `index.html`: estructura principal.
- `styles.css`: diseño visual tipo Word, con pestañas y cinta.
- `app.js`: funcionalidades de edición, guardado, abrir/exportar, pestañas, búsqueda, inserciones y vista.
- `README.md`: instrucciones.

## Funcionalidades incluidas

- Pestañas: Archivo, Inicio, Insertar, Diseño, Disposición, Referencias, Correspondencia, Revisar, Vista, Ayuda y QuillBot.
- Cinta de Inicio organizada en grupos: Portapapeles, Fuente, Párrafo, Estilos, Edición y Complementos.
- Edición enriquecida con contenteditable.
- Guardado local en el navegador.
- Abrir `.json`, `.html`, `.htm`, `.txt`.
- Descargar `.html`, `.txt`, `.json`.
- Insertar tablas, imágenes, vínculos, portada, saltos, cuadros de texto, WordArt simulado, gráficos simulados y encabezado/pie.
- Vista, zoom, regla, panel de navegación y modo lectura/web simulado.
- Funciones básicas de revisión y correspondencia simuladas.

## Nota

No es Microsoft Word real ni usa el motor DOCX propietario. Es un prototipo web local que imita la interfaz y las funciones básicas principales.


## Actualización Guardar como PDF

En Archivo > Guardar como se despliega una lista de formatos similar a Word. Sólo PDF está habilitado. Al seleccionar PDF, el documento se genera y descarga automáticamente como archivo `.pdf`.


## Actualización de Inicio, Revisión y PDF fotográfico

- La pestaña Inicio ahora incluye controles habilitados de negrita, cursiva, subrayado, alineación izquierda, centrado, derecha, justificar, interlineado y paletas de color.
- La paleta de color de fuente incluye colores básicos y el color RGB `#0068FF`.
- La pestaña Revisar incluye un corrector básico en Español Internacional: detecta errores comunes, permite cambiar por sugerencia u omitir. Además, el área de escritura usa `spellcheck` del navegador en español.
- La descarga PDF captura únicamente la hoja de Word y la guarda como imagen dentro del PDF para conservar tablas, imágenes, colores, alineaciones y formato visual.


## Actualización de paleta y diccionario local

- La paleta de color de fuente incluye `#0068FF` y `#FF7D01`.
- Se añadió `dictionary_words.js`, generado a partir del PDF `Diccionario básico de español.pdf` incluido en el paquete.
- El PDF `Diccionario básico de español.pdf` queda dentro del ZIP como base de consulta local.
- La pestaña Revisar usa una lista local de 27,336 palabras normalizadas y correcciones frecuentes para detectar posibles errores ortográficos, sugerir cambios u omitir palabras.

Total de palabras normalizadas del diccionario local: 27,336.


## Actualización v3

- La hoja abre en blanco por defecto.
- La configuración inicial es Arial 12 con interlineado 1.5.
- Las tablas nuevas se insertan vacías, sin texto predeterminado en las celdas.
- La paleta de color de fuente tiene diseño tipo Word e incluye `#0068FF` y `#FF7D01`.
- La base local de ortografía combina dos PDFs: `Diccionario básico de español.pdf` y `Diccionario de la Lengua Espanola. 1-2-Real Academia Espanola-2014.pdf`.
- El corrector es más conservador para reducir falsos positivos. Sólo sugiere cambios cuando encuentra correcciones frecuentes o una coincidencia cercana en los diccionarios locales.
- Total de palabras normalizadas en `dictionary_words.js`: 33,246.
