import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, set, update } from 'firebase/database';

const firebaseConfig = {
  databaseURL: "https://catalogos-accesorios-default-rtdb.firebaseio.com",
  projectId: "catalogos-accesorios"
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
