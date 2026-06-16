import React, {
  createContext, useContext, useState, useCallback, useEffect,
} from 'react';
import { I18nManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Updates from 'expo-updates';
import translations from '../i18n/translations';

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState('en');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('kj_language').then((saved) => {
      const lang = saved || 'en';
      setLanguageState(lang);
      const shouldBeRTL = lang === 'he';
      if (I18nManager.isRTL !== shouldBeRTL) {
        I18nManager.forceRTL(shouldBeRTL);
        Updates.reloadAsync().catch(() => {});
      }
      setReady(true);
    });
  }, []);

  const setLanguage = useCallback(async (lang) => {
    await AsyncStorage.setItem('kj_language', lang);
    setLanguageState(lang);
    const shouldBeRTL = lang === 'he';
    if (I18nManager.isRTL !== shouldBeRTL) {
      I18nManager.forceRTL(shouldBeRTL);
      await Updates.reloadAsync().catch(() => {});
    }
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
