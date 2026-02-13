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

    const updateTheme = (e: MediaQueryList | MediaQueryListEvent) => {
      if (e.matches) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };

      // Set the initial theme
    updateTheme(mediaQuery);

    // Listen for changes in the system theme
    // Use addEventListener if available, otherwise fallback to addListener for older browsers
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', updateTheme);
      return () => {
        mediaQuery.removeEventListener('change', updateTheme);
      };
    } else {
      // Fallback for older browsers
      const listener = (e: MediaQueryListEvent) => updateTheme(e);
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
