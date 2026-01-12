// Parser für report.xlsx (Service-Termine)
import XLSX from 'xlsx';
import { formatKennzeichen } from '../utils/kennzeichenFormatter.js';

export function parseXlsx(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet);
  
  // Debug: Log erste Zeile um Spaltennamen zu sehen
  if (rows.length > 0) {
    console.log('XLSX Spalten gefunden:', Object.keys(rows[0]));
    console.log('XLSX erste Zeile:', JSON.stringify(rows[0], null, 2));
  }
  
  return rows.map(row => {
    // Flexibler Spalten-Lookup (case-insensitive, mit Varianten)
    const getValue = (...keys) => {
      for (const key of keys) {
        // Exakter Match
        if (row[key] !== undefined && row[key] !== '') return row[key];
        // Case-insensitive Match
        const found = Object.keys(row).find(k => k.toLowerCase() === key.toLowerCase());
        if (found && row[found] !== undefined && row[found] !== '') return row[found];
      }
      return '';
    };
    
    return {
      Fahrgestellnr: getValue('FIN', 'Fahrgestellnr', 'Fahrgestellnummer', 'VIN'),
      Kennzeichen: formatKennzeichen(getValue('Kennzeichen', 'Kfz-Kennzeichen', 'KFZ') || ''),
      Organisation: getValue('Wartungs-Organisation', 'Organisation'),
      Haendler: getValue('Wartungs-Händler', 'Händler', 'Haendler'),
      Faelligkeitsdatum: getValue('Angepasstes Fälligkeitsdatum', 'Normales Fälligkeitsdatum', 'Fälligkeitsdatum', 'Fälligkeit', 'Datum'),
      Bezeichnung: getValue('Bezeichnung', 'Service', 'Typ'),
      Details: getValue('Details', 'Bemerkung', 'Notizen'),
      Status: getValue('Service Plan Status', 'Status'),
      Name: getValue('Name', 'Kunde', 'Kundenname', 'Halter'),
      Adresse: getValue('Adresse', 'Straße', 'Strasse', 'Anschrift'),
      Ort: getValue('Ort', 'Stadt', 'Wohnort'),
      PLZ: getValue('PLZ', 'Postleitzahl'),
      Telefon: getValue('Telefon', 'Tel', 'Festnetz'),
      Handy: getValue('Handy', 'Mobil', 'Mobiltelefon'),
      Email: getValue('E-Mail', 'Email', 'Mail')
    };
  });
}

export const XLSX_COLUMNS = [
  'Fahrgestellnr', 'Kennzeichen', 'Faelligkeitsdatum', 
  'Bezeichnung', 'Details', 'Name', 'Ort'
];
