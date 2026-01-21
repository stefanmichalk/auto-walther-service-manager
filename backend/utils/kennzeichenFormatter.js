// Alle deutschen Kfz-Kennzeichen Unterscheidungszeichen (Stand 2024)
// 1-stellig, 2-stellig und 3-stellig
const kennzeichenKuerzel = new Set([
  // 1-stellig
  'B', 'D', 'E', 'F', 'G', 'H', 'J', 'K', 'L', 'M', 'N', 'P', 'R', 'S', 'V', 'W', 'Z',
  // 2-stellig (Auswahl der häufigsten)
  'AB', 'AC', 'AH', 'AK', 'AM', 'AN', 'AO', 'AP', 'AS', 'AW', 'AZ',
  'BA', 'BB', 'BC', 'BE', 'BF', 'BH', 'BI', 'BK', 'BL', 'BM', 'BN', 'BO', 'BS', 'BT', 'BZ',
  'CB', 'CE', 'CO', 'CW', 'CZ',
  'DA', 'DB', 'DD', 'DE', 'DH', 'DL', 'DM', 'DN', 'DO', 'DU', 'DW', 'DZ',
  'EA', 'EB', 'ED', 'EE', 'EF', 'EH', 'EI', 'EL', 'EM', 'EN', 'ER', 'ES', 'EU', 'EW',
  'FB', 'FD', 'FF', 'FG', 'FI', 'FL', 'FN', 'FO', 'FR', 'FS', 'FT', 'FW',
  'GA', 'GC', 'GD', 'GE', 'GF', 'GG', 'GI', 'GK', 'GL', 'GM', 'GN', 'GP', 'GR', 'GS', 'GT', 'GW', 'GZ',
  'HA', 'HB', 'HC', 'HD', 'HE', 'HF', 'HG', 'HH', 'HI', 'HK', 'HL', 'HM', 'HN', 'HO', 'HP', 'HR', 'HS', 'HU', 'HV', 'HX', 'HY', 'HZ',
  'IK', 'IL', 'IN', 'IZ',
  'JE', 'JL',
  'KA', 'KB', 'KC', 'KE', 'KF', 'KG', 'KH', 'KI', 'KL', 'KM', 'KN', 'KO', 'KR', 'KS', 'KT', 'KU', 'KW', 'KY',
  'LA', 'LB', 'LD', 'LF', 'LG', 'LH', 'LI', 'LL', 'LM', 'LN', 'LO', 'LP', 'LR', 'LU', 'LW',
  'MA', 'MB', 'MC', 'MD', 'ME', 'MG', 'MH', 'MI', 'MK', 'ML', 'MM', 'MN', 'MO', 'MQ', 'MR', 'MS', 'MT', 'MU', 'MW', 'MY', 'MZ',
  'NB', 'ND', 'NE', 'NF', 'NH', 'NI', 'NK', 'NM', 'NO', 'NP', 'NR', 'NT', 'NU', 'NW', 'NY',
  'OA', 'OB', 'OC', 'OD', 'OE', 'OF', 'OG', 'OH', 'OK', 'OL', 'OP', 'OR', 'OS', 'OZ',
  'PA', 'PB', 'PE', 'PF', 'PI', 'PL', 'PM', 'PN', 'PR', 'PS', 'PW',
  'RA', 'RD', 'RE', 'RG', 'RH', 'RI', 'RL', 'RM', 'RO', 'RP', 'RS', 'RT', 'RU', 'RV', 'RW', 'RZ',
  'SB', 'SC', 'SE', 'SG', 'SH', 'SI', 'SK', 'SL', 'SM', 'SN', 'SO', 'SP', 'SR', 'ST', 'SU', 'SW', 'SY', 'SZ',
  'TE', 'TF', 'TG', 'TO', 'TP', 'TR', 'TS', 'TT', 'TU', 'TW',
  'UE', 'UH', 'UL', 'UM', 'UN',
  'VB', 'VE', 'VG', 'VK', 'VR', 'VS',
  'WA', 'WB', 'WE', 'WF', 'WG', 'WI', 'WK', 'WL', 'WM', 'WN', 'WO', 'WR', 'WS', 'WT', 'WU', 'WW', 'WZ',
  'ZE', 'ZI', 'ZP', 'ZR', 'ZW', 'ZZ',
  // 3-stellig (alle)
  'ABI', 'ABG', 'AIC', 'ALF', 'ALZ', 'ANA', 'ANG', 'ANK', 'APD', 'ARN', 'ART', 'ASL', 'ASZ', 'AUR', 'AZE',
  'BAD', 'BAR', 'BBG', 'BCH', 'BED', 'BER', 'BGD', 'BGL', 'BID', 'BIN', 'BIR', 'BIT', 'BKS', 'BLB', 'BLK', 'BOG', 'BOH', 'BOR', 'BOT', 'BRA', 'BRB', 'BRG', 'BRK', 'BRL', 'BRV', 'BSB', 'BSK', 'BTF', 'BUL', 'BUR', 'BUS',
  'CAS', 'CHA', 'CLP', 'CLZ', 'COC', 'COE', 'CUX',
  'DAH', 'DAN', 'DAU', 'DBR', 'DEG', 'DEL', 'DGF', 'DIL', 'DIN', 'DIZ', 'DKB', 'DLG', 'DON', 'DUD', 'DUR',
  'EBE', 'EBN', 'EBS', 'ECK', 'EIC', 'EIL', 'EIN', 'EIS', 'EMS', 'EMD', 'ENA', 'ERB', 'ERH', 'ERK', 'ERZ', 'ESB', 'ESW', 'EUT',
  'FDB', 'FDS', 'FEU', 'FFB', 'FKB', 'FLO', 'FOR', 'FRG', 'FRI', 'FRW', 'FTL', 'FUE',
  'GAP', 'GDB', 'GEL', 'GEO', 'GER', 'GHA', 'GHC', 'GLA', 'GMN', 'GNT', 'GOA', 'GOH', 'GRA', 'GRH', 'GRI', 'GRM', 'GRZ', 'GTH', 'GUB', 'GUN', 'GVM',
  'HAB', 'HAL', 'HAM', 'HAS', 'HBN', 'HBS', 'HCH', 'HDH', 'HDL', 'HEB', 'HEF', 'HEI', 'HER', 'HET', 'HGN', 'HGW', 'HHM', 'HIG', 'HIP', 'HMU', 'HOG', 'HOH', 'HOL', 'HOM', 'HOR', 'HOT', 'HRO', 'HSK', 'HST', 'HWI',
  'IGB', 'ILL',
  'JUL',
  'KAR', 'KEM', 'KEH', 'KEL', 'KIB', 'KLE', 'KLZ', 'KOE', 'KON', 'KOT', 'KRU', 'KUS', 'KYF',
  'LAU', 'LBS', 'LBZ', 'LDK', 'LDS', 'LEO', 'LER', 'LEV', 'LIB', 'LIF', 'LIP', 'LOS', 'LRO', 'LSZ', 'LUP', 'LWL',
  'MAB', 'MAI', 'MAK', 'MAL', 'MED', 'MEG', 'MEI', 'MEK', 'MEL', 'MER', 'MET', 'MGH', 'MGN', 'MHL', 'MIL', 'MKK', 'MOD', 'MOL', 'MON', 'MOS', 'MSE', 'MSH', 'MSP', 'MST', 'MTK', 'MTL', 'MUE', 'MYK', 'MZG',
  'NAB', 'NAI', 'NAU', 'NDH', 'NEA', 'NEB', 'NEC', 'NEN', 'NES', 'NEW', 'NMB', 'NMS', 'NOH', 'NOL', 'NOM', 'NOR', 'NVP', 'NWM',
  'OAL', 'OBB', 'OBG', 'OCH', 'OHA', 'OHV', 'OHZ', 'OPR', 'OSL', 'OVP',
  'PAF', 'PAN', 'PAR', 'PCH', 'PEG', 'PIR', 'PLO', 'PLR', 'POL', 'PRU', 'QFT',
  'RDG', 'REG', 'REH', 'REI', 'RES', 'RID', 'RIE', 'ROD', 'ROF', 'ROK', 'ROL', 'ROS', 'ROT', 'ROW', 'RSL', 'RUE', 'RUP',
  'SAB', 'SAD', 'SAN', 'SAW', 'SBG', 'SBK', 'SCZ', 'SDH', 'SDL', 'SDT', 'SEB', 'SEE', 'SEF', 'SEL', 'SFB', 'SFT', 'SGH', 'SHA', 'SHG', 'SHK', 'SHL', 'SIG', 'SIM', 'SLE', 'SLF', 'SLK', 'SLN', 'SLS', 'SLZ', 'SMU', 'SNH', 'SOB', 'SOG', 'SOK', 'SOL', 'SOM', 'SON', 'SPB', 'SPN', 'SRB', 'SRO', 'STA', 'STB', 'STD', 'STE', 'STH', 'STL', 'STO', 'SUL', 'SWA', 'SZB',
  'TBB', 'TDO', 'TET', 'THL', 'TIR', 'TOL', 'TUT',
  'UEM', 'UER', 'UFF',
  'VAI', 'VEC', 'VER', 'VIB', 'VIE', 'VIT', 'VOH',
  'WAF', 'WAK', 'WAN', 'WAR', 'WAT', 'WBS', 'WDA', 'WEA', 'WED', 'WEL', 'WEN', 'WER', 'WES', 'WHV', 'WIL', 'WIS', 'WIT', 'WIZ', 'WLG', 'WMS', 'WND', 'WOB', 'WOH', 'WOL', 'WOR', 'WOS', 'WRN', 'WSF', 'WST', 'WSW', 'WTL', 'WTM', 'WUG', 'WUN', 'WUR', 'WZL',
  'ZEL', 'ZIG'
]);

console.log(`Loaded ${kennzeichenKuerzel.size} Kennzeichen-Kürzel (embedded)`);

/**
 * Bereinigt ein Kennzeichen: nur Großbuchstaben und Zahlen
 * @param {string} raw - Rohes Kennzeichen (z.B. "FG-NP 199", "FG NP 199")
 * @returns {string} - Bereinigtes Kennzeichen (z.B. "FGNP199")
 */
export function formatKennzeichen(raw) {
  if (!raw) return raw;
  
  // Nur Buchstaben und Zahlen, alles Großbuchstaben
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Prüft ob ein Unterscheidungszeichen gültig ist
 */
export function isValidPrefix(prefix) {
  return kennzeichenKuerzel.has(prefix.toUpperCase());
}

/**
 * Gibt alle geladenen Kürzel zurück
 */
export function getAllKuerzel() {
  return Array.from(kennzeichenKuerzel).sort();
}

/**
 * Formatiert ein Kennzeichen für die Anzeige: BEDAN112 → BED-AN 112
 * Regelbasiert: Ort 1-3, Erkennung 1-2, Ziffern 1-4, optional E/H am Ende
 * @param {string} raw - Rohes Kennzeichen (z.B. "BEDAN112", "FGAW64E")
 * @returns {string} - Formatiertes Kennzeichen (z.B. "BED-AN 112", "FG-AW 64 E")
 */
export function displayKennzeichen(raw) {
  if (!raw) return raw;
  
  // Bereinigen
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!clean || clean.length < 3 || clean.length > 9) return raw;
  
  // E-Kennzeichen (Elektro) oder H-Kennzeichen (Oldtimer) am Ende?
  let suffix = '';
  let base = clean;
  if (/\d[EH]$/.test(clean)) {
    suffix = clean.slice(-1);
    base = clean.slice(0, -1);
  }
  
  // Buchstaben und Ziffern trennen
  const match = base.match(/^([A-Z]+)(\d+)$/);
  if (!match) return raw;
  
  const letters = match[1];
  const digits = match[2];
  
  // Validierung: Ziffern 1-4, Buchstaben 2-5
  if (digits.length < 1 || digits.length > 4) return raw;
  if (letters.length < 2 || letters.length > 5) return raw;
  
  // Erkennungsbuchstaben bestimmen (immer 1-2)
  // Regel: Ort ist 1-3 Buchstaben, Erkennung ist 1-2
  let ortLen;
  
  if (letters.length === 2) {
    ortLen = 1;
  } else if (letters.length === 3) {
    // Prüfe ob 3 Buchstaben ein Ort sind, sonst 2+1
    if (kennzeichenKuerzel.has(letters)) {
      return raw; // Nur Ort ohne Erkennung - ungültig
    }
    const candidate2 = letters.substring(0, 2);
    if (kennzeichenKuerzel.has(candidate2)) {
      ortLen = 2;
    } else {
      ortLen = 1; // Fallback: 1+2
    }
  } else if (letters.length === 4) {
    // Könnte 2+2 oder 3+1 sein - prüfe CSV
    const candidate3 = letters.substring(0, 3);
    if (kennzeichenKuerzel.has(candidate3)) {
      ortLen = 3;
    } else {
      ortLen = 2;
    }
  } else if (letters.length === 5) {
    ortLen = 3;
  } else {
    return raw;
  }
  
  const ort = letters.substring(0, ortLen);
  const erk = letters.substring(ortLen);
  
  if (suffix) {
    return `${ort}-${erk} ${digits} ${suffix}`;
  }
  return `${ort}-${erk} ${digits}`;
}

export default { formatKennzeichen, isValidPrefix, getAllKuerzel, displayKennzeichen };
