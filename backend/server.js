import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pdfParse from 'pdf-parse';
import { parseHU } from './parsers/huParser.js';
import { parseInspektion } from './parsers/inspektionParser.js';
import { parseXlsx } from './parsers/xlsxParser.js';
import XLSX from 'xlsx';
import { detectFileType } from './parsers/autoDetect.js';
import dbRoutes from './routes/dbRoutes.js';
import { importParsedData } from './db/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// Multer für File-Upload
const upload = multer({ dest: path.join(__dirname, 'uploads/') });

// Speicher für geparste Daten
let parsedData = {
  hu: [],
  inspektion: [],
  service: [],
  merged: {}
};

// Merge-Funktion: Gruppiert nach Fahrgestellnummer
function mergeByVIN(huRecords, inspRecords, serviceRecords) {
  const merged = {};
  
  // HU-Daten hinzufügen
  for (const record of huRecords) {
    const vin = record.Fahrgestellnr;
    if (!vin) continue;
    
    if (!merged[vin]) {
      merged[vin] = {
        Fahrgestellnr: vin,
        Kennzeichen: record.Kennzeichen,
        Hersteller: record.Hersteller,
        Modell: record.Modell,
        Kunde: {
          Name: record.Name,
          Anrede: record.Anrede,
          Strasse: record.Strasse,
          PLZ: record.PLZ,
          Ort: record.Ort,
          Telefon: record.Telefon
        },
        hu: [],
        inspektion: [],
        service: []
      };
    }
    
    merged[vin].hu.push({
      KdNr: record.KdNr,
      HU_Datum: record.HU_Datum,
      KmStand: record.KmStand,
      Erstzulassung: record.Erstzulassung,
      AuftragsNr: record.AuftragsNr
    });
  }
  
  // Inspektion-Daten hinzufügen
  for (const record of inspRecords) {
    const vin = record.Fahrgestellnr;
    if (!vin) continue;
    
    if (!merged[vin]) {
      merged[vin] = {
        Fahrgestellnr: vin,
        Kennzeichen: record.Kennzeichen,
        Hersteller: record.Hersteller,
        Modell: null,
        Kunde: {
          Name: record.Name,
          Anrede: record.Anrede,
          Strasse: record.Strasse,
          PLZ: record.PLZ,
          Ort: record.Ort,
          Telefon: record.Telefon
        },
        hu: [],
        inspektion: [],
        service: []
      };
    }
    
    merged[vin].inspektion.push({
      KdNr: record.KdNr,
      Inspektion: record.Inspektion,
      KmStand: record.KmStand,
      Erstzulassung: record.Erstzulassung,
      Vermerk: record.Vermerk
    });
  }
  
  // Service-Daten (aus XLSX) hinzufügen
  for (const record of serviceRecords) {
    const vin = record.Fahrgestellnr;
    if (!vin) continue;
    
    if (!merged[vin]) {
      merged[vin] = {
        Fahrgestellnr: vin,
        Kennzeichen: record.Kennzeichen,
        Hersteller: null,
        Modell: null,
        Kunde: {
          Name: record.Name,
          Adresse: record.Adresse,
          PLZ: record.PLZ,
          Ort: record.Ort,
          Telefon: record.Telefon || record.Handy,
          Email: record.Email
        },
        hu: [],
        inspektion: [],
        service: []
      };
    }
    
    merged[vin].service.push({
      Faelligkeitsdatum: record.Faelligkeitsdatum,
      Bezeichnung: record.Bezeichnung,
      Details: record.Details,
      Status: record.Status
    });
  }
  
  return merged;
}

// API: Datei hochladen und parsen (PDF oder XLSX, Auto-Erkennung)
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Keine Datei hochgeladen' });
    }
    
    const filePath = req.file.path;
    const originalName = req.file.originalname;
    const ext = originalName.toLowerCase().split('.').pop();
    const dataBuffer = fs.readFileSync(filePath);
    
    let detectedType;
    let records;
    
    if (ext === 'xlsx' || ext === 'xls') {
      // XLSX verarbeiten
      detectedType = 'service';
      records = parseXlsx(dataBuffer);
      parsedData.service = records;
    } else if (ext === 'pdf') {
      // PDF verarbeiten
      const data = await pdfParse(dataBuffer);
      const text = data.text;
      const lines = text.split('\n').map(l => l.trim()).filter(l => l);
      
      // Auto-Erkennung anhand des Inhalts
      detectedType = detectFileType(originalName, text);
      
      if (detectedType === 'hu') {
        records = parseHU(lines);
        parsedData.hu = records;
      } else if (detectedType === 'inspektion') {
        records = parseInspektion(lines);
        parsedData.inspektion = records;
      } else {
        fs.unlinkSync(filePath);
        return res.status(400).json({ error: 'Dateityp konnte nicht erkannt werden' });
      }
    } else {
      fs.unlinkSync(filePath);
      return res.status(400).json({ error: 'Nur PDF und XLSX Dateien werden unterstützt' });
    }
    
    // Merge aktualisieren
    parsedData.merged = mergeByVIN(parsedData.hu, parsedData.inspektion, parsedData.service);
    
    // Temp-Datei löschen
    fs.unlinkSync(filePath);
    
    res.json({
      success: true,
      type: detectedType,
      filename: originalName,
      recordCount: records.length,
      records: records
    });
    
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// API: Alle geparsten Daten abrufen
app.get('/api/data', (req, res) => {
  res.json(parsedData);
});

// API: Nur HU-Daten
app.get('/api/data/hu', (req, res) => {
  res.json(parsedData.hu);
});

// API: Nur Inspektion-Daten
app.get('/api/data/inspektion', (req, res) => {
  res.json(parsedData.inspektion);
});

// API: Gemergte Daten (nach Fahrgestellnummer)
app.get('/api/data/merged', (req, res) => {
  res.json(parsedData.merged);
});

// API: Reset
app.post('/api/reset', (req, res) => {
  parsedData = { hu: [], inspektion: [], service: [], merged: {} };
  res.json({ success: true });
});

// API: Service-Daten
app.get('/api/data/service', (req, res) => {
  res.json(parsedData.service);
});

// API: Anstehende Termine (sortiert nach Datum)
app.get('/api/termine', (req, res) => {
  const termine = [];
  const today = new Date();
  
  // HU-Termine
  for (const record of parsedData.hu) {
    if (record.HU_Datum) {
      const [day, month, year] = record.HU_Datum.split('.');
      const date = new Date(year, month - 1, day);
      termine.push({
        type: 'HU',
        datum: record.HU_Datum,
        dateObj: date,
        vin: record.Fahrgestellnr,
        kennzeichen: record.Kennzeichen,
        kunde: record.Name,
        details: 'Hauptuntersuchung',
        kmStand: record.KmStand
      });
    }
  }
  
  // Inspektions-Termine
  for (const record of parsedData.inspektion) {
    if (record.Inspektion) {
      const [day, month, year] = record.Inspektion.split('.');
      const date = new Date(year, month - 1, day);
      termine.push({
        type: 'Inspektion',
        datum: record.Inspektion,
        dateObj: date,
        vin: record.Fahrgestellnr,
        kennzeichen: record.Kennzeichen,
        kunde: record.Name,
        details: record.Vermerk || 'Inspektion',
        kmStand: record.KmStand
      });
    }
  }
  
  // Service-Termine (aus XLSX)
  for (const record of parsedData.service) {
    if (record.Faelligkeitsdatum) {
      const parts = record.Faelligkeitsdatum.split('/');
      const date = new Date(parts[0], parts[1] - 1, parts[2]);
      termine.push({
        type: 'Service',
        datum: record.Faelligkeitsdatum,
        dateObj: date,
        vin: record.Fahrgestellnr,
        kennzeichen: record.Kennzeichen,
        kunde: record.Name || '-',
        details: record.Bezeichnung + (record.Details ? ' - ' + record.Details : ''),
        kmStand: null
      });
    }
  }
  
  // Nach Datum sortieren
  termine.sort((a, b) => a.dateObj - b.dateObj);
  
  // dateObj entfernen für JSON
  const result = termine.map(t => {
    const { dateObj, ...rest } = t;
    return rest;
  });
  
  res.json(result);
});

// API: Vollständige Fälligkeitsliste nach VIN gruppiert
app.get('/api/faelligkeiten', (req, res) => {
  const fahrzeuge = {};
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Hilfsfunktion: Datum parsen
  const parseDate = (dateStr) => {
    if (!dateStr) return null;
    if (dateStr.includes('/')) {
      const [y, m, d] = dateStr.split('/');
      return new Date(y, m - 1, d);
    } else if (dateStr.includes('.')) {
      const [d, m, y] = dateStr.split('.');
      return new Date(y, m - 1, d);
    }
    return null;
  };
  
  // Hilfsfunktion: Datum formatieren (DD.MM.YYYY)
  const formatDate = (date) => {
    if (!date) return '-';
    const d = date.getDate().toString().padStart(2, '0');
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const y = date.getFullYear();
    return `${d}.${m}.${y}`;
  };
  
  // Service-Termine aus XLSX (Fälligkeiten laut System)
  for (const record of parsedData.service) {
    const vin = record.Fahrgestellnr;
    if (!vin) continue;
    
    if (!fahrzeuge[vin]) {
      fahrzeuge[vin] = {
        vin,
        kennzeichen: record.Kennzeichen,
        serviceFaellig: null,
        serviceFaelligDate: null,
        serviceBezeichnung: null,
        inspektionTermin: null,
        inspektionTerminDate: null,
        huTermin: null,
        huTerminDate: null,
        kunde: record.Name || null,
        status: 'offen'
      };
    }
    
    const faelligDate = parseDate(record.Faelligkeitsdatum);
    fahrzeuge[vin].serviceFaellig = formatDate(faelligDate);
    fahrzeuge[vin].serviceFaelligDate = faelligDate;
    fahrzeuge[vin].serviceBezeichnung = record.Bezeichnung;
    fahrzeuge[vin].serviceDetails = record.Details;
  }
  
  // Inspektion-Termine (vereinbarte Termine)
  for (const record of parsedData.inspektion) {
    const vin = record.Fahrgestellnr;
    if (!vin) continue;
    
    if (!fahrzeuge[vin]) {
      fahrzeuge[vin] = {
        vin,
        kennzeichen: record.Kennzeichen,
        serviceFaellig: null,
        serviceFaelligDate: null,
        serviceBezeichnung: null,
        inspektionTermin: null,
        inspektionTerminDate: null,
        huTermin: null,
        huTerminDate: null,
        kunde: record.Name,
        status: 'offen'
      };
    }
    
    const terminDate = parseDate(record.Inspektion);
    fahrzeuge[vin].inspektionTermin = record.Inspektion;
    fahrzeuge[vin].inspektionTerminDate = terminDate;
    fahrzeuge[vin].inspektionVermerk = record.Vermerk;
    fahrzeuge[vin].kunde = fahrzeuge[vin].kunde || record.Name;
    fahrzeuge[vin].kmStand = record.KmStand;
  }
  
  // HU-Termine
  for (const record of parsedData.hu) {
    const vin = record.Fahrgestellnr;
    if (!vin) continue;
    
    if (!fahrzeuge[vin]) {
      fahrzeuge[vin] = {
        vin,
        kennzeichen: record.Kennzeichen,
        serviceFaellig: null,
        serviceFaelligDate: null,
        serviceBezeichnung: null,
        inspektionTermin: null,
        inspektionTerminDate: null,
        huTermin: null,
        huTerminDate: null,
        kunde: record.Name,
        status: 'offen'
      };
    }
    
    const terminDate = parseDate(record.HU_Datum);
    fahrzeuge[vin].huTermin = record.HU_Datum;
    fahrzeuge[vin].huTerminDate = terminDate;
    fahrzeuge[vin].kunde = fahrzeuge[vin].kunde || record.Name;
    fahrzeuge[vin].modell = record.Modell;
    fahrzeuge[vin].hersteller = record.Hersteller;
  }
  
  // Status berechnen und nach Datum sortieren
  const result = Object.values(fahrzeuge).map(f => {
    // Prüfe ob Service-Termin vereinbart ist
    if (f.serviceFaelligDate && f.inspektionTerminDate) {
      const diff = Math.abs(f.serviceFaelligDate - f.inspektionTerminDate);
      const daysDiff = diff / (1000 * 60 * 60 * 24);
      if (daysDiff <= 14) {
        f.status = 'vereinbart';
      }
    }
    
    // Nächstes Datum ermitteln
    const dates = [f.serviceFaelligDate, f.inspektionTerminDate, f.huTerminDate].filter(d => d);
    f.nextDate = dates.length > 0 ? new Date(Math.min(...dates.map(d => d.getTime()))) : null;
    
    // Status basierend auf Datum
    if (f.nextDate) {
      const daysUntil = Math.ceil((f.nextDate - today) / (1000 * 60 * 60 * 24));
      if (daysUntil < 0) f.urgency = 'ueberfaellig';
      else if (daysUntil <= 7) f.urgency = 'dringend';
      else if (daysUntil <= 14) f.urgency = 'bald';
      else f.urgency = 'ok';
    }
    
    // Cleanup für JSON
    delete f.serviceFaelligDate;
    delete f.inspektionTerminDate;
    delete f.huTerminDate;
    
    return f;
  });
  
  // Nach nächstem Datum sortieren
  result.sort((a, b) => {
    if (!a.nextDate && !b.nextDate) return 0;
    if (!a.nextDate) return 1;
    if (!b.nextDate) return -1;
    return a.nextDate - b.nextDate;
  });
  
  // nextDate formatieren
  result.forEach(f => {
    f.nextDate = f.nextDate ? formatDate(f.nextDate) : '-';
  });
  
  res.json(result);
});

// API: Excel-Export der Fälligkeiten-Liste
app.get('/api/faelligkeiten/export', async (req, res) => {
  try {
    // Gleiche Logik wie /api/faelligkeiten
    const fahrzeuge = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const parseDate = (dateStr) => {
      if (!dateStr) return null;
      if (dateStr.includes('/')) {
        const [y, m, d] = dateStr.split('/');
        return new Date(y, m - 1, d);
      } else if (dateStr.includes('.')) {
        const [d, m, y] = dateStr.split('.');
        return new Date(y, m - 1, d);
      }
      return null;
    };
    
    const formatDate = (date) => {
      if (!date) return '';
      const d = date.getDate().toString().padStart(2, '0');
      const m = (date.getMonth() + 1).toString().padStart(2, '0');
      const y = date.getFullYear();
      return `${d}.${m}.${y}`;
    };
    
    // Daten sammeln (wie in /api/faelligkeiten)
    for (const record of parsedData.service) {
      const vin = record.Fahrgestellnr;
      if (!vin) continue;
      if (!fahrzeuge[vin]) {
        fahrzeuge[vin] = { vin, kennzeichen: record.Kennzeichen, kunde: record.Name || '', status: 'offen' };
      }
      const faelligDate = parseDate(record.Faelligkeitsdatum);
      fahrzeuge[vin].serviceFaellig = formatDate(faelligDate);
      fahrzeuge[vin].serviceFaelligDate = faelligDate;
      fahrzeuge[vin].serviceBezeichnung = record.Bezeichnung || '';
    }
    
    for (const record of parsedData.inspektion) {
      const vin = record.Fahrgestellnr;
      if (!vin) continue;
      if (!fahrzeuge[vin]) {
        fahrzeuge[vin] = { vin, kennzeichen: record.Kennzeichen, kunde: record.Name, status: 'offen' };
      }
      const terminDate = parseDate(record.Inspektion);
      fahrzeuge[vin].inspektionTermin = record.Inspektion || '';
      fahrzeuge[vin].inspektionTerminDate = terminDate;
      fahrzeuge[vin].inspektionVermerk = record.Vermerk || '';
      fahrzeuge[vin].kunde = fahrzeuge[vin].kunde || record.Name;
      fahrzeuge[vin].kmStand = record.KmStand || '';
    }
    
    for (const record of parsedData.hu) {
      const vin = record.Fahrgestellnr;
      if (!vin) continue;
      if (!fahrzeuge[vin]) {
        fahrzeuge[vin] = { vin, kennzeichen: record.Kennzeichen, kunde: record.Name, status: 'offen' };
      }
      const terminDate = parseDate(record.HU_Datum);
      fahrzeuge[vin].huTermin = record.HU_Datum || '';
      fahrzeuge[vin].huTerminDate = terminDate;
      fahrzeuge[vin].kunde = fahrzeuge[vin].kunde || record.Name;
      fahrzeuge[vin].modell = record.Modell || '';
    }
    
    // Status und Sortierung
    const result = Object.values(fahrzeuge).map(f => {
      if (f.serviceFaelligDate && f.inspektionTerminDate) {
        const diff = Math.abs(f.serviceFaelligDate - f.inspektionTerminDate);
        if (diff / (1000 * 60 * 60 * 24) <= 14) f.status = 'vereinbart';
      }
      const dates = [f.serviceFaelligDate, f.inspektionTerminDate, f.huTerminDate].filter(d => d);
      f.nextDate = dates.length > 0 ? new Date(Math.min(...dates.map(d => d.getTime()))) : null;
      return f;
    });
    
    result.sort((a, b) => {
      if (!a.nextDate && !b.nextDate) return 0;
      if (!a.nextDate) return 1;
      if (!b.nextDate) return -1;
      return a.nextDate - b.nextDate;
    });
    
    // Excel-Daten vorbereiten
    const excelData = result.map(f => ({
      'Status': f.status === 'vereinbart' ? '✓ Vereinbart' : 'Offen',
      'Nächstes Datum': f.nextDate ? formatDate(f.nextDate) : '',
      'Kennzeichen': f.kennzeichen || '',
      'Kunde': f.kunde || '',
      'Service fällig': f.serviceFaellig || '',
      'Service': f.serviceBezeichnung || '',
      'Inspektion Termin': f.inspektionTermin || '',
      'Inspektion Vermerk': f.inspektionVermerk || '',
      'HU Termin': f.huTermin || '',
      'KM-Stand': f.kmStand || '',
      'Modell': f.modell || '',
      'VIN': f.vin
    }));
    
    // Excel erstellen
    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Fälligkeiten');
    
    // Spaltenbreiten
    ws['!cols'] = [
      { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 25 },
      { wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 20 },
      { wch: 12 }, { wch: 10 }, { wch: 30 }, { wch: 20 }
    ];
    
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    
    const filename = `Faelligkeiten_${new Date().toISOString().slice(0,10)}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
    
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Vorhandene Dateien laden (PDFs + XLSX)
app.post('/api/load-existing', async (req, res) => {
  try {
    const pdfsDir = path.join(__dirname, '../pdfs');
    const files = fs.readdirSync(pdfsDir);
    
    // PDFs laden
    const pdfFiles = files.filter(f => f.endsWith('.pdf'));
    for (const file of pdfFiles) {
      const filePath = path.join(pdfsDir, file);
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdfParse(dataBuffer);
      const text = data.text;
      const lines = text.split('\n').map(l => l.trim()).filter(l => l);
      
      const detectedType = detectFileType(file, text);
      if (detectedType === 'hu') {
        parsedData.hu = parseHU(lines);
      } else if (detectedType === 'inspektion') {
        parsedData.inspektion = parseInspektion(lines);
      }
    }
    
    // XLSX laden
    const xlsxFiles = files.filter(f => f.endsWith('.xlsx') || f.endsWith('.xls'));
    for (const file of xlsxFiles) {
      const filePath = path.join(pdfsDir, file);
      const dataBuffer = fs.readFileSync(filePath);
      parsedData.service = parseXlsx(dataBuffer);
    }
    
    parsedData.merged = mergeByVIN(parsedData.hu, parsedData.inspektion, parsedData.service);
    
    res.json({
      success: true,
      hu: parsedData.hu.length,
      inspektion: parsedData.inspektion.length,
      service: parsedData.service.length,
      merged: Object.keys(parsedData.merged).length
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DB Routes einbinden
app.use('/api/db', dbRoutes);

// Daten in DB importieren
app.post('/api/db/import-current', (req, res) => {
  try {
    const stats = importParsedData(parsedData);
    res.json({ success: true, stats });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const PORT = 3222;
app.listen(PORT, () => {
  console.log(`Server läuft auf http://localhost:${PORT}`);
});
