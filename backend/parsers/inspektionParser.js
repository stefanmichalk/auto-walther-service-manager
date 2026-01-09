// Parser für Inspektion.pdf
// Struktur:
// 1. KdNr (5 Ziffern)
// 2. Name1StraßeLkzPLZOrtAnrede (Anrede am ENDE)
// 3. Telefonnummern
// 4. HerstellerFahrgestellnrKennzeichenErstzul.InspektionKmStandFilialeVermerk

import { formatKennzeichen } from '../utils/kennzeichenFormatter.js';

const MANUFACTURERS = ['MAZDA', 'OPEL', 'FORD', 'SKODA', 'PORSCHE', 'JEEP', 'HYUNDAI', 'CITROEN', 'MERCEDES', 'SEAT', 'VW', 'BMW', 'AUDI', 'TOYOTA', 'NISSAN', 'HONDA', 'RENAULT', 'PEUGEOT', 'FIAT', 'KIA', 'VOLVO', 'MINI', 'SUZUKI', 'DACIA'];

export function parseInspektion(lines) {
  const records = [];
  let i = 0;
  
  // Skip headers
  while (i < lines.length && !lines[i].match(/^\d{5}$/)) {
    i++;
  }
  
  while (i < lines.length) {
    // Skip non-KdNr lines
    if (!lines[i].match(/^\d{5}$/)) {
      i++;
      continue;
    }
    
    const record = { KdNr: lines[i] };
    i++;
    
    // Line 2: Name + Straße + PLZ + Ort + Anrede (am Ende!)
    if (i < lines.length && lines[i].match(/(Herr|Frau|Firma)$/)) {
      Object.assign(record, parseInspAddress(lines[i]));
      i++;
    }
    
    // Line 3: Telefonnummern
    if (i < lines.length && !MANUFACTURERS.some(m => lines[i].startsWith(m))) {
      // Könnte mehrere Nummern enthalten
      record.Telefon = lines[i].trim();
      i++;
    }
    
    // Line 4: Vehicle data
    if (i < lines.length && MANUFACTURERS.some(m => lines[i].startsWith(m))) {
      Object.assign(record, parseVehicleLine(lines[i]));
      i++;
    }
    
    if (Object.keys(record).length > 1) {
      records.push(record);
    }
  }
  
  return records;
}

function parseInspAddress(line) {
  const result = {};
  
  // Anrede am ENDE
  const anredeMatch = line.match(/(Herr|Frau|Firma)$/);
  if (anredeMatch) {
    result.Anrede = anredeMatch[1];
    line = line.substring(0, line.length - anredeMatch[1].length);
  }
  
  // PLZ + Ort: optional D/DE + 5 Ziffern + Ortsname
  // Das D/DE ist der Ländercode und gehört NICHT zur Hausnummer!
  const plzMatch = line.match(/(.+?)(D|DE)?(\d{5})([A-Za-zÄÖÜäöüß\s\-\.]+)$/);
  if (plzMatch) {
    let nameStreet = plzMatch[1];
    result.Lkz = plzMatch[2];
    result.PLZ = plzMatch[3];
    result.Ort = plzMatch[4].trim();
    
    // Name und Straße trennen - verbesserte Logik
    // Suche Hausnummer am Ende (Zahl, optional mit Buchstabe)
    const houseNumMatch = nameStreet.match(/^(.+?)(\d+[a-zA-Z]?)$/);
    if (houseNumMatch) {
      const beforeNum = houseNumMatch[1];
      const houseNum = houseNumMatch[2];
      
      // Finde wo der Straßenname beginnt
      // Bei Firmen: Nach "e.K.", "GmbH", etc.
      const firmaMatch = beforeNum.match(/^(.+?(?:e\.K\.|GmbH|AG|KG|OHG|UG|mbH)\s*)(.+)$/i);
      if (firmaMatch) {
        result.Name = firmaMatch[1].trim();
        result.Strasse = firmaMatch[2].trim() + ' ' + houseNum;
      } else {
        // Bei Personen: Übergang von Kleinbuchstabe zu Großbuchstabe
        let splitIdx = -1;
        for (let k = beforeNum.length - 1; k > 0; k--) {
          if (/[a-zäöü]/.test(beforeNum[k]) && /[A-ZÄÖÜ]/.test(beforeNum[k + 1])) {
            splitIdx = k + 1;
            break;
          }
        }
        
        if (splitIdx > 0) {
          result.Name = beforeNum.substring(0, splitIdx).trim();
          result.Strasse = beforeNum.substring(splitIdx).trim() + ' ' + houseNum;
        } else {
          // Fallback: Alles ist Name
          result.Name = beforeNum.trim();
          result.Strasse = houseNum;
        }
      }
    } else {
      result.Name = nameStreet.trim();
    }
  }
  
  return result;
}

function parseVehicleLine(line) {
  const result = {};
  
  // Hersteller
  for (const mfr of MANUFACTURERS) {
    if (line.startsWith(mfr)) {
      result.Hersteller = mfr;
      line = line.substring(mfr.length);
      break;
    }
  }
  
  if (!result.Hersteller) return {};
  
  // VIN (17 Zeichen)
  result.Fahrgestellnr = line.substring(0, 17);
  line = line.substring(17);
  
  // Kennzeichen + Daten + Vermerk
  const match = line.match(/^([A-ZÄÖÜ]{1,3}-?[A-ZÄÖÜ]{0,2}\s*\d+[A-Z]?)(\d{2}\.\d{2}\.\d{4})(\d{2}\.\d{2}\.\d{4})(\d+)(14083)(.*)$/);
  if (match) {
    result.Kennzeichen = formatKennzeichen(match[1].trim());
    result.Erstzulassung = match[2];
    result.Inspektion = match[3];
    result.KmStand = match[4];
    result.Filiale = match[5];
    if (match[6]) {
      result.Vermerk = match[6].trim();
    }
  }
  
  return result;
}

export const INSP_COLUMNS = [
  'KdNr', 'Anrede', 'Name', 'Strasse', 'PLZ', 'Ort', 
  'Telefon', 'Hersteller', 'Fahrgestellnr', 
  'Kennzeichen', 'Erstzulassung', 'Inspektion', 'KmStand', 
  'Filiale', 'Vermerk'
];
