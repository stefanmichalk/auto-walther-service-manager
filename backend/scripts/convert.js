import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pdfParse from 'pdf-parse';
import { parseHU, HU_COLUMNS } from '../parsers/huParser.js';
import { parseInspektion, INSP_COLUMNS } from '../parsers/inspektionParser.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pdfsDir = path.join(__dirname, '../../pdfs');
const outputDir = path.join(__dirname, '../../extracted');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

function toCsv(records, columns) {
  if (records.length === 0) return '';
  
  const csvLines = [columns.join(';')];
  
  for (const record of records) {
    const values = columns.map(col => {
      const val = String(record[col] || '');
      if (val.includes(';') || val.includes('"') || val.includes('\n')) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    });
    csvLines.push(values.join(';'));
  }
  
  return csvLines.join('\n');
}

async function processFile(filename) {
  const filePath = path.join(pdfsDir, filename);
  const dataBuffer = fs.readFileSync(filePath);
  const data = await pdfParse(dataBuffer);
  const lines = data.text.split('\n').map(l => l.trim()).filter(l => l);
  
  const isHU = filename.toLowerCase().includes('hu');
  const parser = isHU ? parseHU : parseInspektion;
  const columns = isHU ? HU_COLUMNS : INSP_COLUMNS;
  
  const records = parser(lines);
  
  // Save CSV
  const csv = toCsv(records, columns);
  const baseName = path.basename(filename, '.pdf');
  const csvPath = path.join(outputDir, `${baseName}.csv`);
  fs.writeFileSync(csvPath, '\ufeff' + csv, 'utf-8'); // BOM for Excel
  
  // Save JSON
  const jsonPath = path.join(outputDir, `${baseName}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(records, null, 2));
  
  return { filename, records, csvPath, jsonPath };
}

async function main() {
  console.log('PDF to CSV Converter\n');
  
  const pdfFiles = fs.readdirSync(pdfsDir).filter(f => f.endsWith('.pdf'));
  console.log(`Found ${pdfFiles.length} PDFs\n`);
  
  for (const file of pdfFiles) {
    console.log(`━━━ ${file} ━━━`);
    
    try {
      const result = await processFile(file);
      console.log(`✓ ${result.records.length} Datensätze extrahiert`);
      console.log(`  → ${result.csvPath}`);
      console.log(`  → ${result.jsonPath}`);
      
      // Zeige Beispiele
      console.log('\nBeispiel-Datensätze:');
      result.records.slice(0, 3).forEach((r, i) => {
        console.log(`  [${i+1}] ${r.Name} | ${r.Kennzeichen} | ${r.HU_Datum || r.Inspektion}`);
      });
      console.log('');
      
    } catch (err) {
      console.error(`✗ Fehler: ${err.message}`);
    }
  }
}

main();
