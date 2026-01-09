import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pdfParse from 'pdf-parse';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pdfsDir = path.join(__dirname, '../../pdfs');
const outputDir = path.join(__dirname, '../../extracted');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Parse HU.pdf structure
function parseHU(text) {
  const lines = text.split('\n').filter(l => l.trim());
  const records = [];
  
  // Skip header lines
  let i = 0;
  while (i < lines.length && !lines[i].match(/^\d{5}$/)) {
    i++;
  }
  
  while (i < lines.length) {
    const record = {};
    
    // Line 1: KdNr (5 digits)
    if (lines[i] && lines[i].match(/^\d{5}$/)) {
      record.KdNr = lines[i].trim();
      i++;
    } else {
      i++;
      continue;
    }
    
    // Line 2: Anrede + Name + Straße + Lkz + PLZ + Ort
    if (lines[i]) {
      const addressLine = lines[i];
      // Pattern: Herr/Frau/Firma + Name + Street + DE/D + PLZ + Ort
      const match = addressLine.match(/^(Herr|Frau|Firma)(.+?)([A-Z]?\d{5})(.+)$/);
      if (match) {
        record.Anrede = match[1];
        const rest = match[2].trim();
        record.PLZ = match[3];
        record.Ort = match[4].trim();
        
        // Try to split name and street
        const streetMatch = rest.match(/^(.+?)((?:Str\.|Straße|straße|weg|Weg|platz|Platz|ring|Ring|gasse|allee|Allee|\d+[a-z]?\s*$).*)$/i);
        if (streetMatch) {
          record.Name = streetMatch[1].trim();
          record.Strasse = streetMatch[2].trim();
        } else {
          record.Name = rest;
          record.Strasse = '';
        }
      } else {
        record.Anrede = '';
        record.Name = addressLine;
      }
      i++;
    }
    
    // Line 3: Telefon data + Modelltext (sometimes combined)
    if (lines[i]) {
      // This line often contains phone numbers and model text
      const phoneLine = lines[i];
      record.Telefon = '';
      record.Modell = phoneLine.trim();
      i++;
    }
    
    // Line 4: Hersteller + Fahrgestellnr + Kennzeichen + Dates + KmStand + Filiale
    if (lines[i]) {
      const dataLine = lines[i];
      // Pattern: HERSTELLER + VIN + Kennzeichen + Erstzul + HU-Datum + KmStand + Filiale
      const vinMatch = dataLine.match(/^([A-Z]+)([A-Z0-9]{17})([A-Z]{1,3}-[A-Z]{1,3}\s*\d+)(\d{2}\.\d{2}\.\d{4})(\d{2}\.\d{2}\.\d{4})(\d+)(\d{5})(.*)$/);
      if (vinMatch) {
        record.Hersteller = vinMatch[1];
        record.Fahrgestellnr = vinMatch[2];
        record.Kennzeichen = vinMatch[3].trim();
        record.Erstzulassung = vinMatch[4];
        record.HU_Datum = vinMatch[5];
        record.KmStand = vinMatch[6];
        record.Filiale = vinMatch[7];
        record.AuftragsNr = vinMatch[8] || '';
      } else {
        record.RawData = dataLine;
      }
      i++;
    }
    
    if (Object.keys(record).length > 1) {
      records.push(record);
    }
  }
  
  return records;
}

// Parse Inspektion.pdf structure
function parseInspektion(text) {
  const lines = text.split('\n').filter(l => l.trim());
  const records = [];
  
  let i = 0;
  while (i < lines.length && !lines[i].match(/^\d{5}$/)) {
    i++;
  }
  
  while (i < lines.length) {
    const record = {};
    
    // Line 1: KdNr
    if (lines[i] && lines[i].match(/^\d{5}$/)) {
      record.KdNr = lines[i].trim();
      i++;
    } else {
      i++;
      continue;
    }
    
    // Line 2: Name + Adresse + Anrede
    if (lines[i]) {
      const addressLine = lines[i];
      const match = addressLine.match(/^(.+?)([A-Z]?\d{5})(.+?)(Herr|Frau|Firma)$/);
      if (match) {
        const nameStreet = match[1].trim();
        record.PLZ = match[2];
        record.Ort = match[3].trim();
        record.Anrede = match[4];
        
        // Split name and street
        const streetIdx = nameStreet.search(/\d/);
        if (streetIdx > 0) {
          record.Name = nameStreet.substring(0, streetIdx).replace(/([a-z])([A-Z])/g, '$1 $2').trim();
          record.Strasse = nameStreet.substring(streetIdx - nameStreet.substring(0, streetIdx).split('').reverse().join('').search(/[A-Z]/)).trim();
        } else {
          record.Name = nameStreet;
        }
      }
      i++;
    }
    
    // Line 3: Phone numbers
    if (lines[i]) {
      record.Telefon = lines[i].trim();
      i++;
    }
    
    // Line 4: Vehicle data
    if (lines[i]) {
      const dataLine = lines[i];
      const vinMatch = dataLine.match(/^([A-Z]+)([A-Z0-9]{17})([A-Z]{1,3}-[A-Z]{1,3}\s*\d+[A-Z]?)(\d{2}\.\d{2}\.\d{4})(\d{2}\.\d{2}\.\d{4})(\d+)(\d{5})(.*)$/);
      if (vinMatch) {
        record.Hersteller = vinMatch[1];
        record.Fahrgestellnr = vinMatch[2];
        record.Kennzeichen = vinMatch[3].trim();
        record.Erstzulassung = vinMatch[4];
        record.Inspektion = vinMatch[5];
        record.KmStand = vinMatch[6];
        record.Filiale = vinMatch[7];
        record.Vermerk = vinMatch[8] || '';
      } else {
        record.RawData = dataLine;
      }
      i++;
    }
    
    if (Object.keys(record).length > 1) {
      records.push(record);
    }
  }
  
  return records;
}

// Alternative: Line-by-line parsing with better pattern matching
function parseStructured(text, type) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  const records = [];
  let currentRecord = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // New record starts with 5-digit KdNr
    if (/^\d{5}$/.test(line)) {
      if (currentRecord && Object.keys(currentRecord).length > 1) {
        records.push(currentRecord);
      }
      currentRecord = { KdNr: line };
      continue;
    }
    
    if (!currentRecord) continue;
    
    // VIN pattern (17 chars alphanumeric starting with specific letters)
    const vinPattern = /([A-Z]{2,10})([A-HJ-NPR-Z0-9]{17})/;
    const vinMatch = line.match(vinPattern);
    
    if (vinMatch) {
      currentRecord.Hersteller = vinMatch[1];
      currentRecord.Fahrgestellnr = vinMatch[2];
      
      // Extract rest of the line after VIN
      const afterVin = line.substring(line.indexOf(vinMatch[2]) + 17);
      
      // Kennzeichen pattern
      const kennzeichenMatch = afterVin.match(/^([A-ZÄÖÜ]{1,3}-[A-ZÄÖÜ]{1,2}\s*\d+[A-Z]?)/);
      if (kennzeichenMatch) {
        currentRecord.Kennzeichen = kennzeichenMatch[1].trim();
        
        // Dates pattern (DD.MM.YYYY)
        const datesMatch = afterVin.match(/(\d{2}\.\d{2}\.\d{4})(\d{2}\.\d{2}\.\d{4})/);
        if (datesMatch) {
          currentRecord.Erstzulassung = datesMatch[1];
          currentRecord[type === 'HU' ? 'HU_Datum' : 'Inspektion'] = datesMatch[2];
          
          // KmStand and rest
          const afterDates = afterVin.substring(afterVin.indexOf(datesMatch[2]) + 10);
          const kmMatch = afterDates.match(/^(\d+)(\d{5})(.*)$/);
          if (kmMatch) {
            currentRecord.KmStand = kmMatch[1];
            currentRecord.Filiale = kmMatch[2];
            if (kmMatch[3]) {
              currentRecord.Vermerk = kmMatch[3].trim();
            }
          }
        }
      }
      continue;
    }
    
    // Address line pattern
    if (line.match(/(Herr|Frau|Firma)/) && !currentRecord.Name) {
      const anredeMatch = line.match(/(Herr|Frau|Firma)/);
      if (anredeMatch) {
        currentRecord.Anrede = anredeMatch[1];
        
        // PLZ pattern
        const plzMatch = line.match(/[D]?(\d{5})([A-Za-zÄÖÜäöüß\s\-\.]+)$/);
        if (plzMatch) {
          currentRecord.PLZ = plzMatch[1];
          currentRecord.Ort = plzMatch[2].trim();
          
          // Name is between Anrede and street number
          const beforePlz = line.substring(0, line.indexOf(plzMatch[1]) - 1).trim();
          const afterAnrede = beforePlz.substring(beforePlz.indexOf(anredeMatch[1]) + anredeMatch[1].length).trim();
          
          // Find where street starts (usually before a number)
          const streetNumMatch = afterAnrede.match(/(.+?)(\d+[a-zA-Z]?\s*)$/);
          if (streetNumMatch) {
            const nameStreet = streetNumMatch[1];
            const streetNum = streetNumMatch[2];
            
            // Try to separate name from street
            const commonStreetWords = /(Str\.|Straße|straße|weg|Weg|platz|Platz|ring|Ring|gasse|Gasse|allee|Allee|damm|Damm)/;
            const streetWordMatch = nameStreet.match(commonStreetWords);
            if (streetWordMatch) {
              const streetWordIdx = nameStreet.indexOf(streetWordMatch[0]);
              // Find where the street name starts (capital letter before street word)
              let nameEnd = streetWordIdx;
              for (let j = streetWordIdx - 1; j >= 0; j--) {
                if (nameStreet[j] === ' ') {
                  nameEnd = j;
                  break;
                }
                if (nameStreet[j].match(/[A-ZÄÖÜ]/) && j > 0 && nameStreet[j-1].match(/[a-zäöü]/)) {
                  nameEnd = j;
                  break;
                }
              }
              currentRecord.Name = nameStreet.substring(0, nameEnd).trim();
              currentRecord.Strasse = nameStreet.substring(nameEnd).trim() + streetNum;
            } else {
              currentRecord.Name = nameStreet;
              currentRecord.Strasse = streetNum;
            }
          }
        }
      }
      continue;
    }
    
    // Model/vehicle description (contains engine specs, etc.)
    if (line.match(/\d+PS|\d\.\d[l]|SKYACTIV|TDI|MZR|AWD|FWD/i) && !currentRecord.Modell) {
      currentRecord.Modell = line;
      continue;
    }
    
    // Phone numbers
    if (line.match(/^[\d\s\+\-\/]+$/) && line.length > 5 && !currentRecord.Telefon) {
      currentRecord.Telefon = line;
    }
  }
  
  // Don't forget last record
  if (currentRecord && Object.keys(currentRecord).length > 1) {
    records.push(currentRecord);
  }
  
  return records;
}

function toCsv(records, filename) {
  if (records.length === 0) return '';
  
  // Get all unique keys
  const allKeys = new Set();
  records.forEach(r => Object.keys(r).forEach(k => allKeys.add(k)));
  const headers = Array.from(allKeys);
  
  // Create CSV
  const csvLines = [headers.join(';')];
  
  for (const record of records) {
    const values = headers.map(h => {
      const val = record[h] || '';
      // Escape semicolons and quotes
      if (val.includes(';') || val.includes('"') || val.includes('\n')) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    });
    csvLines.push(values.join(';'));
  }
  
  return csvLines.join('\n');
}

async function main() {
  const pdfFiles = fs.readdirSync(pdfsDir).filter(f => f.endsWith('.pdf'));
  
  for (const pdfFile of pdfFiles) {
    const filePath = path.join(pdfsDir, pdfFile);
    console.log(`\nProcessing: ${pdfFile}`);
    
    try {
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdfParse(dataBuffer);
      
      const type = pdfFile.includes('HU') ? 'HU' : 'Inspektion';
      const records = parseStructured(data.text, type);
      
      console.log(`Extracted ${records.length} records`);
      
      // Save CSV
      const csv = toCsv(records, pdfFile);
      const csvPath = path.join(outputDir, `${path.basename(pdfFile, '.pdf')}.csv`);
      fs.writeFileSync(csvPath, csv, 'utf-8');
      console.log(`Saved: ${csvPath}`);
      
      // Also save JSON for debugging
      const jsonPath = path.join(outputDir, `${path.basename(pdfFile, '.pdf')}_structured.json`);
      fs.writeFileSync(jsonPath, JSON.stringify(records, null, 2));
      
      // Show first 3 records
      console.log('\nFirst 3 records:');
      records.slice(0, 3).forEach((r, i) => {
        console.log(`\n[${i + 1}]`, JSON.stringify(r, null, 2));
      });
      
    } catch (error) {
      console.error(`Error: ${error.message}`);
    }
  }
}

main();
