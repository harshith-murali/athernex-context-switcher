'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface AppSettings {
  port: string;
  sessionWindow: string;
  maxTokens: string;
  noiseDomains: string;
  maxFileLines: string;
  maxGitDiffLines: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  port: '37218',
  sessionWindow: '5',
  maxTokens: '1400',
  noiseDomains: 'youtube.com, netflix.com, twitter.com, reddit.com, instagram.com, twitch.tv, spotify.com, tiktok.com',
  maxFileLines: '200',
  maxGitDiffLines: '100',
};

interface SettingsContextType {
  settings: AppSettings;
  updateSettings: (partial: Partial<AppSettings>) => void;
  saveSettings: () => void;
  hasUnsavedChanges: boolean;
}

const SettingsContext = createContext<SettingsContextType>({
  settings: DEFAULT_SETTINGS,
  updateSettings: () => {},
  saveSettings: () => {},
  hasUnsavedChanges: false,
});

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [savedSettings, setSavedSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('app-settings');
    if (stored) {
      try {
        const parsed = { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
        setSettings(parsed);
        setSavedSettings(parsed);
      } catch {
        // Ignore invalid JSON
      }
    }
    setMounted(true);
  }, []);

  const updateSettings = (partial: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  };

  const saveSettings = () => {
    localStorage.setItem('app-settings', JSON.stringify(settings));
    setSavedSettings(settings);
  };

  const hasUnsavedChanges = mounted && JSON.stringify(settings) !== JSON.stringify(savedSettings);

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, saveSettings, hasUnsavedChanges }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  return useContext(SettingsContext);
}
