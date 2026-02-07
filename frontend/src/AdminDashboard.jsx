import { useState, useEffect } from 'react';
import './AdminDashboard.css';

const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [vectorStats, setVectorStats] = useState(null);
  const [securityStats, setSecurityStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchAllStats();
    // Refresh stats every 30 seconds
    const interval = setInterval(fetchAllStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchAllStats = async () => {
    try {
      setLoading(true);
      const [statsRes, vectorRes, securityRes] = await Promise.all([
        fetch('http://localhost:4873/api/stats'),
        fetch('http://localhost:4873/api/vector-stats'),
        fetch('http://localhost:4873/api/security-stats')
      ]);

      if (!statsRes.ok || !vectorRes.ok || !securityRes.ok) {
        throw new Error('One or more API requests failed');
      }

      const [statsData, vectorData, securityData] = await Promise.all([
        statsRes.json(),
        vectorRes.json(),
        securityRes.json()
      ]);

      setStats(statsData);
      setVectorStats(vectorData);
      setSecurityStats(securityData);
      setError(null);
    } catch (err) {
      setError('Failed to fetch stats: ' + err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ title, value, subtitle, icon, trend }) => (
    <div className="stat-card fade-in">
      <div className="stat-icon">{icon}</div>
      <div className="stat-content">
        <h3 className="stat-title">{title}</h3>
        <div className="stat-value">{value}</div>
        {subtitle && <p className="stat-subtitle">{subtitle}</p>}
        {trend && (
          <div className={`stat-trend ${trend > 0 ? 'positive' : 'negative'}`}>
            {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}%
          </div>
        )}
      </div>
    </div>
  );

  if (loading && !stats) {
    return (
      <div className="admin-dashboard">
        <div className="dashboard-header">
          <h1>Admin Dashboard</h1>
          <div className="loading-spinner"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-dashboard">
        <div className="dashboard-header">
          <h1>Admin Dashboard</h1>
        </div>
        <div className="error-message">
          <span className="error-icon">⚠️</span>
          {error}
          <button className="btn btn-primary" onClick={fetchAllStats}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      <div className="dashboard-header">
        <div>
          <h1>Admin Dashboard</h1>
          <p className="dashboard-subtitle">System Performance & Analytics</p>
        </div>
        <button className="btn btn-secondary refresh-btn" onClick={fetchAllStats}>
          🔄 Refresh
        </button>
      </div>

      {/* RAG Statistics */}
      <section className="dashboard-section">
        <h2 className="section-title">📊 RAG Statistics</h2>
        <div className="stats-grid">
          <StatCard
            title="Total Chunks"
            value={stats?.totalChunks || 0}
            icon="📄"
            subtitle="Text segments stored"
          />
          <StatCard
            title="Embeddings Cached"
            value={stats?.embeddingsCached || 0}
            icon="🧠"
            subtitle="Vector representations"
          />
          <StatCard
            title="Cached Responses"
            value={stats?.cachedResponses || 0}
            icon="⚡"
            subtitle="Quick retrieval"
          />
          <StatCard
            title="Unique Packages"
            value={stats?.packages || 0}
            icon="📦"
            subtitle="Documented packages"
          />
        </div>
      </section>

      {/* Vector Optimization */}
      {vectorStats && (
        <section className="dashboard-section">
          <h2 className="section-title">🎯 Vector Optimization</h2>
          <div className="stats-grid">
            <StatCard
              title="Vector Status"
              value={vectorStats.vectorOptimizationEnabled ? "Active" : "Inactive"}
              icon="🔍"
              subtitle={vectorStats.vectorOptimizationEnabled ? "Optimized" : "Not optimized"}
            />
            <StatCard
              title="Embedding Coverage"
              value={`${vectorStats.embeddingCoverage || 0}%`}
              icon="📈"
              subtitle="Chunks with vectors"
            />
            <StatCard
              title="Chunks with Embeddings"
              value={vectorStats.chunksWithEmbeddings || 0}
              icon="🎯"
              subtitle="Vector-enabled chunks"
            />
            <StatCard
              title="Responses Cached"
              value={vectorStats.responsesCached || 0}
              icon="💾"
              subtitle="Stored responses"
            />
          </div>
        </section>
      )}

      {/* Security Statistics */}
      {securityStats && (
        <section className="dashboard-section">
          <h2 className="section-title">🔒 Security Status</h2>
          <div className="stats-grid">
            <StatCard
              title="Total Verifications"
              value={securityStats.totalVerifications || 0}
              icon="🔐"
              subtitle="Security checks"
            />
            <StatCard
              title="Successful"
              value={securityStats.successfulVerifications || 0}
              icon="✅"
              subtitle="Verified packages"
            />
            <StatCard
              title="Threats Detected"
              value={securityStats.threatsDetected || 0}
              icon="⚠️"
              subtitle="Security issues"
            />
            <StatCard
              title="Success Rate"
              value={`${securityStats.successRate || 0}%`}
              icon="🛡️"
              subtitle="Security score"
            />
          </div>

          {securityStats.recentEvents && securityStats.recentEvents.length > 0 && (
            <div className="card verification-list">
              <h3>📋 Recent Security Events</h3>
              <div className="verification-items">
                {securityStats.recentEvents.slice(0, 5).map((event, idx) => (
                  <div key={idx} className="verification-item">
                    <div className="verification-info">
                      <span className="verification-name">{event.packageName}</span>
                      <span className="verification-version">v{event.version}</span>
                    </div>
                    <div className="verification-meta">
                      <span className={`verification-algo ${event.eventType === 'success' ? 'success' : event.eventType === 'threat_detected' ? 'threat' : 'failure'}`}>
                        {event.eventType === 'success' ? '✅' : event.eventType === 'threat_detected' ? '🚨' : '❌'} {event.eventType}
                      </span>
                      <span className="verification-date">
                        {new Date(event.timestamp).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* System Health */}
      <section className="dashboard-section">
        <h2 className="section-title">💚 System Health</h2>
        <div className="health-grid">
          <div className="health-card">
            <div className="health-status success">
              <span className="health-dot"></span>
              Database Connected
            </div>
          </div>
          <div className="health-card">
            <div className="health-status success">
              <span className="health-dot"></span>
              API Server Running
            </div>
          </div>
          <div className="health-card">
            <div className="health-status success">
              <span className="health-dot"></span>
              Vector Search Active
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AdminDashboard;
