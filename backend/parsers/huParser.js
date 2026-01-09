// Parser für HU.pdf (Hauptuntersuchung)
// Struktur:
// 1. KdNr (5 Ziffern)
// 2. AnredeName1StraßeLkzPLZOrt (Anrede am ANFANG)
// 3. TelefonModelltext
// 4. HerstellerFahrgestellnrKennzeichenErstzul.HU-DatumKmStandFilialeAuftragsNr

import { formatKennzeichen } from '../utils/kennzeichenFormatter.js';

const MANUFACTURERS = ['MAZDA', 'OPEL', 'FORD', 'SKODA', 'PORSCHE', 'JEEP', 'HYUNDAI', 'CITROEN', 'MERCEDES', 'SEAT', 'VW', 'BMW', 'AUDI', 'TOYOTA', 'NISSAN', 'HONDA', 'RENAULT', 'PEUGEOT', 'FIAT', 'KIA', 'VOLVO', 'MINI', 'SUZUKI', 'DACIA'];

export function parseHU(lines) {
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
    
    // Line 2: Anrede + Name + Straße + PLZ + Ort
    if (i < lines.length && lines[i].match(/^(Herr|Frau|Firma)/)) {
      Object.assign(record, parseHUAddress(lines[i]));
      i++;
    }
    
    // Line 3: Telefon + Modell (oder nur Modell)
    if (i < lines.length && !MANUFACTURERS.some(m => lines[i].startsWith(m))) {
      const phoneLine = lines[i];
      const phoneMatch = phoneLine.match(/^([\d\s\+\-\/\(\)]+)(.*)$/);
      if (phoneMatch && phoneMatch[1].length > 5) {
        record.Telefon = phoneMatch[1].trim();
        record.Modell = phoneMatch[2].trim();
      } else {
        record.Modell = phoneLine;
      }
      i++;
    }
    
    // Line 4: Vehicle data
    if (i < lines.length && MANUFACTURERS.some(m => lines[i].startsWith(m))) {
      Object.assign(record, parseVehicleLine(lines[i], 'HU'));
      i++;
    }
    
    if (Object.keys(record).length > 1) {
      records.push(record);
    }
  }
  
  return records;
}

function parseHUAddress(line) {
  const result = {};
  
  // Anrede am Anfang
  const anredeMatch = line.match(/^(Herr|Frau|Firma)/);
  if (anredeMatch) {
    result.Anrede = anredeMatch[1];
    line = line.substring(anredeMatch[1].length);
  }
  
  // PLZ + Ort am Ende: optional D/DE + 5 Ziffern + Ortsname
  // Das D/DE ist der Ländercode und gehört NICHT zur Hausnummer!
  const plzMatch = line.match(/(.+?)(D|DE)?(\d{5})([A-Za-zÄÖÜäöüß\s\-\.]+)$/);
  if (plzMatch) {
    let nameStreet = plzMatch[1];
    result.Lkz = plzMatch[2];
    result.PLZ = plzMatch[3];
    result.Ort = plzMatch[4].trim();
    
    // Name und Straße trennen - verbesserte Logik
    const houseNumMatch = nameStreet.match(/^(.+?)(\d+[a-zA-Z]?)$/);
    if (houseNumMatch) {
      const beforeNum = houseNumMatch[1];
      const houseNum = houseNumMatch[2];
      
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

function parseVehicleLine(line, type) {
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
  
  // Kennzeichen + Daten
  const match = line.match(/^([A-ZÄÖÜ]{1,3}-?[A-ZÄÖÜ]{0,2}\s*\d+[A-Z]?)(\d{2}\.\d{2}\.\d{4})(\d{2}\.\d{2}\.\d{4})(\d+)(14083)(.*)$/);
  if (match) {
    result.Kennzeichen = formatKennzeichen(match[1].trim());
    result.Erstzulassung = match[2];
    result.HU_Datum = match[3];
    result.KmStand = match[4];
    result.Filiale = match[5];
    if (match[6]) {
      result.AuftragsNr = match[6].trim();
    }
  }
  
  return result;
}

export const HU_COLUMNS = [
  'KdNr', 'Anrede', 'Name', 'Strasse', 'PLZ', 'Ort', 
  'Telefon', 'Modell', 'Hersteller', 'Fahrgestellnr', 
  'Kennzeichen', 'Erstzulassung', 'HU_Datum', 'KmStand', 
  'Filiale', 'AuftragsNr'
];
