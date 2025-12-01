const STORE_NAME = "songs";
const STORE_PLAYLIST = "playlists";
const STORE_PLAYLIST_SONGS = "playlists_songs";
window.currentPlaylistId = null;

function buildPlaylistCard(pl) {
    const div = document.createElement("div");
    div.className = "card";

    div.innerHTML = `
        <img src="https://via.placeholder.com/300x200?text=${encodeURIComponent(pl.name)}">
        <h3>${pl.name}</h3>
        <button onclick="openPlaylist(${pl.id})">Abrir</button>
        <button class="playbtn" data-id="ID_DE_LA_PLAYLIST">Reproducir</button>
        <button class="renameButton">Renombrar</button>
        <button class="deleteButton">Borrar</button>
    `;

    //openPlaylist() 35 a 

    // Reproducir Playlist  62 a 
    div.querySelector(".playbtn").onclick = () => {
        playPlaylist(pl.id)
    };

    // Renombrar playlist   125 a
    div.querySelector(".renameButton").onclick = () => {
        renamePlaylistPrompt(pl);
    };

    // Borrar playlist      175 a
    div.querySelector(".deleteButton").onclick = () => {
        deletePlaylist(pl.id);
    };


    document.getElementById("playlist-cards").appendChild(div);
}

async function openPlaylist(id) {
    window.currentPlaylistId = id;
    const rel = await getPlaylistSongs(id);
    const songs = [];

    for (const r of rel) {
        const s = await idbGetSong(r.song_id);
        if (s) songs.push(s);
    }

    buildSongCards(songs);
}

async function getPlaylistSongs(playlistId) {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(["playlist_songs"], "readonly");
        const store = tx.objectStore("playlist_songs");

        const req = store.getAll();
        req.onsuccess = () => {
            const list = req.result.filter(x => Number(x.playlist_id) === Number(playlistId));
            resolve(list);
        };
        req.onerror = reject;
    });
}

// Devuelve una canción por su id desde IndexedDB
async function idbGetSong(id) {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function playPlaylist(playlistId) {
    // 1. Obtener relaciones playlist → canciones
    const rel = await getPlaylistSongs(playlistId);
    if (!rel.length) {
        alert("La playlist está vacía.");
        return;
    }

    // 2. Convertir IDs a canciones reales
    let songs = [];
    for (const r of rel) {
        const s = await idbGetSong(r.song_id);
        if (s) songs.push(s);
    }

    if (!songs.length) {
        alert("No se encontraron canciones.");
        return;
    }

    // 3. REEMPLAZAR el arreglo global del reproductor
    window.songs = songs;
    window.currentIndex = 0;

    // 4. Mostrar las cards de esa playlist
    buildSongCards(songs);

    // 5. REPRODUCIR PRIMER TEMA
    if (typeof loadSong === "function") {
        loadSong(window.currentIndex);
        if (typeof playSong === "function") playSong();
    } else {
        console.warn("⚠️ No existe loadSong() o playSong(), revisá tu player.js");
    }

    console.log("▶ Reproduciendo playlist:", playlistId);
}

function loadSong(index) {
    const audio = document.getElementById("audio");
    const song = window.songs[index];

    if (!song) {
        console.error("Canción inexistente en índice", index);
        return;
    }

    audio.src = song.url;

    // si tenés un título en pantalla
    const titleEl = document.getElementById("current-title");
    if (titleEl) titleEl.textContent = song.title;

    console.log("CARGADA:", song.title);
}

function playSong() {
    const audio = document.getElementById("audio");
    audio.play().catch(err => {
        console.warn("No se pudo reproducir automáticamente:", err);
    });
}

function renamePlaylistPrompt(pl) {
    const nuevo = prompt("Nuevo nombre para la playlist:", pl.name);
    if (!nuevo || nuevo.trim() === "") return;

    renamePlaylist(pl.id, nuevo.trim());
    refreshPlaylistsView(); // refrescar la vista
}

async function renamePlaylist(id, newName) {
    const db = await openIDB();

    return new Promise((resolve, reject) => {
        const tx = db.transaction(["playlists"], "readwrite");
        const store = tx.objectStore("playlists");

        const req = store.get(id);

        req.onsuccess = () => {
            const pl = req.result;
            if (!pl) {
                alert("Playlist no encontrada.");
                return reject("No existe");
            }

            pl.name = newName;

            const updateReq = store.put(pl);

            updateReq.onsuccess = () => {
                updatePlaylistCard(id, newName);
                resolve();
            };
            updateReq.onerror = reject;
        };

        req.onerror = reject;
    });
}

function updatePlaylistCard(id, newName) {
    const card = document.querySelector(`.playlist-card[data-id="${id}"]`);
    if (!card) return;

    // Cambiar h3
    card.querySelector(".playlist-title").innerText = newName;

    // Cambiar imagen
    const img = card.querySelector("img");
    img.src = `https://via.placeholder.com/300x200?text=${encodeURIComponent(newName)}`;
}

async function deletePlaylist(id) {
    const db = await openIDB();
    const tx = db.transaction(["playlists", "playlist_songs"], "readwrite");

    const playlistsStore = tx.objectStore("playlists");
    const relStore = tx.objectStore("playlist_songs");

    playlistsStore.delete(id);

    // obtener TODAS las relaciones playlist-song
    const req = relStore.getAll();

    req.onsuccess = () => {
        const all = req.result; // acá sí existe y es iterable

        for (const r of all) {
            if (r.playlist_id === id) {
                relStore.delete(r.id);
            }
        }

        console.log("Playlist eliminada correctamente");

        refreshPlaylistsView(); // refrescar la vista
    };

    req.onerror = () => {
        console.error("Error leyendo playlist_songs");
    };
}

async function refreshPlaylistsView() {
    const db = await openIDB();
    const tx = db.transaction("playlists", "readonly");
    const store = tx.objectStore("playlists");

    const req = store.getAll();
    req.onsuccess = () => {
        const list = req.result;
        const container = document.getElementById("playlist-cards");

        container.innerHTML = ""; // limpiar pantalla

        for (const pl of list) {
            buildPlaylistCard(pl); // vuelve a dibujar todas las playlists
        }
    };
}

async function loadAllPlaylists() {
    const db = await openIDB();
        return new Promise((resolve, reject) => {
        const tx = db.transaction(["playlists"], "readonly");
        const store = tx.objectStore("playlists");
        const req = store.getAll();

        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

loadAllPlaylists().then(list => {
    list.forEach(pl => buildPlaylistCard(pl));
});

async function createPlaylist() {
    let name = document.getElementById("new-playlist-name").value.trim();
    if (!name) return alert("Poné un nombre.");

    const pl = await idbAddPlaylist(name);

    buildPlaylistCard(pl);

    //borrar el contenido del textbox
    alert("Playlist creada.");
}

async function idbAddPlaylist(name) {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(["playlists"], "readwrite");
        const store = tx.objectStore("playlists");

        const obj = {
            id: Date.now(),
            name
        };

        const req = store.add(obj);

        req.onsuccess = () => resolve(obj);
        req.onerror = () => reject(req.error);
    });
}






window.playlists = [
//{
//name: "Favoritas",
//songs: [1, 2, 3] // índices del array songs
//},
//{
//name: "Electro",
//songs: [3, 2]
//}
];