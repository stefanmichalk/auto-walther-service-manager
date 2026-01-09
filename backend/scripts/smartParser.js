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

// Patterns
const PATTERNS = {
  kdnr: /^(\d{5})$/,
  plz: /[D]?[E]?(\d{5})/g,
  date: /(\d{2}\.\d{2}\.\d{4})/g,
  vin: /([A-HJ-NPR-Z0-9]{17})/,  // VIN is 17 chars, excludes I, O, Q
  kennzeichen: /([A-ZÄÖÜ]{1,3}-[A-ZÄÖÜ]{1,3}\s*\d+[A-Z]?)/,
  anrede: /^(Herr|Frau|Firma)/,
  phone: /^[\d\s\+\-\/\(\)]+$/,
};

// Known car manufacturers for better VIN detection
const MANUFACTURERS = ['MAZDA', 'OPEL', 'FORD', 'SKODA', 'PORSCHE', 'JEEP', 'HYUNDAI', 'CITROEN', 'MERCEDES', 'SEAT', 'VW', 'BMW', 'AUDI'];

function parseDataLine(line) {
  // This line contains: Hersteller + VIN + Kennzeichen + Erstzul + HU/Insp-Datum + KmStand + Filiale + optional
  const result = {};
  
  // Find manufacturer at start
  for (const mfr of MANUFACTURERS) {
    if (line.startsWith(mfr)) {
      result.Hersteller = mfr;
      line = line.substring(mfr.length);
      break;
    }
  }
  
  // VIN is next 17 characters
  if (line.length >= 17) {
    result.Fahrgestellnr = line.substring(0, 17);
    line = line.substring(17);
  }
  
  // Kennzeichen pattern
  const kennMatch = line.match(/^([A-ZÄÖÜ]{1,3}-[A-ZÄÖÜ]{1,3}\s*\d+[A-Z]?)/);
  if (kennMatch) {
    result.Kennzeichen = kennMatch[1].trim();
    line = line.substring(kennMatch[0].length);
  }
  
  // Two dates (Erstzulassung + HU/Inspektion)
  const dates = line.match(/(\d{2}\.\d{2}\.\d{4})/g);
  if (dates && dates.length >= 2) {
    result.Erstzulassung = dates[0];
    result.Datum2 = dates[1];  // HU or Inspektion
    
    // Find position after second date
    const dateEnd = line.lastIndexOf(dates[1]) + dates[1].length;
    line = line.substring(dateEnd);
  }
  
  // Remaining: KmStand (variable length) + Filiale (5 digits) + optional AuftragsNr/Vermerk
  // Filiale is always 14083 in these examples
  const filialeMatch = line.match(/(\d+)(14083)(.*)$/);
  if (filialeMatch) {
    result.KmStand = filialeMatch[1];
    result.Filiale = filialeMatch[2];
    if (filialeMatch[3]) {
      result.Extra = filialeMatch[3].trim();
    }
  } else {
    // Try other pattern
    const numMatch = line.match(/^(\d+)$/);
    if (numMatch) {
      // Could be just KmStand
      result.KmStand = numMatch[1];
    }
  }
  
  return result;
}

function parseAddressLine(line) {
  const result = {};
  
  // Extract Anrede
  const anredeMatch = line.match(/^(Herr|Frau|Firma)/);
  if (anredeMatch) {
    result.Anrede = anredeMatch[1];
    line = line.substring(anredeMatch[1].length);
  }
  
  // Find PLZ pattern (D or DE prefix + 5 digits)
  const plzMatch = line.match(/([D]?[E]?)(\d{5})([A-Za-zÄÖÜäöüß\s\-\.]+)$/);
  if (plzMatch) {
    result.Lkz = plzMatch[1] || 'D';
    result.PLZ = plzMatch[2];
    result.Ort = plzMatch[3].trim();
    
    // Everything before PLZ is Name + Street
    const beforePlz = line.substring(0, line.indexOf(plzMatch[1] + plzMatch[2])).trim();
    
    // Find street by looking for common patterns or house numbers
    // Street usually ends with a number
    const streetMatch = beforePlz.match(/^(.+?)([A-ZÄÖÜ][a-zäöüß]+(?:straße|str\.|weg|platz|ring|gasse|allee|damm|hof|steig|weg|pfad)[a-zäöüß]*\s*\d+[a-z]?)$/i);
    
    if (streetMatch) {
      result.Name = streetMatch[1].trim();
      result.Strasse = streetMatch[2].trim();
    } else {
      // Try to find where name ends and street begins by looking for house number pattern at end
      const houseNumMatch = beforePlz.match(/^(.+?)\s+(\d+[a-z]?)$/i);
      if (houseNumMatch) {
        // Find the last capital letter sequence that could be street start
        const nameAndStreet = houseNumMatch[1];
        const houseNum = houseNumMatch[2];
        
        // Look for street keywords
        const streetKeywords = /(Str\.|Straße|straße|weg|Weg|platz|Platz|ring|Ring|gasse|Gasse|allee|Allee|damm|Damm|steig|Steig|hof|Hof|pfad|Pfad)/i;
        const keywordMatch = nameAndStreet.match(streetKeywords);
        
        if (keywordMatch) {
          // Find where this street word starts
          const idx = nameAndStreet.indexOf(keywordMatch[0]);
          // Go back to find the start of the street name (capital letter)
          let streetStart = idx;
          for (let j = idx - 1; j >= 0; j--) {
            if (nameAndStreet[j] === ' ') {
              streetStart = j + 1;
              break;
            }
            // If we hit a lowercase followed by uppercase, that's likely the boundary
            if (j > 0 && nameAndStreet[j].match(/[A-ZÄÖÜ]/) && nameAndStreet[j-1].match(/[a-zäöü]/)) {
              streetStart = j;
              break;
            }
          }
          
          result.Name = nameAndStreet.substring(0, streetStart).trim();
          result.Strasse = nameAndStreet.substring(streetStart).trim() + ' ' + houseNum;
        } else {
          // No clear street keyword, use heuristic
          result.Name = nameAndStreet;
          result.Strasse = houseNum;
        }
      } else {
        // Fallback: use entire string as name
        result.Name = beforePlz;
      }
    }
  }
  
  return result;
}

function parseRecords(lines, type) {
  const records = [];
  let i = 0;
  
  // Skip header lines
  while (i < lines.length && !lines[i].match(/^\d{5}$/)) {
    i++;
  }
  
  while (i < lines.length) {
    // Check for KdNr
    if (!lines[i].match(/^\d{5}$/)) {
      i++;
      continue;
    }
    
    const record = { KdNr: lines[i] };
    i++;
    
    // Next line should be address (starts with Anrede)
    if (i < lines.length && lines[i].match(/^(Herr|Frau|Firma)/)) {
      const addressData = parseAddressLine(lines[i]);
      Object.assign(record, addressData);
      i++;
    }
    
    // Next could be phone/model line or vehicle data line
    if (i < lines.length) {
      const currentLine = lines[i];
      
      // Check if it's vehicle data line (starts with manufacturer)
      const isVehicleData = MANUFACTURERS.some(m => currentLine.startsWith(m));
      
      if (!isVehicleData) {
        // It's phone/model info
        // Check if it starts with phone number
        const phoneMatch = currentLine.match(/^([\d\s\+\-\/\(\)]+)/);
        if (phoneMatch && phoneMatch[1].length > 5) {
          record.Telefon = phoneMatch[1].trim();
          record.Modell = currentLine.substring(phoneMatch[1].length).trim();
        } else {
          record.Modell = currentLine;
        }
        i++;
      }
    }
    
    // Vehicle data line
    if (i < lines.length) {
      const vehicleData = parseDataLine(lines[i]);
      Object.assign(record, vehicleData);
      
      // Rename Datum2 based on type
      if (record.Datum2) {
        if (type === 'HU') {
          record.HU_Datum = record.Datum2;
        } else {
          record.Inspektion = record.Datum2;
        }
        delete record.Datum2;
      }
      i++;
    }
    
    records.push(record);
  }
  
  return records;
}

function toCsv(records, columns) {
  if (records.length === 0) return '';
  
  // Use specified columns or all unique keys
  const headers = columns || [...new Set(records.flatMap(r => Object.keys(r)))];
  
  const csvLines = [headers.join(';')];
  
  for (const record of records) {
    const values = headers.map(h => {
      const val = String(record[h] || '');
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
  
  const huColumns = ['KdNr', 'Anrede', 'Name', 'Strasse', 'PLZ', 'Ort', 'Telefon', 'Modell', 'Hersteller', 'Fahrgestellnr', 'Kennzeichen', 'Erstzulassung', 'HU_Datum', 'KmStand', 'Filiale', 'Extra'];
  const inspColumns = ['KdNr', 'Anrede', 'Name', 'Strasse', 'PLZ', 'Ort', 'Telefon', 'Modell', 'Hersteller', 'Fahrgestellnr', 'Kennzeichen', 'Erstzulassung', 'Inspektion', 'KmStand', 'Filiale', 'Extra'];
  
  for (const pdfFile of pdfFiles) {
    const filePath = path.join(pdfsDir, pdfFile);
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Processing: ${pdfFile}`);
    console.log('='.repeat(60));
    
    try {
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdfParse(dataBuffer);
      const lines = data.text.split('\n').map(l => l.trim()).filter(l => l);
      
      const type = pdfFile.includes('HU') ? 'HU' : 'Inspektion';
      const records = parseRecords(lines, type);
      
      console.log(`\nExtracted ${records.length} records`);
      
      // Save CSV
      const columns = type === 'HU' ? huColumns : inspColumns;
      const csv = toCsv(records, columns);
      const csvPath = path.join(outputDir, `${path.basename(pdfFile, '.pdf')}.csv`);
      fs.writeFileSync(csvPath, '\ufeff' + csv, 'utf-8'); // BOM for Excel
      console.log(`Saved: ${csvPath}`);
      
      // Save JSON
      const jsonPath = path.join(outputDir, `${path.basename(pdfFile, '.pdf')}_clean.json`);
      fs.writeFileSync(jsonPath, JSON.stringify(records, null, 2));
      console.log(`Saved: ${jsonPath}`);
      
      // Print sample
      console.log('\n--- Sample Records ---');
      records.slice(0, 5).forEach((r, idx) => {
        console.log(`\n[${idx + 1}] ${r.Name || 'N/A'}`);
        console.log(`    Kennzeichen: ${r.Kennzeichen || 'N/A'}`);
        console.log(`    Fahrzeug: ${r.Hersteller || ''} - ${r.Modell || 'N/A'}`);
        console.log(`    ${type === 'HU' ? 'HU-Datum' : 'Inspektion'}: ${r.HU_Datum || r.Inspektion || 'N/A'}`);
        console.log(`    KmStand: ${r.KmStand || 'N/A'}`);
      });
      
    } catch (error) {
      console.error(`Error: ${error.message}`);
      console.error(error.stack);
    }
  }
}

main();
