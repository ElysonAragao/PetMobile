'use client';

import React, { createContext, useContext, ReactNode, useMemo } from 'react';
import { FirebaseApp } from 'firebase/app';
import { Firestore } from 'firebase/firestore';
import { Auth } from 'firebase/auth';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';

// Combined state for the Firebase context
export interface FirebaseContextState {
  firebaseApp: FirebaseApp;
  firestore: Firestore;
  auth: Auth;
}

// React Context
export const FirebaseContext = createContext<FirebaseContextState | undefined>(undefined);

/**
 * FirebaseProvider manages and provides Firebase services.
 */
export const FirebaseProvider: React.FC<{
  children: ReactNode;
  firebaseApp: FirebaseApp;
  firestore: Firestore;
  auth: Auth;
}> = ({
  children,
  firebaseApp,
  firestore,
  auth,
}) => {
  const firebaseContextValue = useMemo((): FirebaseContextState => ({
      firebaseApp,
      firestore,
      auth,
    }), [firebaseApp, firestore, auth]);

  return (
    <FirebaseContext.Provider value={firebaseContextValue}>
        <FirebaseErrorListener />
        {children}
    </FirebaseContext.Provider>
  );
};

// --- HOOKS ---

function useFirebaseContext() {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error('useFirebase hooks must be used within a FirebaseProvider.');
  }
  return context;
}

// Hooks like useUser are removed as there is no longer a UserContext
export const useAuth = (): Auth => {
  const { auth } = useFirebaseContext();
  return auth;
};

export const useFirestore = (): Firestore => {
  const { firestore } = useFirebaseContext();
  return firestore;
};

export const useFirebaseApp = (): FirebaseApp => {
  const { firebaseApp } = useFirebaseContext();
  return firebaseApp;
};

// --- UTILITY ---
import type { DependencyList } from 'react';

type MemoFirebase <T> = T & {__memo?: boolean};

export function useMemoFirebase<T>(factory: () => T, deps: DependencyList): T | (MemoFirebase<T>) {
  const memoized = useMemo(factory, deps);
  
  if(typeof memoized !== 'object' || memoized === null) return memoized;
  if(!('__memo' in memoized)) {
    try {
      Object.defineProperty(memoized, '__memo', {
        value: true,
        writable: false,
        enumerable: false,
      });
    } catch(e) {
      // In some cases, the object might be frozen, so we can't add the property.
    }
  }
  
  return memoized;
}
