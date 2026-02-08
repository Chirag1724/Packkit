import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import AdminDashboard from './AdminDashboard';
import Chatbot from './Chatbot';
import './App.css';

function App() {
  return (
    <Router>
      <Routes>
        {/* Public routes - Chatbot */}
        <Route path="/" element={<Chatbot />} />
        <Route path="/chat" element={<Chatbot />} />

        {/* Admin route - Dashboard */}
        <Route path="/admin" element={<AdminDashboard />} />

        {/* Redirect old dashboard route to admin */}
        <Route path="/dashboard" element={<Navigate to="/admin" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
