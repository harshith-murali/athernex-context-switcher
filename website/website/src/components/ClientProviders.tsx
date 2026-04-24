'use client';

import { ClerkProvider } from '@clerk/nextjs';
import { dark } from '@clerk/themes';
import { ThemeProvider, useTheme } from '@/components/ThemeProvider';
import { SettingsProvider } from '@/components/SettingsProvider';

function ClerkThemeWrapper({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();

  const clerkVars = theme === 'dark'
    ? {
        colorPrimary: '#c4b5fd',
        colorBackground: '#121217',
        colorText: '#f8fafc',
        colorTextSecondary: '#a1a1aa',
        colorInputBackground: '#1a1a24',
        colorInputText: '#f8fafc',
        borderRadius: '12px',
        fontFamily: "'Inter', sans-serif",
      }
    : {
        colorPrimary: '#8b5cf6',
        colorBackground: '#ffffff',
        colorText: '#111827',
        colorTextSecondary: '#4b5563',
        colorInputBackground: '#f9fafb',
        colorInputText: '#111827',
        borderRadius: '12px',
        fontFamily: "'Inter', sans-serif",
      };

  return (
    <ClerkProvider
      afterSignOutUrl="/sign-in"
      appearance={{
        baseTheme: theme === 'dark' ? dark : undefined,
        variables: clerkVars,
      }}
    >
      {children}
    </ClerkProvider>
  );
}

export default function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <SettingsProvider>
        <ClerkThemeWrapper>
          {children}
        </ClerkThemeWrapper>
      </SettingsProvider>
    </ThemeProvider>
  );
}
