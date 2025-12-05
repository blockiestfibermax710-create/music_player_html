// CARDS
function buildSongCards(list)
{
    const songs = list || window.songs;
    const container = document.getElementById("song-cards");

    // 🔥 limpiar ANTES de reconstruir
    container.innerHTML = "";

    songs.forEach((song, index) => {
    let div = document.createElement("div");
    div.className = "card";

    div.dataset.id = song.id;        // ⬅⬅⬅ NECESARIO PARA DELETE
    div.dataset.titulo  = song.title || "";

    div.innerHTML = `
        <img src="https://via.placeholder.com/300x200?text=${encodeURIComponent(song.title)}" />
        <h3>${song.title}</h3>
        <button class="playbtn">Reproducir</button>
        <button class="delbtn" onclick="deleteSong(${song.id})">Eliminar</button>
        <button class="addToPlaylistBtn">➕ Añadir a playlist</button>
        <button onclick="deleteSongFromPlaylist(currentPlaylistId, ${song.id})">Quitar</button>
    `;

    div.querySelector(".addToPlaylistBtn").onclick = () => showPlaylistSelector(song);

    div.querySelector(".playbtn").onclick = () => {
            // Si clicás en una canción individual, cargamos la cola global y situamos currentPos en esa canción
            resetQueueToAllSongs();
            currentPos = queue.indexOf(index);
            if (currentPos === -1) {
                // por si algo raro, buscamos manualmente
                currentPos = 0;
            }
            loadFromQueue(currentPos);
    };

    container.appendChild(div);
});
}

async function deleteSong(id) {
    if (!confirm("¿Borrar esta canción?")) return;

    const db = await openIDB();
    // 1. Borrar de IndexedDB
    const tx = db.transaction("songs", "readwrite");
    tx.objectStore("songs").delete(id);

    tx.oncomplete = async () => {

        // 2. Borrar también de window.songs
        window.songs = window.songs.filter(s => s.id !== id);

        // 3. Borrar la card del DOM
        document.querySelector(`.card[data-id="${id}"]`)?.remove();

        // 4. También borrarla de SQLite si existe
        if (sqlDB) {
            try {
                sqlDB.run("DELETE FROM songs WHERE id = ?", [id]);
            } catch (err) {
                console.warn("SQLite aún no cargado, no se borró ahí.");
            }
        }

        console.log("Canción eliminada correctamente.");
    };
}

async function deleteSongFromPlaylist(playlistId, songId) {
    const db = await openIDB();

    return new Promise((resolve, reject) => {
        const tx = db.transaction("playlist_songs", "readwrite");
        const store = tx.objectStore("playlist_songs");

        // obtener todas las relaciones
        const req = store.getAll();

        req.onsuccess = () => {
            const all = req.result;

            // encontrar la relación exacta
            const rel = all.find(r => 
                Number(r.playlist_id) === Number(playlistId) &&
                Number(r.song_id) === Number(songId)
            );

            if (!rel) {
                console.warn("Relación playlist → canción no encontrada");
                return resolve();
            }

            // borrar solo esa relación
            store.delete(rel.id);

            tx.oncomplete = () => {
                console.log("Se eliminó SOLO de la playlist");
                resolve();
            };
        };

        req.onerror = reject;
        openPlaylist(playlistId);
    });
}

function showAddToPlaylistMenu(songId) {
    loadAllPlaylists().then(playlists => {
        if (playlists.length === 0) {
            return alert("No hay playlists creadas.");
        }

        const names = playlists
            .map(pl => `${pl.id}: ${pl.name}`)
            .join("\n");

        const pick = prompt(
            "Elegí la playlist donde agregar la canción:\n\n" + names
        );

        if (!pick) return;

        const playlistId = parseInt(pick);
        if (isNaN(playlistId)) {
            return alert("ID inválido.");
        }

        addSongToPlaylist(playlistId, songId)
            .then(() => alert("Canción agregada a la playlist"))
            .catch(err => alert("Error: " + err));
    });
}

async function showPlaylistSelector(song) {
    const playlists = await loadAllPlaylists();

    if (!playlists.length) {
        alert("No hay playlists. Creá una primero.");
        return;
    }

    let txt = "Elegí playlist:\n";
    playlists.forEach((p, i) => {
        txt += `${i + 1}) ${p.name}\n`;
    });

    const num = parseInt(prompt(txt));
    if (!num || num < 1 || num > playlists.length) return;

    const selected = playlists[num - 1];

    addSongToPlaylist2(selected.id, song.id);
}


async function addSongToPlaylist(playlistId, songId) {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(["playlist_songs"], "readwrite");
        const store = tx.objectStore("playlist_songs");

        store.add({
            playlist_id: playlistId,
            song_id: songId
        });

        tx.oncomplete = resolve;
        tx.onerror = reject;
    });
}

async function addSongToPlaylist2(playlistId, songId) {
    const db = await openIDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(["playlist_songs"], "readwrite");
        const store = tx.objectStore("playlist_songs");

        const obj = {
            id: Date.now(),
            playlist_id: playlistId,
            song_id: songId
        };

        const req = store.add(obj);

        req.onsuccess = () => {
            alert("Canción agregada a la playlist 👍");
            resolve();
        };
        req.onerror = () => reject(req.error);
    });
}

// === Extract file name from URL ===
function extractSongName(url) {
    try {
        const decoded = decodeURIComponent(url);
        const filename = decoded.split("/").pop(); // "1-Dave Rodgers - Space Boy.mp3"
        return filename.replace(".mp3", "");
    } catch {
        return "Unknown Title";
    }
}



window.songs = [
{
title: "My Shooter (Short Club Edit)",
url: "https://github.com/blockiestfibermax710-create/music_player_html/raw/main/My%20Shooter%20(Short%20Club%20Edit).mp3"
},
{
title: "musica2",
url: "https://github.com/blockiestfibermax710-create/music_player_html/raw/main/Initial%20D%201st%20Stage/1-Dave%20Rodgers%20-%20Space%20Boy.mp3"
},
{
title: "musica3",
url: "https://github.com/blockiestfibermax710-create/music_player_html/raw/main/Initial%20D%201st%20Stage/2-Edo%20Boys%20-%20No%20One%20Sleeps%20In%20Tokyo.mp3"
},
{
title: "musica4",
url: "https://github.com/blockiestfibermax710-create/music_player_html/raw/main/Initial%20D%201st%20Stage/3-Jilly%20-%20Be%20My%20Baby.mp3"
},

// 👉 Agregás aquí las demás canciones igual que esta
];