import { Navigate, Route, Routes } from 'react-router-dom';
import Crypto from './pages/Crypto';
import CryptoDetail from './pages/CryptoDetail';
import Plan from './pages/Plan';

export default function App() {
  return (
    <div className="min-h-screen bg-dark-bg text-text">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <Routes>
          <Route path="/" element={<Crypto />} />
          <Route path="/coins/:id" element={<CryptoDetail />} />
          <Route path="/plan" element={<Plan />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  );
}
