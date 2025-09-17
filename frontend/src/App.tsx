import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import PrivyProvider from './providers/PrivyProvider';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Loader2 } from 'lucide-react';

// Lazy load pages for better performance
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));

// Loading component for Suspense fallback
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center">
    <Loader2 className="h-12 w-12 animate-spin text-primary" />
  </div>
);

function App() {
  return (
    <ErrorBoundary>
      <PrivyProvider>
        <Router>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Login />} />
              <Route path="/dashboard" element={<Dashboard />} />
            </Routes>
          </Suspense>
        </Router>
      </PrivyProvider>
    </ErrorBoundary>
  );
}

export default App