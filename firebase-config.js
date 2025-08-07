import { initializeApp } from "https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js";
import {
  getFirestore, collection, addDoc, onSnapshot, updateDoc, doc, deleteDoc, getDoc
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js";
import {
  getAuth, signInAnonymously, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js";

// Configuración de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBPYYzhRWAzxsT5bgI2d-K6QPfd7957ZUA",
  authDomain: "taskgarden-8b037.firebaseapp.com",
  projectId: "taskgarden-8b037",
  storageBucket: "taskgarden-8b037.appspot.com",
  messagingSenderId: "714357084611",
  appId: "1:714357084611:web:211188c9056a3bcd4f6d76"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export {
  db,
  auth,
  collection,
  addDoc,
  onSnapshot,
  updateDoc,
  doc,
  deleteDoc,
  getDoc,
  signInAnonymously,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
};
