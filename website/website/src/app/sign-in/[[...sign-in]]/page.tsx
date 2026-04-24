'use client';

import { SignIn } from '@clerk/nextjs';
import { useTheme } from '@/components/ThemeProvider';

export default function SignInPage() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="auth-page">
      <button
        className="auth-theme-toggle"
        onClick={toggleTheme}
        aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      >
        {theme === 'dark' ? (
          <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.3" />
            <line x1="8" y1="1" x2="8" y2="3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            <line x1="8" y1="13" x2="8" y2="15" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            <line x1="1" y1="8" x2="3" y2="8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            <line x1="13" y1="8" x2="15" y2="8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            <line x1="3.05" y1="3.05" x2="4.46" y2="4.46" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            <line x1="11.54" y1="11.54" x2="12.95" y2="12.95" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            <line x1="3.05" y1="12.95" x2="4.46" y2="11.54" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            <line x1="11.54" y1="4.46" x2="12.95" y2="3.05" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
            <path
              d="M14 9.5A6.5 6.5 0 0 1 6.5 2c0-.5.06-1 .17-1.47A7 7 0 1 0 14.47 8.83c-.47.11-.97.17-1.47.17h1Z"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>

      <div className="auth-container">
        <div className="auth-brand">
          <div className="auth-logo">
            <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="3" fill="white" />
              <circle cx="8" cy="8" r="6.5" stroke="white" strokeWidth="1" strokeDasharray="2 2" />
            </svg>
          </div>
          <h1 className="auth-title">ContextMind</h1>
          <p className="auth-subtitle">AI Context Preservation System</p>
        </div>
        <SignIn
          appearance={{
            elements: {
              rootBox: 'clerk-root',
              card: 'clerk-card',
              headerTitle: 'clerk-header-title',
              headerSubtitle: 'clerk-header-subtitle',
              formButtonPrimary: 'clerk-btn-primary',
              footerActionLink: 'clerk-footer-link',
              formFieldInput: 'clerk-input',
              identityPreviewEditButton: 'clerk-edit-btn',
              formFieldLabel: 'clerk-label',
              dividerLine: 'clerk-divider',
              dividerText: 'clerk-divider-text',
              socialButtonsBlockButton: 'clerk-social-btn',
            },
          }}
        />
      </div>
    </div>
  );
}
