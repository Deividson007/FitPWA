import initSqlJs from 'sql.js'
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url'

const STORE = 'sqlite'; const KEY = 'fitflow-database';
let database, idb, storageChain = Promise.resolve()

function openStorage() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('fitflow-local', 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}
function readStored() {
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(STORE, 'readonly'); const req = tx.objectStore(STORE).get(KEY)
    req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error)
  })
}
function writeStored(bytes) {
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(bytes, KEY)
    tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error || Error('Operação de armazenamento cancelada'))
  })
}
const SCHEMA = `
CREATE TABLE IF NOT EXISTS profile (
  id INTEGER PRIMARY KEY CHECK(id = 1), name TEXT NOT NULL DEFAULT '', age INTEGER, weight REAL,
  objective TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS exercises (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, muscle TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'Força', description TEXT NOT NULL DEFAULT '',
  mode TEXT NOT NULL DEFAULT 'time', created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS weights (
  id INTEGER PRIMARY KEY AUTOINCREMENT, day TEXT NOT NULL, weight REAL NOT NULL,
  notes TEXT NOT NULL DEFAULT '', created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS workouts (
  id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, level TEXT NOT NULL DEFAULT 'Iniciante',
  rounds INTEGER NOT NULL DEFAULT 1, round_rest INTEGER NOT NULL DEFAULT 60,
  description TEXT NOT NULL DEFAULT '', created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS workout_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT, workout_id INTEGER NOT NULL REFERENCES workouts(id),
  exercise_id INTEGER NOT NULL REFERENCES exercises(id), sort_order INTEGER NOT NULL,
  sets INTEGER NOT NULL DEFAULT 1, reps INTEGER NOT NULL DEFAULT 10,
  duration_sec INTEGER NOT NULL DEFAULT 30, rest_sec INTEGER NOT NULL DEFAULT 15,
  load_kg REAL NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT, workout_id INTEGER, workout_name TEXT NOT NULL,
  started_at TEXT NOT NULL, ended_at TEXT NOT NULL, duration_sec INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed', movements INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS session_exercises (
  id INTEGER PRIMARY KEY AUTOINCREMENT, session_id INTEGER NOT NULL,
  exercise_id INTEGER, exercise_name TEXT NOT NULL, sets_completed INTEGER NOT NULL,
  reps INTEGER NOT NULL, load_kg REAL NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS load_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT, exercise_id INTEGER NOT NULL, day TEXT NOT NULL,
  load_kg REAL NOT NULL, reps INTEGER NOT NULL DEFAULT 0, session_id INTEGER
);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_weights_day ON weights(day);
CREATE INDEX IF NOT EXISTS idx_sessions_day ON sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_load_exercise ON load_history(exercise_id, day);
`

export async function initializeDatabase() {
  if (database) return
  if (!window.indexedDB) throw new Error('Este navegador não oferece IndexedDB. Use Chrome, Edge ou Safari atualizado fora do modo privado.')
  const SQL = await initSqlJs({ locateFile: () => wasmUrl })
  idb = await openStorage()
  const stored = await readStored()
  database = stored ? new SQL.Database(new Uint8Array(stored)) : new SQL.Database()
  database.run('PRAGMA foreign_keys = ON')
  database.run(SCHEMA)
  await persist()
}

export function all(sql, params = []) {
  if (!database) throw Error('Banco ainda não inicializado')
  const stmt = database.prepare(sql)
  try { stmt.bind(params); const rows = []; while (stmt.step()) rows.push(stmt.getAsObject()); return rows }
  finally { stmt.free() }
}
export function one(sql, params = []) { return all(sql, params)[0] || null }
export function exec(sql, params = []) { database.run(sql, params) }
export function lastId() { return one('SELECT last_insert_rowid() AS id').id }
export function persist() {
  const bytes = database.export()
  // Queue snapshots so a slower earlier save cannot overwrite a newer one.
  storageChain = storageChain.catch(() => {}).then(() => writeStored(bytes))
  return storageChain
}
export async function mutation(fn) {
  database.run('BEGIN TRANSACTION')
  try { const value = fn(); database.run('COMMIT'); await persist(); return value }
  catch (e) { try { database.run('ROLLBACK') } catch {} throw e }
}
export function downloadBackup() {
  const bytes = database.export(); const url = URL.createObjectURL(new Blob([bytes], {type:'application/x-sqlite3'}))
  const a = document.createElement('a'); a.href = url; a.download = `fitflow-${new Date().toISOString().slice(0,10)}.sqlite`; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}
export async function restoreBackup(file) {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const SQL = await initSqlJs({ locateFile: () => wasmUrl })
  const candidate = new SQL.Database(bytes)
  try {
    const found = candidate.exec("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('profile','exercises','workouts')")
    if ((found[0]?.values?.length || 0) !== 3) throw Error('Arquivo SQLite não é um backup válido do FitFlow')
    await storageChain
    database.close(); database = candidate
    database.run('PRAGMA foreign_keys=ON'); database.run(SCHEMA)
    await persist()
  } catch (e) { if (database !== candidate) candidate.close(); throw e }
}
export function dbStats() {
  return { exercises: one('SELECT COUNT(*) AS n FROM exercises').n, workouts: one('SELECT COUNT(*) AS n FROM workouts').n,
    sessions: one('SELECT COUNT(*) AS n FROM sessions').n, weights: one('SELECT COUNT(*) AS n FROM weights').n }
}
