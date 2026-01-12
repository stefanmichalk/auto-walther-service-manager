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
    handy TEXT,
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

  // Migration 2: Schema normalisieren
  2: () => {
    // 1. Kunden-Tabelle erweitern und Daten migrieren
    db.exec(`
      -- Neue Spalten für fahrzeuge: kunde_id als FK
      ALTER TABLE fahrzeuge ADD COLUMN kunde_id INTEGER REFERENCES kunden(id);
      
      -- fahrzeug_status: fahrzeug_id statt nur vin
      ALTER TABLE fahrzeug_status ADD COLUMN fahrzeug_id INTEGER REFERENCES fahrzeuge(id);
    `);
    
    // 2. Bestehende Kunden aus fahrzeuge.kunde_name in kunden-Tabelle migrieren
    const fahrzeugeMitKunden = db.prepare(`
      SELECT DISTINCT kunde_name FROM fahrzeuge WHERE kunde_name IS NOT NULL AND kunde_name != ''
    `).all();
    
    const insertKunde = db.prepare(`
      INSERT OR IGNORE INTO kunden (name) VALUES (?)
    `);
    
    for (const f of fahrzeugeMitKunden) {
      insertKunde.run(f.kunde_name);
    }
    
    // 3. kunde_id in fahrzeuge setzen
    db.exec(`
      UPDATE fahrzeuge SET kunde_id = (
        SELECT id FROM kunden WHERE kunden.name = fahrzeuge.kunde_name
      ) WHERE kunde_name IS NOT NULL AND kunde_name != '';
    `);
    
    // 4. fahrzeug_id in fahrzeug_status setzen
    db.exec(`
      UPDATE fahrzeug_status SET fahrzeug_id = (
        SELECT id FROM fahrzeuge WHERE fahrzeuge.vin = fahrzeug_status.vin
      );
    `);
    
    // 5. Neue Indizes
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_fahrzeuge_kunde ON fahrzeuge(kunde_id);
      CREATE INDEX IF NOT EXISTS idx_fahrzeug_status_fahrzeug ON fahrzeug_status(fahrzeug_id);
    `);
    
    console.log('Migration 2: Schema normalisiert - Kunden verknüpft, fahrzeug_status mit FK');
  },

  // Migration 3: Invite Tokens für User-Einladungen
  3: () => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS invite_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        token TEXT UNIQUE NOT NULL,
        username TEXT NOT NULL,
        name TEXT,
        role TEXT DEFAULT 'user',
        created_by INTEGER REFERENCES users(id),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME,
        used_at DATETIME,
        used INTEGER DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_invite_token ON invite_tokens(token);
    `);
    console.log('Migration 3: Invite Tokens Tabelle erstellt');
  },

  // Migration 4: Handy-Spalte zur kunden-Tabelle hinzufügen
  4: () => {
    db.exec(`
      ALTER TABLE kunden ADD COLUMN handy TEXT;
    `);
    console.log('Migration 4: Handy-Spalte zu kunden hinzugefügt');
  },

  // Migration 5: Kapazitäts-Einstellungen für Auslastungsansicht
  5: () => {
    db.exec(`
      -- Globale Einstellungen
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      -- Kapazitäten pro Wochentag (0=So, 1=Mo, ..., 6=Sa)
      CREATE TABLE IF NOT EXISTS kapazitaeten (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        wochentag INTEGER NOT NULL UNIQUE,
        max_termine INTEGER DEFAULT 0,
        aktiv INTEGER DEFAULT 1
      );
      
      -- Standard-Kapazitäten einfügen
      INSERT OR IGNORE INTO kapazitaeten (wochentag, max_termine, aktiv) VALUES
        (0, 0, 0),   -- Sonntag: geschlossen
        (1, 8, 1),   -- Montag
        (2, 8, 1),   -- Dienstag
        (3, 8, 1),   -- Mittwoch
        (4, 8, 1),   -- Donnerstag
        (5, 8, 1),   -- Freitag
        (6, 4, 1);   -- Samstag: halber Tag
      
      -- Globale Default-Kapazität
      INSERT OR IGNORE INTO settings (key, value) VALUES ('default_kapazitaet', '8');
    `);
    console.log('Migration 5: Kapazitäts-Einstellungen erstellt');
  },

  // Migration 6: Geplante Termine (1:n Beziehung Fahrzeug → Termine)
  6: () => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS geplante_termine (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        fahrzeug_id INTEGER NOT NULL REFERENCES fahrzeuge(id),
        typ TEXT NOT NULL,  -- 'hu', 'inspektion', 'service'
        datum TEXT NOT NULL,  -- YYYY-MM-DD Format
        notiz TEXT,
        erstellt_von INTEGER REFERENCES users(id),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX idx_geplante_termine_fahrzeug ON geplante_termine(fahrzeug_id);
      CREATE INDEX idx_geplante_termine_datum ON geplante_termine(datum);
      
      -- Bestehende service_termin Daten migrieren
      INSERT INTO geplante_termine (fahrzeug_id, typ, datum, erstellt_von)
      SELECT fs.fahrzeug_id, 'service', 
             substr(fs.service_termin, 7, 4) || '-' || substr(fs.service_termin, 4, 2) || '-' || substr(fs.service_termin, 1, 2),
             fs.bearbeitet_von
      FROM fahrzeug_status fs
      WHERE fs.service_termin IS NOT NULL 
        AND fs.service_termin != '' 
        AND fs.service_termin LIKE '__.__.____'
        AND fs.fahrzeug_id IS NOT NULL;
    `);
    console.log('Migration 6: Geplante Termine Tabelle erstellt und Daten migriert');
  },

  // Migration 7: Kapazitäts-Ausnahmen für bestimmte Tage
  7: () => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS kapazitaet_ausnahmen (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        datum TEXT NOT NULL UNIQUE,  -- YYYY-MM-DD
        max_termine INTEGER NOT NULL,
        notiz TEXT,
        erstellt_von INTEGER REFERENCES users(id),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE INDEX idx_kapazitaet_ausnahmen_datum ON kapazitaet_ausnahmen(datum);
    `);
    console.log('Migration 7: Kapazitäts-Ausnahmen Tabelle erstellt');
  },

  // Migration 8: Buchungs-Tokens für Kunden-Self-Service
  8: () => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS buchungs_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        token TEXT NOT NULL UNIQUE,
        fahrzeug_id INTEGER NOT NULL REFERENCES fahrzeuge(id),
        vin TEXT NOT NULL,
        kennzeichen TEXT,
        kunde_name TEXT,
        typ TEXT DEFAULT 'service',  -- 'hu', 'inspektion', 'service'
        status TEXT DEFAULT 'offen',  -- 'offen', 'gebucht', 'abgelaufen'
        gewaehltes_datum TEXT,  -- vom Kunden gewähltes Datum
        gueltig_bis DATETIME,
        erstellt_von INTEGER REFERENCES users(id),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        gebucht_at DATETIME
      );
      
      CREATE INDEX idx_buchungs_tokens_token ON buchungs_tokens(token);
      CREATE INDEX idx_buchungs_tokens_fahrzeug ON buchungs_tokens(fahrzeug_id);
      CREATE INDEX idx_buchungs_tokens_status ON buchungs_tokens(status);
    `);
    console.log('Migration 8: Buchungs-Tokens Tabelle erstellt');
  },
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
    INSERT INTO kunden (kdnr, anrede, name, strasse, plz, ort, telefon, handy, email)
    VALUES (@kdnr, @anrede, @name, @strasse, @plz, @ort, @telefon, @handy, @email)
  `),
  
  upsertKunde: db.prepare(`
    INSERT INTO kunden (name, strasse, plz, ort, telefon, email)
    VALUES (@name, @strasse, @plz, @ort, @telefon, @email)
    ON CONFLICT(id) DO UPDATE SET
      strasse = COALESCE(@strasse, strasse),
      plz = COALESCE(@plz, plz),
      ort = COALESCE(@ort, ort),
      telefon = COALESCE(@telefon, telefon),
      email = COALESCE(@email, email)
    RETURNING id
  `),
  
  getKundeByName: db.prepare(`SELECT * FROM kunden WHERE name = ?`),
  
  getKundeById: db.prepare(`SELECT * FROM kunden WHERE id = ?`),
  
  updateKunde: db.prepare(`
    UPDATE kunden SET 
      name = @name, strasse = @strasse, plz = @plz, ort = @ort, 
      telefon = @telefon, handy = @handy, email = @email
    WHERE id = @id
  `),
  
  linkFahrzeugKunde: db.prepare(`
    UPDATE fahrzeuge SET kunde_id = @kunde_id WHERE id = @fahrzeug_id
  `),

  // Termine
  insertTermin: db.prepare(`
    INSERT INTO termine (fahrzeug_id, typ, datum, km_stand, bezeichnung, vermerk, status, quelle)
    VALUES (@fahrzeug_id, @typ, @datum, @km_stand, @bezeichnung, @vermerk, @status, @quelle)
  `),
  
  // Prüfen ob Termin mit gleichem Typ und Datum schon existiert
  getTerminByTypAndDatum: db.prepare(`
    SELECT * FROM termine WHERE fahrzeug_id = ? AND typ = ? AND datum = ?
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
  
  // Prüfen ob Service-Fälligkeit mit gleichem Datum schon existiert
  getServiceByDatum: db.prepare(`
    SELECT * FROM service_faelligkeiten WHERE fahrzeug_id = ? AND faelligkeitsdatum = ?
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
      k.strasse as kunde_strasse,
      k.plz as kunde_plz,
      k.ort as kunde_ort,
      k.telefon as kunde_telefon,
      k.email as kunde_email,
      (SELECT faelligkeitsdatum FROM service_faelligkeiten WHERE fahrzeug_id = f.id ORDER BY faelligkeitsdatum ASC LIMIT 1) as service_faellig,
      (SELECT bezeichnung FROM service_faelligkeiten WHERE fahrzeug_id = f.id ORDER BY faelligkeitsdatum ASC LIMIT 1) as service_bezeichnung,
      (SELECT datum FROM termine WHERE fahrzeug_id = f.id AND typ = 'inspektion' ORDER BY datum ASC LIMIT 1) as inspektion_termin,
      (SELECT vermerk FROM termine WHERE fahrzeug_id = f.id AND typ = 'inspektion' ORDER BY datum ASC LIMIT 1) as inspektion_vermerk,
      (SELECT datum FROM termine WHERE fahrzeug_id = f.id AND typ = 'hu' ORDER BY datum ASC LIMIT 1) as hu_termin
    FROM fahrzeuge f
    LEFT JOIN kunden k ON f.kunde_id = k.id
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
    // Hilfsfunktion: Kunde anlegen/verknüpfen
    const createOrUpdateKunde = (fahrzeug, record) => {
      const kundeName = record.Name || record.Besitzer || record.Kunde;
      if (!fahrzeug || !kundeName) return;
      
      let kunde = stmts.getKundeByName.get(kundeName);
      
      if (!kunde) {
        // Neuen Kunden anlegen - Telefon und Handy separat
        stmts.insertKunde.run({
          kdnr: record.KdNr || null,
          anrede: record.Anrede || null,
          name: kundeName,
          strasse: record.Strasse || record.Adresse || null,
          plz: record.PLZ || null,
          ort: record.Ort || null,
          telefon: record.Telefon || null,
          handy: record.Handy || null,
          email: record.Email || null
        });
        kunde = stmts.getKundeByName.get(kundeName);
      } else {
        // Bestehenden Kunden aktualisieren (wenn Felder leer)
        stmts.updateKunde.run({
          id: kunde.id,
          name: kundeName,
          strasse: record.Strasse || record.Adresse || kunde.strasse,
          plz: record.PLZ || kunde.plz,
          ort: record.Ort || kunde.ort,
          telefon: record.Telefon || kunde.telefon,
          handy: record.Handy || kunde.handy,
          email: record.Email || kunde.email
        });
      }
      
      // Fahrzeug mit Kunde verknüpfen
      if (kunde) {
        stmts.linkFahrzeugKunde.run({ kunde_id: kunde.id, fahrzeug_id: fahrzeug.id });
      }
    };

    // HU-Daten importieren (mit Kundendaten!)
    for (const record of parsedData.hu || []) {
      if (!record.Fahrgestellnr) continue;
      
      const formattedKennzeichen = record.Kennzeichen ? formatKennzeichen(record.Kennzeichen) : null;
      const kundeName = record.Name || record.Besitzer || record.Kunde || null;
      
      stmts.insertFahrzeug.run({
        vin: record.Fahrgestellnr,
        kennzeichen: formattedKennzeichen,
        hersteller: record.Hersteller || null,
        modell: record.Modell || null,
        erstzulassung: record.Erstzulassung || null,
        kunde_name: kundeName
      });
      
      const fahrzeug = stmts.getFahrzeugByVin.get(record.Fahrgestellnr);
      
      // WICHTIG: Kunde aus PDF anlegen/verknüpfen!
      createOrUpdateKunde(fahrzeug, record);
      
      if (fahrzeug && record.HU_Datum) {
        // Prüfen ob dieser Termin schon existiert (Historie!)
        const existingTermin = stmts.getTerminByTypAndDatum.get(fahrzeug.id, 'hu', record.HU_Datum);
        if (!existingTermin) {
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
      }
      importStats.fahrzeuge++;
    }
    
    // Inspektion-Daten importieren (mit Kundendaten!)
    for (const record of parsedData.inspektion || []) {
      if (!record.Fahrgestellnr) continue;
      
      const formattedKennzeichen = record.Kennzeichen ? formatKennzeichen(record.Kennzeichen) : null;
      const kundeName = record.Name || record.Besitzer || record.Kunde || null;
      
      stmts.insertFahrzeug.run({
        vin: record.Fahrgestellnr,
        kennzeichen: formattedKennzeichen,
        hersteller: record.Hersteller || null,
        modell: null,
        erstzulassung: record.Erstzulassung || null,
        kunde_name: kundeName
      });
      
      const fahrzeug = stmts.getFahrzeugByVin.get(record.Fahrgestellnr);
      
      // WICHTIG: Kunde aus PDF anlegen/verknüpfen!
      createOrUpdateKunde(fahrzeug, record);
      
      if (fahrzeug && record.Inspektion) {
        // Prüfen ob dieser Termin schon existiert (Historie!)
        const existingTermin = stmts.getTerminByTypAndDatum.get(fahrzeug.id, 'inspektion', record.Inspektion);
        if (!existingTermin) {
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
      }
      importStats.fahrzeuge++;
    }
    
    // Service-Fälligkeiten importieren (aus XLSX)
    for (const record of parsedData.service || []) {
      if (!record.Fahrgestellnr) continue;
      
      const kundeName = record.Name || record.Besitzer || record.Kunde || null;
      const formattedKennzeichen = record.Kennzeichen ? formatKennzeichen(record.Kennzeichen) : null;
      
      // Fahrzeug anlegen/aktualisieren
      stmts.insertFahrzeug.run({
        vin: record.Fahrgestellnr,
        kennzeichen: formattedKennzeichen,
        hersteller: null,
        modell: null,
        erstzulassung: null,
        kunde_name: kundeName
      });
      
      const fahrzeug = stmts.getFahrzeugByVin.get(record.Fahrgestellnr);
      
      // Kunde anlegen/aktualisieren wenn Name vorhanden
      if (fahrzeug && kundeName) {
        let kunde = stmts.getKundeByName.get(kundeName);
        
        if (!kunde) {
          // Neuen Kunden anlegen mit allen Daten aus XLSX
          stmts.insertKunde.run({
            kdnr: null,
            anrede: null,
            name: kundeName,
            strasse: record.Adresse || null,
            plz: record.PLZ || null,
            ort: record.Ort || null,
            telefon: record.Telefon || record.Handy || null,
            email: record.Email || null
          });
          kunde = stmts.getKundeByName.get(kundeName);
        } else {
          // Bestehenden Kunden mit neuen Daten aktualisieren (wenn leer)
          stmts.updateKunde.run({
            id: kunde.id,
            name: kundeName,
            strasse: record.Adresse || kunde.strasse,
            plz: record.PLZ || kunde.plz,
            ort: record.Ort || kunde.ort,
            telefon: record.Telefon || record.Handy || kunde.telefon,
            email: record.Email || kunde.email
          });
        }
        
        // Fahrzeug mit Kunde verknüpfen
        if (kunde) {
          stmts.linkFahrzeugKunde.run({ kunde_id: kunde.id, fahrzeug_id: fahrzeug.id });
        }
      }
      
      if (fahrzeug && record.Faelligkeitsdatum) {
        // Datum formatieren (YYYY/MM/DD -> DD.MM.YYYY)
        let datum = record.Faelligkeitsdatum;
        if (datum.includes('/')) {
          const [y, m, d] = datum.split('/');
          datum = `${d}.${m}.${y}`;
        }
        
        // Prüfen ob diese Service-Fälligkeit schon existiert (Historie!)
        const existingService = stmts.getServiceByDatum.get(fahrzeug.id, datum);
        if (!existingService) {
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
      importStats.fahrzeuge++;
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

// Kunden functions
export function getKundeById(id) {
  return stmts.getKundeById.get(id);
}

export function getKundeByName(name) {
  return stmts.getKundeByName.get(name);
}

export function updateKunde(data) {
  return stmts.updateKunde.run(data);
}

export function getKundeByFahrzeug(fahrzeugId) {
  const fahrzeug = db.prepare(`SELECT kunde_id FROM fahrzeuge WHERE id = ?`).get(fahrzeugId);
  if (fahrzeug?.kunde_id) {
    return stmts.getKundeById.get(fahrzeug.kunde_id);
  }
  return null;
}

export function getKundeByVin(vin) {
  const fahrzeug = stmts.getFahrzeugByVin.get(vin);
  if (fahrzeug?.kunde_id) {
    return stmts.getKundeById.get(fahrzeug.kunde_id);
  }
  return null;
}

// Invite Token functions
export function createInviteToken(data) {
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 Tage
  db.prepare(`
    INSERT INTO invite_tokens (token, username, name, role, created_by, expires_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(token, data.username, data.name, data.role || 'user', data.created_by, expiresAt);
  return token;
}

export function getInviteToken(token) {
  return db.prepare(`SELECT * FROM invite_tokens WHERE token = ? AND used = 0`).get(token);
}

export function useInviteToken(token) {
  return db.prepare(`UPDATE invite_tokens SET used = 1, used_at = CURRENT_TIMESTAMP WHERE token = ?`).run(token);
}

export function getAllInviteTokens() {
  return db.prepare(`SELECT * FROM invite_tokens ORDER BY created_at DESC`).all();
}

export function deleteInviteToken(id) {
  return db.prepare(`DELETE FROM invite_tokens WHERE id = ?`).run(id);
}

export function updateUserActive(userId, active) {
  return db.prepare(`UPDATE users SET active = ? WHERE id = ?`).run(active ? 1 : 0, userId);
}

export function updateUserRole(userId, role) {
  return db.prepare(`UPDATE users SET role = ? WHERE id = ?`).run(role, userId);
}

export default db;
