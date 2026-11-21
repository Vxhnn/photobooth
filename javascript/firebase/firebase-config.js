import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBUV3ERWnHbqT_V6ZIiti4nxqQOqlKhTAU",
  authDomain: "photobooth-a4468.firebaseapp.com",
  projectId: "photobooth-a4468",
  storageBucket: "photobooth-a4468.firebasestorage.app",
  messagingSenderId: "280898965684",
  appId: "1:280898965684:web:c170da8cedc606d69087e1"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);