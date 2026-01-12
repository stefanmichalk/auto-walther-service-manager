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
      // +49 durch 0 ersetzen
      let allNumbers = lines[i].trim().replace(/\+49/g, '0');
      
      // Handynummer finden (015x, 016x, 017x) - auch wenn in der Mitte versteckt!
      const handyPattern = /(01[567]\d{7,11})/g;
      const handyMatches = allNumbers.match(handyPattern);
      
      if (handyMatches && handyMatches.length > 0) {
        record.Handy = handyMatches[0];
        // Handy aus String entfernen um Festnetz zu finden
        let remaining = allNumbers;
        handyMatches.forEach(h => { remaining = remaining.replace(h, ' '); });
        // Festnetz extrahieren (Nummern mit 03, 04, 05, 06, 07, 08, 09 am Anfang)
        const festnetzMatch = remaining.match(/(0[2-9]\d{6,12})/);
        if (festnetzMatch) {
          record.Telefon = festnetzMatch[1];
        }
      } else {
        // Kein Handy gefunden - alles als Telefon
        const festnetzMatch = allNumbers.match(/(0[2-9]\d{6,12})/);
        record.Telefon = festnetzMatch ? festnetzMatch[1] : allNumbers.replace(/[^\d]/g, '');
      }
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
    const houseNumMatch = nameStreet.match(/^(.+?)(\d+[a-zA-Z]?)$/);
    if (houseNumMatch) {
      const beforeNum = houseNumMatch[1];
      const houseNum = houseNumMatch[2];
      let found = false;
      
      // 1. Straßenendungen erkennen (Straße, Weg, etc.) und CamelCase davor finden
      const streetSuffixMatch = beforeNum.trim().match(/(straße|strasse|str\.|weg|platz|allee|ring|gasse|damm|ufer|chaussee|steig|pfad|hof|anger)$/i);
      if (streetSuffixMatch && !found) {
        let splitIdx = -1;
        for (let k = beforeNum.length - streetSuffixMatch[0].length - 1; k > 0; k--) {
          if (/[a-zäöüß]/.test(beforeNum[k]) && /[A-ZÄÖÜ]/.test(beforeNum[k + 1])) {
            splitIdx = k + 1;
            break;
          }
        }
        if (splitIdx > 0) {
          result.Name = beforeNum.substring(0, splitIdx).trim();
          result.Strasse = beforeNum.substring(splitIdx).trim() + ' ' + houseNum;
          found = true;
        }
      }
      
      // 2. Straßenpräfixe erkennen (Am, An der, Im, etc.) - NUR nach Wortgrenze!
      if (!found) {
        // Präfix muss nach CamelCase-Übergang kommen (klein→groß)
        const streetPrefixMatch = beforeNum.match(/^(.+[a-zäöüß])(Am|An der|An den|Im|In der|In den|Auf der|Auf dem|Zur|Zum|Bei der|Bei den|Unter der|Über der|Hinter der|Vor der)(.*)$/);
        if (streetPrefixMatch) {
          result.Name = streetPrefixMatch[1].trim();
          result.Strasse = (streetPrefixMatch[2] + streetPrefixMatch[3]).trim() + ' ' + houseNum;
          found = true;
        }
      }
      
      // 3. Firmenformen erkennen (SE, GmbH, AG, e.K., etc.)
      if (!found) {
        const firmaMatch = beforeNum.match(/^(.+?(?:SE|e\.K\.|GmbH|AG|KG|OHG|UG|mbH|Co\.|Ltd\.?|Inc\.?)\s*)([A-ZÄÖÜ].*)$/i);
        if (firmaMatch) {
          result.Name = firmaMatch[1].trim();
          result.Strasse = firmaMatch[2].trim() + ' ' + houseNum;
          found = true;
        }
      }
      
      // 4. CamelCase-Übergang (letzter Übergang klein→groß)
      if (!found) {
        let splitIdx = -1;
        for (let k = beforeNum.length - 2; k > 0; k--) {
          if (/[a-zäöüß]/.test(beforeNum[k]) && /[A-ZÄÖÜ]/.test(beforeNum[k + 1])) {
            splitIdx = k + 1;
            break;
          }
        }
        if (splitIdx > 0) {
          result.Name = beforeNum.substring(0, splitIdx).trim();
          result.Strasse = beforeNum.substring(splitIdx).trim() + ' ' + houseNum;
          found = true;
        }
      }
      
      // 5. Fallback: Alles ist Name
      if (!found) {
        result.Name = beforeNum.trim();
        result.Strasse = houseNum;
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
