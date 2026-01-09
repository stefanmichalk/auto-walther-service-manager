import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { formatKennzeichen } from '../utils/kennzeichenFormatter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'inspector.db');
const db = new Database(dbPath);

// ============================================
// MIGRATIONS SYSTEM
// ============================================

// Schema-Version Tabelle erstellen
db.exec(`CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY)`);

// Aktuelle Version holen
const getCurrentVersion = () => {
  const row = db.prepare(`SELECT version FROM schema_version ORDER BY version DESC LIMIT 1`).get();
  return row?.version || 0;
};

// Version setzen
const setVersion = (version) => {
  db.prepare(`INSERT INTO schema_version (version) VALUES (?)`).run(version);
  console.log(`Migration ${version} erfolgreich ausgeführt`);
};

// Alle Migrationen definieren
const migrations = {
  // Migration 1: Initiales Schema
  1: () => {
    db.exec(`
      -- Fahrzeuge Tabelle
      CREATE TABLE IF NOT EXISTS fahrzeuge (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vin TEXT UNIQUE NOT NULL,
    kennzeichen TEXT,
    hersteller TEXT,
    modell TEXT,
    erstzulassung TEXT,
    kunde_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Kunden Tabelle
  CREATE TABLE IF NOT EXISTS kunden (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kdnr TEXT,
    anrede TEXT,
    name TEXT NOT NULL,
    strasse TEXT,
    plz TEXT,
    ort TEXT,
    telefon TEXT,
    email TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Fahrzeug-Kunden Zuordnung
  CREATE TABLE IF NOT EXISTS fahrzeug_kunde (
    fahrzeug_id INTEGER REFERENCES fahrzeuge(id),
    kunde_id INTEGER REFERENCES kunden(id),
    PRIMARY KEY (fahrzeug_id, kunde_id)
  );

  -- Termine Tabelle (Inspektionen, HU, Service)
  CREATE TABLE IF NOT EXISTS termine (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fahrzeug_id INTEGER REFERENCES fahrzeuge(id),
    typ TEXT NOT NULL CHECK(typ IN ('inspektion', 'hu', 'service')),
    datum TEXT NOT NULL,
    km_stand INTEGER,
    bezeichnung TEXT,
    vermerk TEXT,
    status TEXT DEFAULT 'geplant' CHECK(status IN ('geplant', 'durchgefuehrt', 'abgesagt')),
    quelle TEXT DEFAULT 'manuell' CHECK(quelle IN ('manuell', 'pdf_import', 'xlsx_import')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Service-Fälligkeiten (aus XLSX)
  CREATE TABLE IF NOT EXISTS service_faelligkeiten (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    fahrzeug_id INTEGER REFERENCES fahrzeuge(id),
    faelligkeitsdatum TEXT NOT NULL,
    bezeichnung TEXT,
    details TEXT,
    status TEXT DEFAULT 'offen' CHECK(status IN ('offen', 'vereinbart', 'erledigt')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- User Tabelle für Login
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT,
    role TEXT DEFAULT 'user' CHECK(role IN ('user', 'admin')),
    active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME
  );

  -- Fahrzeug-Status Tracking (pro Fahrzeug)
  CREATE TABLE IF NOT EXISTS fahrzeug_status (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vin TEXT UNIQUE NOT NULL,
    angeschrieben INTEGER DEFAULT 0,
    service_termin TEXT,
    nachgefasst INTEGER DEFAULT 0,
    ausgetragen INTEGER DEFAULT 0,
    austragen_grund TEXT,
    wiedervorlage_datum TEXT,
    wiedervorlage_grund TEXT,
    notiz TEXT,
    bearbeitet_von INTEGER REFERENCES users(id),
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Audit-Log Tabelle
  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vin TEXT NOT NULL,
    aktion TEXT NOT NULL,
    feld TEXT,
    alter_wert TEXT,
    neuer_wert TEXT,
    user_id INTEGER REFERENCES users(id),
    user_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

      -- Index für schnellere Suche
      CREATE INDEX IF NOT EXISTS idx_fahrzeuge_vin ON fahrzeuge(vin);
      CREATE INDEX IF NOT EXISTS idx_fahrzeuge_kennzeichen ON fahrzeuge(kennzeichen);
      CREATE INDEX IF NOT EXISTS idx_termine_datum ON termine(datum);
      CREATE INDEX IF NOT EXISTS idx_termine_fahrzeug ON termine(fahrzeug_id);
      CREATE INDEX IF NOT EXISTS idx_fahrzeug_status_vin ON fahrzeug_status(vin);
      CREATE INDEX IF NOT EXISTS idx_audit_log_vin ON audit_log(vin);
      CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);
    `);
  },

  // Migration 2: Beispiel für zukünftige Änderungen
  // 2: () => {
  //   db.exec(`ALTER TABLE fahrzeuge ADD COLUMN telefon TEXT`);
  // },
};

// Migrationen ausführen
const runMigrations = () => {
  const currentVersion = getCurrentVersion();
  const migrationKeys = Object.keys(migrations).map(Number).sort((a, b) => a - b);
  
  for (const version of migrationKeys) {
    if (version > currentVersion) {
      console.log(`Führe Migration ${version} aus...`);
      try {
        migrations[version]();
        setVersion(version);
      } catch (error) {
        console.error(`Migration ${version} fehlgeschlagen:`, error.message);
        throw error;
      }
    }
  }
  
  if (currentVersion === 0) {
    console.log('Datenbank initialisiert');
  } else {
    console.log(`Datenbank auf Version ${getCurrentVersion()}`);
  }
};

// Migrationen beim Start ausführen
runMigrations();

// ============================================
// PREPARED STATEMENTS
// ============================================

// Prepared Statements
const stmts = {
  // Fahrzeuge
  insertFahrzeug: db.prepare(`
    INSERT INTO fahrzeuge (vin, kennzeichen, hersteller, modell, erstzulassung, kunde_name)
    VALUES (@vin, @kennzeichen, @hersteller, @modell, @erstzulassung, @kunde_name)
    ON CONFLICT(vin) DO UPDATE SET
      kennzeichen = COALESCE(@kennzeichen, kennzeichen),
      hersteller = COALESCE(@hersteller, hersteller),
      modell = COALESCE(@modell, modell),
      kunde_name = COALESCE(@kunde_name, kunde_name),
      updated_at = CURRENT_TIMESTAMP
  `),
  
  getFahrzeugByVin: db.prepare(`SELECT * FROM fahrzeuge WHERE vin = ?`),
  
  getAllFahrzeuge: db.prepare(`SELECT * FROM fahrzeuge ORDER BY kennzeichen`),
  
  updateFahrzeug: db.prepare(`
    UPDATE fahrzeuge SET kennzeichen = @kennzeichen, hersteller = @hersteller, 
    modell = @modell, updated_at = CURRENT_TIMESTAMP WHERE vin = @vin
  `),

  // Kunden
  insertKunde: db.prepare(`
    INSERT INTO kunden (kdnr, anrede, name, strasse, plz, ort, telefon)
    VALUES (@kdnr, @anrede, @name, @strasse, @plz, @ort, @telefon)
  `),
  
  getKundeByName: db.prepare(`SELECT * FROM kunden WHERE name = ?`),

  // Termine
  insertTermin: db.prepare(`
    INSERT INTO termine (fahrzeug_id, typ, datum, km_stand, bezeichnung, vermerk, status, quelle)
    VALUES (@fahrzeug_id, @typ, @datum, @km_stand, @bezeichnung, @vermerk, @status, @quelle)
  `),
  
  getTermineByFahrzeug: db.prepare(`
    SELECT * FROM termine WHERE fahrzeug_id = ? ORDER BY datum DESC
  `),
  
  getAllTermine: db.prepare(`
    SELECT t.*, f.vin, f.kennzeichen, f.hersteller, f.modell
    FROM termine t
    JOIN fahrzeuge f ON t.fahrzeug_id = f.id
    ORDER BY t.datum
  `),
  
  updateTerminStatus: db.prepare(`
    UPDATE termine SET status = @status, updated_at = CURRENT_TIMESTAMP WHERE id = @id
  `),
  
  deleteTermin: db.prepare(`DELETE FROM termine WHERE id = ?`),

  // Service-Fälligkeiten
  insertServiceFaelligkeit: db.prepare(`
    INSERT INTO service_faelligkeiten (fahrzeug_id, faelligkeitsdatum, bezeichnung, details, status)
    VALUES (@fahrzeug_id, @faelligkeitsdatum, @bezeichnung, @details, @status)
  `),
  
  getServiceFaelligkeiten: db.prepare(`
    SELECT sf.*, f.vin, f.kennzeichen
    FROM service_faelligkeiten sf
    JOIN fahrzeuge f ON sf.fahrzeug_id = f.id
    ORDER BY sf.faelligkeitsdatum
  `),
  
  updateServiceStatus: db.prepare(`
    UPDATE service_faelligkeiten SET status = @status WHERE id = @id
  `),

  // Users
  insertUser: db.prepare(`
    INSERT INTO users (username, password_hash, name, role)
    VALUES (@username, @password_hash, @name, @role)
  `),
  
  getUserByUsername: db.prepare(`SELECT * FROM users WHERE username = ? AND active = 1`),
  
  getAllUsers: db.prepare(`SELECT id, username, name, role, active, created_at, last_login FROM users`),
  
  updateLastLogin: db.prepare(`UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?`),

  // Fahrzeug-Status (pro Fahrzeug)
  upsertFahrzeugStatus: db.prepare(`
    INSERT INTO fahrzeug_status (vin, angeschrieben, service_termin, nachgefasst, ausgetragen, austragen_grund, wiedervorlage_datum, wiedervorlage_grund, notiz, bearbeitet_von, updated_at)
    VALUES (@vin, @angeschrieben, @service_termin, @nachgefasst, @ausgetragen, @austragen_grund, @wiedervorlage_datum, @wiedervorlage_grund, @notiz, @bearbeitet_von, CURRENT_TIMESTAMP)
    ON CONFLICT(vin) DO UPDATE SET
      angeschrieben = @angeschrieben,
      service_termin = @service_termin,
      nachgefasst = @nachgefasst,
      ausgetragen = @ausgetragen,
      austragen_grund = @austragen_grund,
      wiedervorlage_datum = @wiedervorlage_datum,
      wiedervorlage_grund = @wiedervorlage_grund,
      notiz = @notiz,
      bearbeitet_von = @bearbeitet_von,
      updated_at = CURRENT_TIMESTAMP
  `),
  
  getFahrzeugStatus: db.prepare(`SELECT * FROM fahrzeug_status WHERE vin = ?`),
  
  getAllFahrzeugStatus: db.prepare(`SELECT * FROM fahrzeug_status`),

  // Audit-Log
  insertAuditLog: db.prepare(`
    INSERT INTO audit_log (vin, aktion, feld, alter_wert, neuer_wert, user_id, user_name)
    VALUES (@vin, @aktion, @feld, @alter_wert, @neuer_wert, @user_id, @user_name)
  `),
  
  getAuditLogByVin: db.prepare(`SELECT * FROM audit_log WHERE vin = ? ORDER BY created_at DESC`),
  
  getAllAuditLog: db.prepare(`SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 500`),

  // Fälligkeiten-Übersicht (1 Zeile pro VIN - frühestes Service-Datum)
  getFaelligkeitenUebersicht: db.prepare(`
    SELECT 
      f.id as fahrzeug_id,
      f.vin,
      f.kennzeichen,
      f.hersteller,
      f.modell,
      f.kunde_name,
      (SELECT faelligkeitsdatum FROM service_faelligkeiten WHERE fahrzeug_id = f.id ORDER BY faelligkeitsdatum ASC LIMIT 1) as service_faellig,
      (SELECT bezeichnung FROM service_faelligkeiten WHERE fahrzeug_id = f.id ORDER BY faelligkeitsdatum ASC LIMIT 1) as service_bezeichnung,
      (SELECT datum FROM termine WHERE fahrzeug_id = f.id AND typ = 'inspektion' ORDER BY datum ASC LIMIT 1) as inspektion_termin,
      (SELECT vermerk FROM termine WHERE fahrzeug_id = f.id AND typ = 'inspektion' ORDER BY datum ASC LIMIT 1) as inspektion_vermerk,
      (SELECT datum FROM termine WHERE fahrzeug_id = f.id AND typ = 'hu' ORDER BY datum ASC LIMIT 1) as hu_termin
    FROM fahrzeuge f
    ORDER BY f.kennzeichen
  `)
};

// Export functions
export function getDb() {
  return db;
}

export function getFahrzeugByVin(vin) {
  return stmts.getFahrzeugByVin.get(vin);
}

export function getAllFahrzeuge() {
  return stmts.getAllFahrzeuge.all();
}

export function insertFahrzeug(data) {
  return stmts.insertFahrzeug.run(data);
}

export function insertTermin(data) {
  return stmts.insertTermin.run(data);
}

export function getAllTermine() {
  return stmts.getAllTermine.all();
}

export function getTermineByFahrzeug(fahrzeugId) {
  return stmts.getTermineByFahrzeug.all(fahrzeugId);
}

export function updateTerminStatus(id, status) {
  return stmts.updateTerminStatus.run({ id, status });
}

export function deleteTermin(id) {
  return stmts.deleteTermin.run(id);
}

export function insertServiceFaelligkeit(data) {
  return stmts.insertServiceFaelligkeit.run(data);
}

export function getServiceFaelligkeiten() {
  return stmts.getServiceFaelligkeiten.all();
}

export function getFaelligkeitenUebersicht() {
  return stmts.getFaelligkeitenUebersicht.all();
}

// Import-Funktion: Daten aus geparsten PDFs/XLSX in DB übertragen
export function importParsedData(parsedData) {
  const importStats = { fahrzeuge: 0, termine: 0, service: 0 };
  
  const importTransaction = db.transaction(() => {
    // HU-Daten importieren
    for (const record of parsedData.hu || []) {
      if (!record.Fahrgestellnr) continue;
      
      // Fahrzeug anlegen/aktualisieren (Kennzeichen normalisieren)
      const formattedKennzeichen = record.Kennzeichen ? formatKennzeichen(record.Kennzeichen) : null;
      stmts.insertFahrzeug.run({
        vin: record.Fahrgestellnr,
        kennzeichen: formattedKennzeichen,
        hersteller: record.Hersteller || null,
        modell: record.Modell || null,
        erstzulassung: record.Erstzulassung || null,
        kunde_name: record.Name || record.Besitzer || record.Kunde || null
      });
      
      const fahrzeug = stmts.getFahrzeugByVin.get(record.Fahrgestellnr);
      if (fahrzeug && record.HU_Datum) {
        stmts.insertTermin.run({
          fahrzeug_id: fahrzeug.id,
          typ: 'hu',
          datum: record.HU_Datum,
          km_stand: record.KmStand ? parseInt(record.KmStand) : null,
          bezeichnung: 'Hauptuntersuchung',
          vermerk: record.AuftragsNr || null,
          status: 'geplant',
          quelle: 'pdf_import'
        });
        importStats.termine++;
      }
      importStats.fahrzeuge++;
    }
    
    // Inspektion-Daten importieren
    for (const record of parsedData.inspektion || []) {
      if (!record.Fahrgestellnr) continue;
      
      const formattedKennzeichen = record.Kennzeichen ? formatKennzeichen(record.Kennzeichen) : null;
      stmts.insertFahrzeug.run({
        vin: record.Fahrgestellnr,
        kennzeichen: formattedKennzeichen,
        hersteller: record.Hersteller || null,
        modell: null,
        erstzulassung: record.Erstzulassung || null,
        kunde_name: record.Name || record.Besitzer || record.Kunde || null
      });
      
      const fahrzeug = stmts.getFahrzeugByVin.get(record.Fahrgestellnr);
      if (fahrzeug && record.Inspektion) {
        stmts.insertTermin.run({
          fahrzeug_id: fahrzeug.id,
          typ: 'inspektion',
          datum: record.Inspektion,
          km_stand: record.KmStand ? parseInt(record.KmStand) : null,
          bezeichnung: 'Inspektion',
          vermerk: record.Vermerk || null,
          status: 'geplant',
          quelle: 'pdf_import'
        });
        importStats.termine++;
      }
      importStats.fahrzeuge++;
    }
    
    // Service-Fälligkeiten importieren (aus XLSX)
    for (const record of parsedData.service || []) {
      if (!record.Fahrgestellnr) continue;
      
      const formattedKennzeichen = record.Kennzeichen ? formatKennzeichen(record.Kennzeichen) : null;
      stmts.insertFahrzeug.run({
        vin: record.Fahrgestellnr,
        kennzeichen: formattedKennzeichen,
        hersteller: null,
        modell: null,
        erstzulassung: null,
        kunde_name: record.Name || record.Besitzer || record.Kunde || null
      });
      
      const fahrzeug = stmts.getFahrzeugByVin.get(record.Fahrgestellnr);
      if (fahrzeug && record.Faelligkeitsdatum) {
        // Datum formatieren (YYYY/MM/DD -> DD.MM.YYYY)
        let datum = record.Faelligkeitsdatum;
        if (datum.includes('/')) {
          const [y, m, d] = datum.split('/');
          datum = `${d}.${m}.${y}`;
        }
        
        stmts.insertServiceFaelligkeit.run({
          fahrzeug_id: fahrzeug.id,
          faelligkeitsdatum: datum,
          bezeichnung: record.Bezeichnung || null,
          details: record.Details || null,
          status: 'offen'
        });
        importStats.service++;
      }
    }
  });
  
  importTransaction();
  return importStats;
}

// User functions
export function createUser(data) {
  return stmts.insertUser.run(data);
}

export function getUserByUsername(username) {
  return stmts.getUserByUsername.get(username);
}

export function getAllUsers() {
  return stmts.getAllUsers.all();
}

export function updateLastLogin(userId) {
  return stmts.updateLastLogin.run(userId);
}

// Fahrzeug-Status functions
export function upsertFahrzeugStatus(data) {
  return stmts.upsertFahrzeugStatus.run(data);
}

export function getFahrzeugStatus(vin) {
  return stmts.getFahrzeugStatus.get(vin);
}

export function getAllFahrzeugStatus() {
  return stmts.getAllFahrzeugStatus.all();
}

// Audit-Log functions
export function insertAuditLog(data) {
  return stmts.insertAuditLog.run(data);
}

export function getAuditLogByVin(vin) {
  return stmts.getAuditLogByVin.all(vin);
}

export function getAllAuditLog() {
  return stmts.getAllAuditLog.all();
}

export default db;
