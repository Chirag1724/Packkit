import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Navigation from './Navigation';
import AdminDashboard from './AdminDashboard';
import Chatbot from './Chatbot';
import './App.css';

function App() {
  return (
    <Router>
      <div className="app">
        <Navigation />
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<AdminDashboard />} />
          <Route path="/chat" element={<Chatbot />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
