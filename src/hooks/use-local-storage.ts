"use client";

import { useState, useEffect, useCallback, useRef } from 'react';

function useLocalStorage<T>(key: string, initialValue: T) {
  const valueRef = useRef<T>(initialValue);

  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') return initialValue;
    try {
      const item = window.localStorage.getItem(key);
      const parsed = item ? JSON.parse(item) : initialValue;
      valueRef.current = parsed;
      return parsed;
    } catch (error) {
      return initialValue;
    }
  });

  const [isLoaded, setIsLoaded] = useState(typeof window !== 'undefined');

  useEffect(() => {
    setIsLoaded(true);

    const handleStorageChange = (e: StorageEvent) => {
      // Se e.key for null, significa que localStorage.clear() foi chamado!
      if ((e.key === key || e.key === null) && typeof window !== 'undefined') {
        try {
          const rawValue = window.localStorage.getItem(key);
          const newValue = rawValue !== null ? JSON.parse(rawValue) : initialValue;
          
          if (JSON.stringify(newValue) !== JSON.stringify(valueRef.current)) {
            valueRef.current = newValue;
            setValue(newValue);
          }
        } catch {
          if (valueRef.current !== initialValue) {
            valueRef.current = initialValue;
            setValue(initialValue);
          }
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    // Adicionamos um intervalo de segurança para mobile (pollyfill de sincronização)
    const interval = setInterval(() => {
        if (typeof window !== 'undefined') {
            const raw = window.localStorage.getItem(key);
            try {
                const current = raw ? JSON.parse(raw) : initialValue;
                if (JSON.stringify(current) !== JSON.stringify(valueRef.current)) {
                    valueRef.current = current;
                    setValue(current);
                }
            } catch(e) {}
        }
    }, 2000);

    return () => {
        window.removeEventListener('storage', handleStorageChange);
        clearInterval(interval);
    };
  }, [key, initialValue]);

  const setStoredValue = useCallback((newValue: T | ((val: T) => T)) => {
    try {
      if (typeof window !== 'undefined') {
        setValue((prevValue) => {
          const valueToStore = newValue instanceof Function ? newValue(prevValue) : newValue;
          if (JSON.stringify(valueToStore) !== JSON.stringify(prevValue)) {
            if (valueToStore === null) {
                window.localStorage.removeItem(key);
            } else {
                window.localStorage.setItem(key, JSON.stringify(valueToStore));
            }
            valueRef.current = valueToStore;
            return valueToStore;
          }
          return prevValue;
        });
      }
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error);
    }
  }, [key]);

  return [value, setStoredValue, isLoaded] as const;
}

export default useLocalStorage;
