import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import PrivyProvider from './providers/PrivyProvider';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';

function App() {
  return (
    <PrivyProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </Router>
    </PrivyProvider>
  );
}

export default App