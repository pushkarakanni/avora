// Firebase Compat SDK — initialised once, shared by all pages
// Loaded AFTER the three firebase-*-compat.js CDN scripts

const firebaseConfig = {
    apiKey:            "AIzaSyA4HAHD267qvd7ey_Gr8CEczKnllmTssyY",
    authDomain:        "avora-2154c.firebaseapp.com",
    projectId:         "avora-2154c",
    storageBucket:     "avora-2154c.firebasestorage.app",
    messagingSenderId: "591751164583",
    appId:             "1:591751164583:web:59a9dc6ca8ebe56de1a182",
    measurementId:     "G-EEBVLJS070"
};

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// Globals used by crazyheads.js, avora.js, and admin.js
const db   = firebase.firestore();
const auth = firebase.auth();

// ─────────────────────────────────────────────────────────────
// IMPORTANT — Firestore Security Rules
// In Firebase Console → Firestore → Rules, set:
//
// rules_version = '2';
// service cloud.firestore {
//   match /databases/{database}/documents {
//     match /avora_enquiries/{doc} {
//       allow create: if true;
//       allow read, update, delete: if request.auth != null;
//     }
//     match /ch_tickets/{doc} {
//       allow create: if true;
//       allow read, update, delete: if request.auth != null;
//     }
//     match /ch_partners/{doc} {
//       allow create: if true;
//       allow read, update, delete: if request.auth != null;
//     }
//     match /ch_ambassadors/{doc} {
//       allow create: if true;
//       allow read, update, delete: if request.auth != null;
//     }
//   }
// }
// ─────────────────────────────────────────────────────────────
