import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './AdminDashboard.css';

const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [vectorStats, setVectorStats] = useState(null);
  const [securityStats, setSecurityStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    fetchAllStats();
    const interval = setInterval(fetchAllStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchAllStats = async () => {
    try {
      setLoading(true);
      const apiHost = window.location.hostname;
      const [statsRes, vectorRes, securityRes] = await Promise.all([
        fetch(`http://${apiHost}:4873/api/stats`),
        fetch(`http://${apiHost}:4873/api/vector-stats`),
        fetch(`http://${apiHost}:4873/api/security-stats`)
      ]);

      if (!statsRes.ok || !vectorRes.ok || !securityRes.ok) {
        throw new Error('Failed to fetch stats');
      }

      const [statsData, vectorData, securityData] = await Promise.all([
        statsRes.json(),
        vectorRes.json(),
        securityRes.json()
      ]);

      setStats(statsData);
      setVectorStats(vectorData);
      setSecurityStats(securityData);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ label, value, description }) => (
    <div className="stat-card">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      {description && <div className="stat-description">{description}</div>}
    </div>
  );

  const StatusBadge = ({ status, label }) => (
    <span className={`status-badge ${status}`}>{label}</span>
  );

  if (loading && !stats) {
    return (
      <div className="admin-container">
        <div className="admin-loading">
          <div className="loading-spinner"></div>
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-container">
        <div className="admin-error">
          <h2>Unable to load dashboard</h2>
          <p>{error}</p>
          <button className="btn btn-primary" onClick={fetchAllStats}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-container">
      {/* Header */}
      <header className="admin-header">
        <div className="header-left">
          <Link to="/" className="back-link">
            ← Back to Chat
          </Link>
          <h1>Admin Dashboard</h1>
        </div>
        <div className="header-right">
          {lastUpdated && (
            <span className="last-updated">
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button className="btn btn-secondary" onClick={fetchAllStats}>
            Refresh
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="admin-main">
        {/* RAG Stats Section */}
        <section className="dashboard-section">
          <h2>RAG System</h2>
          <div className="stats-grid">
            <StatCard
              label="Total Chunks"
              value={stats?.totalChunks || 0}
              description="Text segments indexed"
            />
            <StatCard
              label="Embeddings"
              value={stats?.embeddingsCached || 0}
              description="Cached vectors"
            />
            <StatCard
              label="Cached Responses"
              value={stats?.cachedResponses || 0}
              description="Quick lookups"
            />
            <StatCard
              label="Packages"
              value={stats?.packages || 0}
              description="Documented"
            />
          </div>
        </section>

        {/* Vector Stats Section */}
        {vectorStats && (
          <section className="dashboard-section">
            <h2>Vector Search</h2>
            <div className="stats-grid">
              <StatCard
                label="Status"
                value={vectorStats.vectorOptimizationEnabled ? 'Active' : 'Inactive'}
                description="Search engine"
              />
              <StatCard
                label="Coverage"
                value={`${vectorStats.embeddingCoverage || 0}%`}
                description="Chunks with vectors"
              />
              <StatCard
                label="Vector Chunks"
                value={vectorStats.chunksWithEmbeddings || 0}
                description="Searchable"
              />
              <StatCard
                label="Response Cache"
                value={vectorStats.responsesCached || 0}
                description="Stored answers"
              />
            </div>
          </section>
        )}

        {/* Security Stats Section */}
        {securityStats && (
          <section className="dashboard-section">
            <h2>Security</h2>
            <div className="stats-grid">
              <StatCard
                label="Verifications"
                value={securityStats.totalVerifications || 0}
                description="Total checks"
              />
              <StatCard
                label="Successful"
                value={securityStats.successfulVerifications || 0}
                description="Passed checks"
              />
              <StatCard
                label="Threats"
                value={securityStats.threatsDetected || 0}
                description="Issues found"
              />
              <StatCard
                label="Success Rate"
                value={`${securityStats.successRate || 0}%`}
                description="Security score"
              />
            </div>

            {securityStats.recentEvents?.length > 0 && (
              <div className="events-table">
                <h3>Recent Events</h3>
                <table>
                  <thead>
                    <tr>
                      <th>Package</th>
                      <th>Version</th>
                      <th>Status</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {securityStats.recentEvents.slice(0, 5).map((event, idx) => (
                      <tr key={idx}>
                        <td>{event.packageName}</td>
                        <td>{event.version || '-'}</td>
                        <td>
                          <StatusBadge
                            status={event.eventType === 'success' ? 'success' : event.eventType === 'threat_detected' ? 'error' : 'warning'}
                            label={event.eventType}
                          />
                        </td>
                        <td>{new Date(event.timestamp).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* System Health */}
        <section className="dashboard-section">
          <h2>System Health</h2>
          <div className="health-indicators">
            <div className="health-item">
              <span className="health-dot success"></span>
              <span>Database Connected</span>
            </div>
            <div className="health-item">
              <span className="health-dot success"></span>
              <span>API Server Running</span>
            </div>
            <div className="health-item">
              <span className={`health-dot ${vectorStats?.vectorOptimizationEnabled ? 'success' : 'warning'}`}></span>
              <span>Vector Search</span>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default AdminDashboard;
