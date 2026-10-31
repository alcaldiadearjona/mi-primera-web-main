import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

export const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwHLeh7DnSXN34kDHEEVtxAGKH5Iyye4Zt9No_SS7VJWpVtkwOsp7YrcaAfL2fDdjd1yw/exec";

const firebaseConfig = {
  apiKey: "AIzaSyBsUtju2qT5PI_6SEkr6qg14fUEgs4xocg",
  authDomain: "pqrsalcaldiaarjona.firebaseapp.com",
  projectId: "pqrsalcaldiaarjona",
  storageBucket: "pqrsalcaldiaarjona.firebasestorage.app",
  messagingSenderId: "586549565310",
  appId: "1:586549565310:web:4667979305cc27165d052f",
  measurementId: "G-4CH1DZ0Z9H"
};

export const RADICADOS_COLLECTION = 'radicados';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);