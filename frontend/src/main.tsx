import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'react-hot-toast'
import './index.css'
import App from './App.tsx'

// Component to manage the theme
function ThemeManager() {
  useEffect(() => {
    // Automatic detection of the system theme
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    type ThemeMode = 'system' | 'dark' | 'light';

    const applyTheme = (mode: ThemeMode, source: MediaQueryList | MediaQueryListEvent) => {
      const prefersDark = source.matches;
      const root = document.documentElement;
      const shouldDark = mode === 'dark' || (mode === 'system' && prefersDark);
      if (shouldDark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    };

    const stored = (localStorage.getItem('theme') as ThemeMode | null) || 'system';
    applyTheme(stored, mediaQuery);

    // Listen for changes in the system theme only when mode === 'system'
    // Use addEventListener if available, otherwise fallback to addListener for older browsers
    if (mediaQuery.addEventListener) {
      const handler = (e: MediaQueryListEvent) => {
        const current = (localStorage.getItem('theme') as ThemeMode | null) || 'system';
        if (current === 'system') {
          applyTheme('system', e);
        }
      };
      mediaQuery.addEventListener('change', handler);
      return () => {
        mediaQuery.removeEventListener('change', handler);
      };
    } else {
      // Fallback for older browsers
      const listener = (e: MediaQueryListEvent) => {
        const current = (localStorage.getItem('theme') as ThemeMode | null) || 'system';
        if (current === 'system') {
          applyTheme('system', e);
        }
      };
      mediaQuery.addListener(listener);
      return () => {
        mediaQuery.removeListener(listener);
      };
    }
  }, []);

  return null;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeManager />
    <App />
    <Toaster 
      position="top-right"
      toastOptions={{
        duration: 4000,
        style: {
          background: '#363636',
          color: '#fff',
        },
        success: {
          duration: 3000,
          iconTheme: {
            primary: '#10b981',
            secondary: '#fff',
          },
        },
        error: {
          duration: 4000,
          iconTheme: {
            primary: '#ef4444',
            secondary: '#fff',
          },
        },
      }}
    />
  </StrictMode>,
)
