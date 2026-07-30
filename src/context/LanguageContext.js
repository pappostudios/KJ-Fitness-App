import React, {
  createContext, useContext, useState, useCallback, useEffect,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import translations from '../i18n/translations';

// Note: this app does NOT use I18nManager.forceRTL() + a full app reload to
// switch RTL layout direction. Every screen already manually mirrors layout
// via the `isRTL` flag (icon direction, textAlign, flexDirection, etc.).
// A forced native reload was previously wired here, but restarting the JS
// layer while native modules (Firebase Auth, Google Sign-In) don't fully
// reset caused intermittent logout / sign-in flakiness right after a
// language switch — so language changes are now purely in-memory.

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState('en');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('kj_language').then((saved) => {
      setLanguageState(saved || 'en');
      setReady(true);
    });
  }, []);

  const setLanguage = useCallback(async (lang) => {
    await AsyncStorage.setItem('kj_language', lang);
    setLanguageState(lang);
  }, []);

  const t = useCallback((key, params = {}) => {
    const dict = translations[language] || translations.en;
    let str = dict[key] ?? translations.en[key] ?? key;
    Object.entries(params).forEach(([k, v]) => {
      str = str.replace(`{${k}}`, String(v));
    });
    return str;
  }, [language]);

  const isRTL = language === 'he';

  if (!ready) return null;

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, isRTL }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}
