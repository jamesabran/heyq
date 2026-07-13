import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider, createBrowserRouter } from 'react-router';
import './index.css';
import { ThemeProvider } from './app/contexts/ThemeContext';
import { IdentityProvider } from './app/contexts/IdentityContext';
import { routes } from './app/routes';

const router = createBrowserRouter(routes);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <IdentityProvider>
        <RouterProvider router={router} />
      </IdentityProvider>
    </ThemeProvider>
  </StrictMode>,
);
