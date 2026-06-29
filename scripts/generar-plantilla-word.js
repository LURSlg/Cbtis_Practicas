/**
 * Genera plantillas/formato_asistencia.docx con marcadores docxtemplater.
 * Ejecutar: node scripts/generar-plantilla-word.js
 */
const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');

const OUT_DIR = path.join(__dirname, '..', 'plantillas');
const OUT_FILE = path.join(OUT_DIR, 'formato_asistencia.docx');

const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:r><w:t xml:space="preserve">CENTRO DE BACHILLERATO TECNOLÓGICO INDUSTRIAL Y DE SERVICIOS</w:t></w:r></w:p>
    <w:p><w:r><w:t xml:space="preserve">LISTA DE ASISTENCIA</w:t></w:r></w:p>
    <w:p><w:r><w:t xml:space="preserve">Especialidad: {especialidad}</w:t></w:r></w:p>
    <w:p><w:r><w:t xml:space="preserve">Periodo: {periodo}    Grupo: {grupo}    Turno: {turno}</w:t></w:r></w:p>
    <w:p><w:r><w:t xml:space="preserve"> </w:t></w:r></w:p>
    <w:p><w:r><w:t xml:space="preserve">ALUMNOS SOLVENTES:</w:t></w:r></w:p>
    <w:p><w:r><w:t xml:space="preserve">{#alumnos}{num}. {control} — {nombre}{/alumnos}</w:t></w:r></w:p>
    <w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>
  </w:body>
</w:document>`;

const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

const wordRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`;

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const zip = new PizZip();
zip.file('[Content_Types].xml', contentTypes);
zip.file('_rels/.rels', rels);
zip.file('word/_rels/document.xml.rels', wordRels);
zip.file('word/document.xml', documentXml);

fs.writeFileSync(OUT_FILE, zip.generate({ type: 'nodebuffer' }));
console.log(`✅ Plantilla creada: ${OUT_FILE}`);
