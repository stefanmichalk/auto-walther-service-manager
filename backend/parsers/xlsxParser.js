// Parser für report.xlsx (Service-Termine)
import XLSX from 'xlsx';
import { formatKennzeichen } from '../utils/kennzeichenFormatter.js';

export function parseXlsx(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet);
  
  return rows.map(row => ({
    Fahrgestellnr: row['FIN'] || '',
    Kennzeichen: formatKennzeichen(row['Kennzeichen'] || ''),
    Organisation: row['Wartungs-Organisation'] || '',
    Haendler: row['Wartungs-Händler'] || '',
    Faelligkeitsdatum: row['Angepasstes Fälligkeitsdatum'] || row['Normales Fälligkeitsdatum'] || '',
    Bezeichnung: row['Bezeichnung'] || '',
    Details: row['Details'] || '',
    Status: row['Service Plan Status'] || '',
    Name: row['Name'] || '',
    Adresse: row['Adresse'] || '',
    Ort: row['Ort'] || '',
    PLZ: row['PLZ'] || '',
    Telefon: row['Telefon'] || '',
    Handy: row['Handy'] || '',
    Email: row['E-Mail'] || ''
  }));
}

export const XLSX_COLUMNS = [
  'Fahrgestellnr', 'Kennzeichen', 'Faelligkeitsdatum', 
  'Bezeichnung', 'Details', 'Name', 'Ort'
];
