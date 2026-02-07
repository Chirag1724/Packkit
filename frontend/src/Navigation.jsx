import { Link, useLocation } from 'react-router-dom';
import './Navigation.css';

const Navigation = () => {
    const location = useLocation();

    return (
        <nav className="navigation">
            <div className="nav-container">
                <div className="nav-brand">
                    <span className="brand-icon">📦</span>
                    <span className="brand-name">PackKit</span>
                </div>
                <div className="nav-links">
                    <Link
                        to="/dashboard"
                        className={`nav-link ${location.pathname === '/dashboard' ? 'active' : ''}`}
                    >
                        <span className="nav-icon">📊</span>
                        Dashboard
                    </Link>
                    <Link
                        to="/chat"
                        className={`nav-link ${location.pathname === '/chat' ? 'active' : ''}`}
                    >
                        <span className="nav-icon">💬</span>
                        AI Chat
                    </Link>
                </div>
            </div>
        </nav>
    );
};

export default Navigation;
