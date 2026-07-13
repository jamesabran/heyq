import { createBrowserRouter } from 'react-router';
import { RootLayout } from './layouts/RootLayout';
import { Overview } from './pages/Overview';
import { Validation } from './pages/Validation';

// Milestone 1 route tree: the shell plus an overview placeholder and the design
// system validation page. The full helpdesk route tree lands in Milestone 2+.
export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <Overview /> },
      { path: 'validation', element: <Validation /> },
    ],
  },
]);
