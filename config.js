const firebaseConfig = {
  apiKey: "AIzaSyCKQr3W1IzwRreeBtz5zkgaDbX2DoSpoaw",
  authDomain: "topdownshoota.firebaseapp.com",
  projectId: "topdownshoota",
  storageBucket: "topdownshoota.firebasestorage.app",
  messagingSenderId: "630587906951",
  appId: "1:630587906951:web:c4de21e271cb26ce009122",
  measurementId: "G-NXSLTK6NYN"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);