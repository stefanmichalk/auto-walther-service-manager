// Parser für XLSX/CSV Dateien (Service, HU, Inspektion)
import XLSX from 'xlsx';
import { formatKennzeichen } from '../utils/kennzeichenFormatter.js';

// Gemeinsame Hilfsfunktion: XLSX/CSV einlesen und Zeilen zurückgeben
function readXlsxRows(buffer, ext = 'xlsx') {
  let workbook;
  if (ext === 'csv') {
    const csvString = buffer.toString('utf-8');
    workbook = XLSX.read(csvString, { type: 'string', raw: true });
  } else {
    workbook = XLSX.read(buffer, { type: 'buffer' });
  }
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet);
  
  if (rows.length > 0) {
    console.log('XLSX Spalten gefunden:', Object.keys(rows[0]));
    console.log('XLSX erste Zeile:', JSON.stringify(rows[0], null, 2));
  }
  
  return rows;
}

// XLSX-Typ erkennen anhand der Spaltennamen
export function detectXlsxType(buffer, ext = 'xlsx') {
  const rows = readXlsxRows(buffer, ext);
  if (rows.length === 0) return { type: 'unknown', rows };
  
  const cols = Object.keys(rows[0]).map(c => c.toUpperCase());
  
  if (cols.includes('HUDATUM')) return { type: 'hu', rows };
  if (cols.includes('INSPEKTION') || cols.includes('LETZTINSPEKTION')) return { type: 'inspektion', rows };
  if (cols.includes('FIN') || cols.some(c => c.includes('FÄLLIGKEITSDATUM'))) return { type: 'service', rows };
  
  return { type: 'unknown', rows };
}

// Parser für HU-XLSX (gleiche Output-Felder wie huParser.js)
export function parseHuXlsx(rows) {
  return rows.map(row => {
    const get = (key) => (row[key] !== undefined && row[key] !== '') ? String(row[key]) : '';
    
    return {
      KdNr: get('KDNR'),
      Anrede: get('ANREDE'),
      Name: get('NAME1'),
      Nachname: get('NACHNAME'),
      Strasse: get('STRASSE'),
      PLZ: get('PLZ'),
      Ort: get('ORT'),
      Telefon: '',
      Handy: get('HANDY_PRIV'),
      Hersteller: get('HERSTELLER'),
      Fahrgestellnr: get('FAHRGESTELLNUMMER'),
      Modell: get('MODELLTEXT'),
      Kennzeichen: formatKennzeichen(get('KENNZEICHEN')),
      Erstzulassung: get('ERSTZUL'),
      HU_Datum: get('HUDATUM'),
      KmStand: '',
      Filiale: get('FILIALE'),
      AuftragsNr: ''
    };
  }).filter(r => r.Fahrgestellnr);
}

// Parser für Inspektion-XLSX (gleiche Output-Felder wie inspektionParser.js)
export function parseInspektionXlsx(rows) {
  return rows.map(row => {
    const get = (key) => (row[key] !== undefined && row[key] !== '') ? String(row[key]) : '';
    
    return {
      KdNr: get('KDNR'),
      Anrede: get('ANREDE'),
      Name: get('NAME1'),
      Vorname: get('VORNAME'),
      Nachname: get('NACHNAME'),
      Strasse: get('STRASSE'),
      PLZ: get('PLZ'),
      Ort: get('ORT'),
      Telefon: get('TEL_PRIV'),
      Handy: get('HANDY_PRIV'),
      Hersteller: get('HERSTELLER'),
      Fahrgestellnr: get('FAHRGESTELLNUMMER'),
      Kennzeichen: formatKennzeichen(get('KENNZEICHEN')),
      Erstzulassung: get('ERSTZUL'),
      Inspektion: get('INSPEKTION'),
      KmStand: get('KMSTAND'),
      Filiale: get('FILIALE'),
      Vermerk: get('LETZTINSPEKTION') ? `Letzte: ${get('LETZTINSPEKTION')}` : ''
    };
  }).filter(r => r.Fahrgestellnr);
}

// Parser für Service-XLSX/CSV (report.xlsx / report.csv)
export function parseXlsx(buffer, ext = 'xlsx') {
  const rows = readXlsxRows(buffer, ext);
  
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
    
    // Datum von YYYY/MM/DD nach DD.MM.YYYY normalisieren
    const formatDate = (val) => {
      if (!val) return '';
      const s = String(val);
      if (s.match(/^\d{4}\/\d{2}\/\d{2}$/)) {
        const [y, m, d] = s.split('/');
        return `${d}.${m}.${y}`;
      }
      return s;
    };
    
    return {
      Fahrgestellnr: getValue('FIN', 'Fahrgestellnr', 'Fahrgestellnummer', 'VIN'),
      Kennzeichen: formatKennzeichen(getValue('Kennzeichen', 'Kfz-Kennzeichen', 'KFZ') || ''),
      Organisation: getValue('Wartungs-Organisation', 'Organisation'),
      Haendler: getValue('Wartungs-Händler', 'Händler', 'Haendler'),
      Faelligkeitsdatum: formatDate(getValue('Angepasstes Fälligkeitsdatum', 'Normales Fälligkeitsdatum', 'Fälligkeitsdatum', 'Fälligkeit', 'Datum')),
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
