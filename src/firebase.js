import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, set } from 'firebase/database';

// Sergio's official Firebase Project credentials (surtido-almacen)
const firebaseConfig = {
  apiKey: "AIzaSyARENsoTbMgm-K6jm6qqb9BLyYIE4-w4v4",
  authDomain: "surtido-almacen.firebaseapp.com",
  databaseURL: "https://surtido-almacen-default-rtdb.firebaseio.com",
  projectId: "surtido-almacen",
  storageBucket: "surtido-almacen.firebasestorage.app",
  messagingSenderId: "604387811149",
  appId: "1:604387811149:web:d785270930d3064963e104",
  measurementId: "G-49VG79TB1C"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);

// Realtime DB reference for live product sync
export const productsRef = ref(db, 'surtido/products');

// Subscribe to real-time changes across all connected devices
export const subscribeToLiveProducts = (onUpdateCallback) => {
  try {
    return onValue(productsRef, (snapshot) => {
      const data = snapshot.val();
      if (data && Array.isArray(data)) {
        onUpdateCallback(data);
      }
    }, (error) => {
      console.warn("Realtime DB read warning:", error);
    });
  } catch (err) {
    console.warn("Realtime DB error:", err);
    return () => {};
  }
};

// Push updated products list to Firebase Realtime DB
export const pushProductsToCloud = async (products) => {
  try {
    await set(productsRef, products);
    return true;
  } catch (err) {
    console.warn("Realtime DB push warning:", err);
    return false;
  }
};
