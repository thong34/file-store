// firebase-config.js
const firebaseConfig = {
  apiKey: "AIzaSyCVvIA-rpL7GZalBaK_LUAHayjTJD4RYYw",
  authDomain: "file-storage-b265e.firebaseapp.com",
  projectId: "file-storage-b265e",
  storageBucket: "file-storage-b265e.appspot.com",
  messagingSenderId: "647098522409",
  appId: "1:647098522409:web:40249f09737a883b6f3538",
  measurementId: "G-VVKGWS0T2V"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const storage = firebase.storage();
const auth = firebase.auth();
