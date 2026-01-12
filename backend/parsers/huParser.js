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
        // +49 durch 0 ersetzen
        let allNumbers = phoneMatch[1].trim().replace(/\+49/g, '0');
        const _phoneHints = [];
        
        if (phoneMatch[1].includes('+49')) {
          _phoneHints.push('+49 → 0 konvertiert');
        }
        
        // Handynummer finden (015x, 016x, 017x) - auch wenn in der Mitte versteckt!
        const handyPattern = /(01[567]\d{7,11})/g;
        const handyMatches = allNumbers.match(handyPattern);
        
        if (handyMatches && handyMatches.length > 0) {
          record.Handy = handyMatches[0];
          _phoneHints.push(`Handy erkannt: ${handyMatches[0]}`);
          // Handy aus String entfernen um Festnetz zu finden
          let remaining = allNumbers;
          handyMatches.forEach(h => { remaining = remaining.replace(h, ' '); });
          // Festnetz extrahieren
          const festnetzMatch = remaining.match(/(0[2-9]\d{6,12})/);
          if (festnetzMatch) {
            record.Telefon = festnetzMatch[1];
            _phoneHints.push(`Festnetz erkannt: ${festnetzMatch[1]}`);
          }
        } else {
          const festnetzMatch = allNumbers.match(/(0[2-9]\d{6,12})/);
          record.Telefon = festnetzMatch ? festnetzMatch[1] : allNumbers.replace(/[^\d]/g, '');
        }
        
        if (_phoneHints.length > 0) {
          record._parseHints = [...(record._parseHints || []), ..._phoneHints];
        }
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
      // DEBUG: Zeige geparsten Record
      console.log('HU PARSED:', JSON.stringify(record, null, 2));
      records.push(record);
    }
  }
  
  return records;
}

function parseHUAddress(line) {
  console.log('HU ADDRESS INPUT:', line);
  const result = {};
  const _parseHints = []; // Parsing-Hinweise sammeln
  
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
          _parseHints.push(`Straßenendung "${streetSuffixMatch[1]}" erkannt → Trennung bei CamelCase davor`);
          found = true;
        }
      }
      
      // 2. Straßenpräfixe erkennen (Am, An der, Im, etc.) - NUR nach Wortgrenze!
      // z.B. "Stefan MichalkAm Weg" aber NICHT "GuntramAm Weg" (Guntram endet auf "am")
      if (!found) {
        // Präfix muss nach CamelCase-Übergang kommen (klein→groß)
        const streetPrefixMatch = beforeNum.match(/^(.+[a-zäöüß])(Am|An der|An den|Im|In der|In den|Auf der|Auf dem|Zur|Zum|Bei der|Bei den|Unter der|Über der|Hinter der|Vor der)(.*)$/);
        if (streetPrefixMatch) {
          result.Name = streetPrefixMatch[1].trim();
          result.Strasse = (streetPrefixMatch[2] + streetPrefixMatch[3]).trim() + ' ' + houseNum;
          _parseHints.push(`Straßenpräfix "${streetPrefixMatch[2]}" erkannt → Trennung vor Präfix`);
          found = true;
        }
      }
      
      // 3. Firmenformen erkennen (SE, GmbH, AG, e.K., etc.)
      if (!found) {
        const firmaMatch = beforeNum.match(/^(.+?(?:SE|e\.K\.|GmbH|AG|KG|OHG|UG|mbH|Co\.|Ltd\.?|Inc\.?)\s*)([A-ZÄÖÜ].*)$/i);
        if (firmaMatch) {
          result.Name = firmaMatch[1].trim();
          result.Strasse = firmaMatch[2].trim() + ' ' + houseNum;
          const firmaType = firmaMatch[1].match(/(SE|e\.K\.|GmbH|AG|KG|OHG|UG|mbH|Co\.|Ltd\.?|Inc\.?)/i);
          _parseHints.push(`Firmenform "${firmaType?.[1]}" erkannt → Trennung nach Rechtsform`);
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
          _parseHints.push(`CamelCase-Trennung: "${beforeNum[splitIdx-1]}${beforeNum[splitIdx]}" → Name endet, Straße beginnt`);
          found = true;
        }
      }
      
      // 5. Fallback: Alles ist Name
      if (!found) {
        result.Name = beforeNum.trim();
        result.Strasse = houseNum;
        _parseHints.push(`Keine Trennung möglich → Nur Hausnummer als Straße`);
      }
    } else {
      result.Name = nameStreet.trim();
    }
  }
  
  if (_parseHints.length > 0) {
    result._parseHints = _parseHints;
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
