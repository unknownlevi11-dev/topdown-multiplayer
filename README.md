# Topdown Arena — 2D Multiplayer Shooter (GitHub Pages + Firebase)

A simple, fast 2D top-down multiplayer shooter that runs entirely in the browser. Host on **GitHub Pages**, use **Firebase Realtime Database** for multiplayer, and share a **4-letter lobby code** so anyone can join from anywhere. Up to **10 players** per lobby.

## Features
- 5 maps, clean Host/Join flow, custom player names.
- Start with a **Pistol**; collect **orbs** to upgrade (Auto Pistol, AR Semi, AR Auto, Shotgun).
- **Shields** spawn randomly; each pickup grants **half a blue heart** (max 3 blue hearts).
- Blood hit particles, 5 red hearts (lose **half a heart** per hit).
- Max 10 players per lobby, 4-letter codes.
- Built with Canvas + Firebase Realtime Database (client-only).

---

## 1) Set up Firebase (free tier)
1. Go to **https://console.firebase.google.com** → *Add project*.
2. In *Build → Realtime Database*, create a database (start in **test mode** for development).
3. In *Project settings → General → Your apps*, add a **Web app**, then copy the config values.
4. Paste them into `config.js`:
   ```js
   window.FB_CONFIG = {
     apiKey: "...",
     authDomain: "...",
     databaseURL: "https://<project-id>-default-rtdb.firebaseio.com",
     projectId: "...",
     storageBucket: "...",
     messagingSenderId: "...",
     appId: "..."
   };
   ```

### Optional: Basic security rules (room-scoped)
In Realtime Database → Rules, you can start with something like:
```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```
For production, lock down writes by path and validate code formats.

---

## 2) Set up GitHub Pages hosting
1. Create a new GitHub repository (public is fine).
2. Upload the contents of this folder (all files).
3. In **Settings → Pages**, set **Branch = main** and **/ (root)** as the folder.
4. Wait for the Pages URL to appear (e.g., `https://<user>.github.io/<repo>/`).

You can update the repo any time; Pages will redeploy automatically.

---

## 3) Local testing
Simply open `index.html` in a browser **after** putting your Firebase config in `config.js`.
Or use any local static server (e.g., VS Code Live Server).

---

## Controls
- **Move:** WASD / Arrow keys
- **Shoot:** Mouse
- **Host/Join:** Enter your name, pick a map, Host or enter a 4-letter code to Join.

---

## Notes / Tips
- The networking is intentionally lightweight: each client updates its own player state and publishes bullets; collisions are handled locally for simplicity. The **host** is responsible for spawning pickups and cleaning old bullets.
- If sync drifts under heavy latency, consider implementing a server-authoritative host using Cloud Functions or a small Node server. This scaffold prioritizes simplicity so it runs purely on GitHub Pages.
- To reset a stuck lobby, delete its data under `lobbies/<CODE>`, `players/<CODE>`, `bullets/<CODE>`, `pickups/<CODE>` in the Realtime Database console.

Have fun!
