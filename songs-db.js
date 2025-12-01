// === IndexedDB: Songs Database ===
const DB_NAME = "musicDB";

let idb;

// === Sync DB → window.songs ===
async function refreshSongs() {
    const songsFromDB = await getAllSongs();
    window.songs = songsFromDB;
}

// === Return all songs ===
async function getAllSongs() {
    const db = await openIDB();
    return new Promise(resolve => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
    });
}

function openIDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 3);
        req.onupgradeneeded = e => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains("songs")) {
                db.createObjectStore("songs", { keyPath: "id", autoIncrement: true });
            }

            if (!db.objectStoreNames.contains("playlists")) {
                db.createObjectStore("playlists", { keyPath: "id", autoIncrement: true });
            }

            if (!db.objectStoreNames.contains(STORE_PLAYLIST_SONGS)) {
                db.createObjectStore(STORE_PLAYLIST_SONGS, { keyPath: "id", autoIncrement: true });
            }
            //db.createObjectStore(STORE_NAME, { keyPath: "id", autoIncrement: true });
        };
        //req.onsuccess = e => { idb = e.target.result; res(); };
        req.onsuccess = e => resolve(e.target.result);
        req.onerror = () => reject(req.error);
    });
}

let sqlDB = null;

async function initSQLite() {
    const SQL = await initSqlJs({
        locateFile: f => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.6.2/${f}`
    });

    sqlDB = new SQL.Database();

    sqlDB.run(`
        CREATE TABLE IF NOT EXISTS songs (
            id INTEGER PRIMARY KEY,
            url TEXT,
            title TEXT
        );
    `);
}

async function loadSongsFromIDB() {
    const db = await openIDB();
    const tx = db.transaction("songs", "readonly");
    const req = tx.objectStore("songs").getAll();

    req.onsuccess = () => {
        const list = req.result;
        console.log("Cargado desde IndexedDB:", list);

        window.songs = list;
        buildSongCards();
    };
}
