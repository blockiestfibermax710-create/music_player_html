const audio = document.getElementById("audio");
const songList = document.getElementById("song-list");
const playlistList = document.getElementById("playlist-list");

let queue = [];        // array de índices hacia window.songs
let currentPos = 0;    // posición dentro de queue
let currentPlaylist = null; // si hay playlist activa, referencia al objeto

// Inicializa queue por defecto (todos los indices)
function resetQueueToAllSongs() {
    queue = window.songs.map((s, i) => i);
    currentPos = 0;
    currentPlaylist = null;
}

// Carga una playlist como queue (recibe objeto playlist)
function loadPlaylist(pl) {
    if (!Array.isArray(pl.songs) || pl.songs.length === 0) {
        console.warn("Playlist vacía o inválida");
        return;
    }
    queue = pl.songs.slice(); // copia de los índices
    currentPos = 0;
    currentPlaylist = pl;
    loadFromQueue(currentPos);
}

// Carga la canción que está en queue[pos]
function loadFromQueue(pos) {
    if (!queue || queue.length === 0) return;
    pos = ((pos % queue.length) + queue.length) % queue.length; // safe wrap
    currentPos = pos;
    const songIndex = queue[currentPos];
    const song = window.songs[songIndex];
    if (!song) return;
    audio.src = song.url;
    audio.play().catch(err => {
        // algunos navegadores requieren interacción del usuario para autoplay
        console.warn("play() rechazado:", err);
    });

    // Actualizar Media Session metadata si está disponible
    if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: song.title || "",
            artwork: song.artwork || [] // opcional: [{src:"...",sizes:"512x512",type:"image/png"}]
        });
    }

    highlightCurrentSongInUI(songIndex);
}

// siguiente
function nextSong() {
    if (!queue || queue.length === 0) return;
    currentPos = (currentPos + 1) % queue.length;
    loadFromQueue(currentPos);
}

// anterior (si audio.currentTime > 3 -> reinicia, si no -> va a anterior)
function prevSong() {
    if (!queue || queue.length === 0) return;
    if (audio.currentTime > 3) {
        audio.currentTime = 0;
        audio.play();
        return;
    }
    currentPos = (currentPos - 1 + queue.length) % queue.length;
    loadFromQueue(currentPos);
}

// evento cuando termina la cancion
audio.onended = nextSong;

// Opcional: resaltar en la UI la canción actual
function highlightCurrentSongInUIObsoleto(songIndex) {
    // limpiar
    const items = songList.querySelectorAll("li");
    items.forEach(li => {
        li.style.opacity = "1";
        if (parseInt(li.dataset.songIndex, 10) === songIndex) {
            li.style.color = "#00aaff";
        } else {
            li.style.color = "";
        }
    });
}

function highlightCurrentSongInUI(songIndex) {
    const currentSong = window.songs[songIndex];
    if (!currentSong) return;

    const cards = document.querySelectorAll("#song-cards .card");

    cards.forEach(card => {
        // limpiar estilo
        card.style.opacity = "1";
        card.style.border = "none";

        // verificar si esta card es la canción actual
        if (parseInt(card.dataset.id) === currentSong.id) {
            card.style.border = "3px solid #00aaff";
            card.scrollIntoView({ behavior: "smooth", block: "center" });
        }
    });
}

// Controles botones prev/next (si ya los tenes en HTML)
document.getElementById("next").onclick = nextSong;
document.getElementById("prev").onclick = prevSong;

// Media Session: controlar desde la notificación / bloqueo pantalla
if ('mediaSession' in navigator) {
    navigator.mediaSession.setActionHandler('play', () => { audio.play(); });
    navigator.mediaSession.setActionHandler('pause', () => { audio.pause(); });
    navigator.mediaSession.setActionHandler('previoustrack', () => { prevSong(); });
    navigator.mediaSession.setActionHandler('nexttrack', () => { nextSong(); });
    // opcional: seekbackward / seekforward si querés
}



//------------------------------------------------------------------
//Boton Agregar cancion
async function addSongFromURL() {
    const url = prompt("Pega el link del MP3 de GitHub:");

    if (!url) return;

    // ✅ Extraer nombre del archivo
    const title = extractSongName(url); // quitar .mp3

    // ✅ Convertir a RAW
    let rawLink = url;
    if (url.includes("/blob/")) {
        rawLink = url.replace("/blob/", "/raw/");
    }

    // ✅ Crear objeto canción
    const newSong = {
        id: Date.now(),
        title: title,
        url: rawLink
    };

    // ✅ Agregar a window.songs
    window.songs.push(newSong);
    
    await idbAddSong(newSong);

    // Refrescar memoria
    window.songs = await idbGetAll();

    //await addSong(rawLink);     // Guarda en IndexedDB
    await refreshSongs();   // Actualiza window.songs
    buildSongCards();

    console.log("Canción agregada:", window.songs);
}

//Boton Importar
function triggerImport() {
    const fileInput = document.getElementById("importDB");
    if (!fileInput.files.length) {
        alert("Selecciona un archivo songs.db primero");
        return;
    }

    importSQLite(fileInput.files[0]);
}

let list = null;

//Boton Volver a la biblioteca
function biblioteca() {
    buildSongCards(list);
}

//-------------------------------------------------------
window.addEventListener("DOMContentLoaded", async () => {
    await refreshSongs();
    await openIDB();
    await initSQLite();
    loadSongsFromIDB();
    list = window.songs;
    console.log("Canciones cargadas:", window.songs);

    console.log("Playlists importadas:", await loadAllPlaylists());
    console.log("Relaciones importadas:", await getAllPlaylistRelations());
});

// Init
resetQueueToAllSongs();
