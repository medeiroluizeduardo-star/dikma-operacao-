// Entrada usada para montar public/vendor/firebase.js (só as partes do Firebase que o site usa).
// Para gerar de novo: node ferramentas/firebase/gerar.mjs (ver o comentário lá).
export { initializeApp } from 'firebase/app';
export {
  getAuth, initializeAuth, inMemoryPersistence, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult,
  onAuthStateChanged, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword, updatePassword,
  reauthenticateWithCredential, EmailAuthProvider
} from 'firebase/auth';
export {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  doc, getDoc, setDoc, updateDoc, addDoc, onSnapshot, collection, query, where, orderBy, limit, getDocs,
  writeBatch, serverTimestamp, FieldPath, deleteField, arrayUnion, increment
} from 'firebase/firestore';
export { getMessaging, getToken, deleteToken, isSupported as mensagensSuportadas } from 'firebase/messaging';
