// Networking via Firebase Realtime Database
(function(){
  const app = firebase.initializeApp(window.FB_CONFIG);
  const db = firebase.database();

  const LOBBY_LIMIT = 10;

  function randCode() {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let s = "";
    for (let i=0;i<4;i++) s += letters[Math.floor(Math.random()*letters.length)];
    return s;
  }

  async function createLobby(mapIndex, hostName) {
    // Find an unused code
    let code = randCode();
    let tries = 0;
    while (tries++ < 50) {
      const snap = await db.ref("lobbies/"+code).get();
      if (!snap.exists()) break;
      code = randCode();
    }
    const lobby = {
      code, mapIndex, createdAt: Date.now(), started: false, hostId: null
    };
    await db.ref("lobbies/"+code).set(lobby);
    return code;
  }

  async function joinLobby(code, player) {
    const lobbyRef = db.ref("lobbies/"+code);
    const snap = await lobbyRef.get();
    if (!snap.exists()) throw new Error("Lobby not found");
    if (snap.val().started) throw new Error("Match already started");
    const playersRef = db.ref(`players/${code}`);
    const ps = await playersRef.get();
    if (ps.exists() && Object.keys(ps.val()).length >= LOBBY_LIMIT) {
      throw new Error("Lobby full (max 10)");
    }
    await playersRef.child(player.id).set(player);
    await db.ref(`presence/${code}/${player.id}`).onDisconnect().remove();
    await db.ref(`players/${code}/${player.id}`).onDisconnect().remove();
    await db.ref(`bullets/${code}/${player.id}`).onDisconnect().remove();
    await db.ref(`inputs/${code}/${player.id}`).onDisconnect().remove();
    await db.ref(`presence/${code}/${player.id}`).set(true);
  }

  async function leaveLobby(code, id) {
    await db.ref(`presence/${code}/${id}`).remove();
    await db.ref(`players/${code}/${id}`).remove();
    await db.ref(`bullets/${code}/${id}`).remove();
    await db.ref(`inputs/${code}/${id}`).remove();
  }

  async function startMatch(code) {
    await db.ref("lobbies/"+code).update({ started: true, startedAt: Date.now() });
  }

  function onPlayers(code, cb) {
    return db.ref("players/"+code).on("value", (snap)=> cb(snap.val()||{}));
  }
  function onLobby(code, cb) {
    return db.ref("lobbies/"+code).on("value", (snap)=> cb(snap.val()));
  }
  function onBullets(code, cb) {
    return db.ref("bullets/"+code).on("value", (snap)=> cb(snap.val()||{}));
  }
  function setPlayer(code, id, state) {
    return db.ref(`players/${code}/${id}`).set(state);
  }
  function setInputs(code, id, input) {
    return db.ref(`inputs/${code}/${id}`).set(input);
  }
  function pushBullet(code, ownerId, bullet) {
    const key = db.ref().push().key;
    return db.ref(`bullets/${code}/${ownerId}/${key}`).set(bullet);
  }
  function clearBullets(code, ownerId) {
    return db.ref(`bullets/${code}/${ownerId}`).remove();
  }
  function writePickups(code, pickups) {
    return db.ref(`pickups/${code}`).set(pickups);
  }
  function onPickups(code, cb) {
    return db.ref(`pickups/${code}`).on("value", (snap)=>cb(snap.val()||{}));
  }
  function setHost(code, id) {
    return db.ref("lobbies/"+code).update({ hostId: id });
  }

  window.NET = { createLobby, joinLobby, leaveLobby, startMatch, onPlayers, onLobby, onBullets, setPlayer, setInputs, pushBullet, clearBullets, writePickups, onPickups, setHost, db };
})();
