import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, initializeFirestore, doc, getDocFromServer, Firestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize App only if not already initialized
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

// Initialize Firestore only if not already initialized
let firestoreInstance: Firestore;
try {
  // Try to initialize with specific settings to bypass connection issues (especially on restrictive networks/GitHub Pages)
  firestoreInstance = initializeFirestore(app, {
    experimentalForceLongPolling: true,
    experimentalAutoDetectLongPolling: false, // Force it, don't just detect
  }, firebaseConfig.firestoreDatabaseId);
} catch (e: any) {
  // If already initialized (e.g. during HMR or multiple imports), just get the existing instance
  firestoreInstance = getFirestore(app, firebaseConfig.firestoreDatabaseId);
}

export const db = firestoreInstance;
export const googleProvider = new GoogleAuthProvider();

// Add a global error listener for catching unhandled firestore errors
if (typeof window !== 'undefined') {
  (window as any)._firestoreDebug = {
    db,
    config: firebaseConfig,
    lastError: null
  };
}

// Test connection silently - don't let it throw if offline
async function testConnection() {
  try {
    if (firebaseConfig.firestoreDatabaseId) {
      // Use getDocFromServer to verify connectivity
      await getDocFromServer(doc(db, 'test', 'connection')).catch(err => {
        if (err.code === 'unavailable') {
          console.warn("[Firestore] Connectivity warning: Backend unavailable. Operating in offline mode.");
        }
      });
    }
  } catch (error: any) {
    // Ignore early failures during initial mount
  }
}
testConnection();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[Firestore Error] Op: ${operationType}, Path: ${path}, Err:`, error);
  
  const errInfo: FirestoreErrorInfo = {
    error: message,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  
  if (message.includes('resource-exhausted') || message.includes('Quota limit exceeded')) {
    const event = new CustomEvent('firestore-quota-exceeded', { detail: message });
    if (typeof window !== 'undefined') window.dispatchEvent(event);
  }
  // Not throwing error to avoid infinite loops in React error boundaries/listeners
  // HOWEVER, the platform requires it for diagnostics. 
  // We use a small delay or check to ensure we don't loop during state updates if necessary.
  throw new Error(JSON.stringify(errInfo));
}
