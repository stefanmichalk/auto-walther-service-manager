import XLSX from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const xlsxPath = path.join(__dirname, '../../pdfs/report.xlsx');

const workbook = XLSX.readFile(xlsxPath);

console.log('Sheets:', workbook.SheetNames);

for (const sheetName of workbook.SheetNames) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Sheet: ${sheetName}`);
  console.log('='.repeat(60));
  
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  
  // Header
  if (data.length > 0) {
    console.log('\nHeader:', data[0]);
  }
  
  // First 5 rows
  console.log('\nFirst 5 data rows:');
  data.slice(1, 6).forEach((row, i) => {
    console.log(`[${i+1}]`, row);
  });
  
  console.log(`\nTotal rows: ${data.length}`);
}
