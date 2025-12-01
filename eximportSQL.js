async function exportSQLite() {
    await syncIndexedDBtoSQLite();  // 🟢 AGREGADO

    const data = sqlDB.export();
    const blob = new Blob([data], { type: "application/octet-stream" });

    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "songs.db";
    a.click();
}

async function syncIndexedDBtoSQLite() {
    // Crear tabla si no existe
    sqlDB.run(`
        CREATE TABLE IF NOT EXISTS songs(
            id INTEGER PRIMARY KEY,
            url TEXT,
            title TEXT
        );
    `);

    sqlDB.run(`
        CREATE TABLE IF NOT EXISTS playlists(
            id INTEGER PRIMARY KEY,
            name TEXT
        );
    `);

    sqlDB.run(`
        CREATE TABLE IF NOT EXISTS playlist_songs(
            playlist_id INTEGER,
            song_id INTEGER
        );
    `);

    // Borrar tabla para no duplicar
    sqlDB.run("DELETE FROM songs;");
    sqlDB.run("DELETE FROM playlists;");
    sqlDB.run("DELETE FROM playlist_songs;");
    
    // Cargar canciones desde IndexedDB
    const songs = await idbGetAll();
    const playlists = await loadAllPlaylists();
    const rel = await getAllPlaylistRelations();
    
    // Insert songs en SQLite
    let stmt = sqlDB.prepare("INSERT INTO songs VALUES (?, ?, ?)");
    songs.forEach(s => stmt.run([s.id, s.url, s.title]));
    stmt.free();
    //for (const s of songs) {
    //    stmt.run([s.id, s.url, s.title]);
    //}
    //stmt.free();

    // Insert playlists
    stmt = sqlDB.prepare("INSERT INTO playlists VALUES (?, ?)");
    playlists.forEach(p => stmt.run([p.id, p.name]));
    stmt.free();

    // Insert playlist relations
    stmt = sqlDB.prepare("INSERT INTO playlist_songs VALUES (?, ?)");
    rel.forEach(r => stmt.run([r.playlist_id, r.song_id]));
    stmt.free();
}

async function idbGetAll() {
    const db = await openIDB();
    return new Promise(res => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const req = tx.objectStore(STORE_NAME).getAll();
        req.onsuccess = () => res(req.result);
    });
}

async function getAllPlaylistRelations() {
    const db = await openIDB();
    return new Promise(res => {
        const tx = db.transaction("playlist_songs", "readonly");
        const req = tx.objectStore("playlist_songs").getAll();
        req.onsuccess = () => res(req.result);
    });
}

async function importSQLite(file) {
    if (!file) return alert("Seleccioná un archivo válido");

    try {
        const buffer = await file.arrayBuffer();
        const SQL = await initSqlJs({
            locateFile: f => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.6.2/${f}`
        });
        const dbSQL = new SQL.Database(new Uint8Array(buffer));

        // === Songs ===
        const res = dbSQL.exec("SELECT * FROM songs");
        const rows = res[0]?.values || [];

        // Limpiar IDB
        let db = await openIDB();
        const txClear = db.transaction(STORE_NAME, "readwrite");
        txClear.objectStore(STORE_NAME).clear();
        await new Promise(r => txClear.oncomplete = r);

        // Añadir canciones de SQLite a IndexedDB
        for (const row of rows) {
            await idbAddSong({ id: row[0], url: row[1], title: row[2] });
        }

        // === Playlists ===
        const playlistsRes = dbSQL.exec("SELECT * FROM playlists");
        const playlistRows = playlistsRes[0]?.values || [];

        const txP = db.transaction("playlists", "readwrite");
        txP.objectStore("playlists").clear();
        await new Promise(r => txP.oncomplete = r);

        for (const row of playlistRows) {
            await idbAddPlaylistImported({ id: row[0], name: row[1] });
        }

        // === Playlist Songs ===
        const relRes = dbSQL.exec("SELECT playlist_id, song_id FROM playlist_songs");
        const relRows = relRes[0]?.values || [];
            
        const txR = db.transaction("playlist_songs", "readwrite");
        txR.objectStore("playlist_songs").clear();
        await new Promise(r => txR.oncomplete = r);
            
        for (const row of relRows) {
            await addPlaylistRelationImported(row[0], row[1]);
        }

        // Actualizar window.songs desde IndexedDB
        //const songs = await idbGetAll();
        //window.songs = songs;

        // Reconstruir lista y cards
        //document.getElementById("song-cards").innerHTML = "";
        //buildSongCards();

        // 🔥 ANDROFIX: Android necesita cerrar y reabrir IDB o queda corrupta
        await new Promise(res => setTimeout(res, 300));
        idb = await openIDB();

        // Recargar canciones
        window.songs = await idbGetAll();

        // 🔥 Recargar playlists DESPUÉS de reabrir IDB
        const pls = await loadAllPlaylists();

        // Reconstruir UI
        document.getElementById("playlist-cards").innerHTML = "";
        pls.forEach(pl => buildPlaylistCard(pl));

        document.getElementById("song-cards").innerHTML = "";
        buildSongCards(window.songs);

        alert("Base importada correctamente.");

    } catch (err) {
        console.error("ERROR AL IMPORTAR:", err);
        alert("Error al importar la base");
    }
}

async function idbAddSong(song) {
    const db = await openIDB();
    return new Promise(res => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).add(song);
        tx.oncomplete = () => res();
    });
}

async function idbAddPlaylistImported(pl) {
    const db = await openIDB();
    const tx = db.transaction("playlists", "readwrite");
    tx.objectStore("playlists").add(pl);
    return new Promise(r => tx.oncomplete = r);
}

async function addPlaylistRelationImported(playlistId, songId) {
    const db = await openIDB();
    const tx = db.transaction("playlist_songs", "readwrite");
    tx.objectStore("playlist_songs").add({ playlist_id: playlistId, song_id: songId });
    return new Promise(r => tx.oncomplete = r);
}
