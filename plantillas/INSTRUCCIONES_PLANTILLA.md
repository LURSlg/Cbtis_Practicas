# Plantilla Word rellenable (docxtemplater)

El sistema genera listas de asistencia desde `plantillas/formato_asistencia.docx` usando **docxtemplater**. No uses los "Campos de Word" clásicos (MERGEFIELD); usa **marcadores de texto** con llaves `{ }`.

## 1. Crear la plantilla en Word

1. Abre Microsoft Word y diseña tu formato (encabezado CBTIS, tabla, márgenes, etc.).
2. Donde quieras un dato individual, escribe el marcador **tal cual** (sin espacios extra):

| Marcador en Word | Se reemplaza por |
|------------------|------------------|
| `{especialidad}` | Nombre de la carrera |
| `{periodo}` | Periodo escolar (ej. 25-1) |
| `{grupo}` | Grupo (A, B…) |
| `{turno}` | MATUTINO / VESPERTINO |

3. Para la **lista de alumnos** (bucle), escribe una fila de ejemplo con estos tres marcadores:

```
{#alumnos}{num}. {control} — {nombre}{/alumnos}
```

**Importante:** los tres marcadores `{#alumnos}`, el contenido y `{/alumnos}` deben estar en **el mismo párrafo o la misma celda de tabla**. Si Word los parte en varios runs XML, docxtemplater puede fallar — escríbelos de corrido sin dar formato intermedio.

### Ejemplo de tabla

| No. | Control | Nombre |
|-----|---------|--------|
| `{#alumnos}{num}` | `{control}` | `{nombre}{/alumnos}` |

O en una sola celda:

```
{#alumnos}{num}. {control} — {nombre}
{/alumnos}
```

4. Guarda como **formato_asistencia.docx** en la carpeta `plantillas/` del proyecto.

## 2. Generar plantilla base automáticamente

Si aún no tienes el archivo, ejecuta:

```bash
node scripts/generar-plantilla-word.js
```

Eso crea `plantillas/formato_asistencia.docx` con los marcadores ya colocados.

## 3. Campos individuales vs listas

- **Campo individual (escalar):** `{periodo}` → un solo valor.
- **Lista (array):** `{#alumnos}...{/alumnos}` → repite el bloque por cada alumno.

Datos que envía el servidor (`reportController.js`):

```javascript
{
  especialidad: "Informática",
  periodo: "25-1",
  grupo: "A",
  turno: "MATUTINO",
  alumnos: [
    { num: 1, control: "12345678901234", nombre: "PÉREZ GARCÍA JUAN" },
    { num: 2, control: "...", nombre: "..." }
  ]
}
```

## 4. Errores comunes

| Problema | Solución |
|----------|----------|
| "Multi error" al generar | Marcador partido por Word; reescríbelo sin negritas/cursivas en medio |
| Lista vacía | Verifica `{#alumnos}` y `{/alumnos}` (minúsculas, sin acentos) |
| Archivo no encontrado | Crea `plantillas/formato_asistencia.docx` o corre el script |

## 5. Probar

Desde **Listas de Asistencia** (`lists.html`), filtra alumnos pagados y descarga Word. El archivo debe salir con datos rellenados.
