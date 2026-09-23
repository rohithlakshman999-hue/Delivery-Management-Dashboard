import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const { login, isLoading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('manager@routemind.ai');
  const [password, setPassword] = useState('manager123');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await login(email.trim(), password);
      const role = JSON.parse(localStorage.getItem('user') || '{}').role;
      navigate(role === 'agent' ? '/agent-dashboard' : '/dashboard', { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.detail || (err.code === 'ERR_NETWORK'
        ? 'Cannot reach the backend. Start FastAPI on http://localhost:8000.'
        : 'Login failed. Please check your credentials.'));
    }
  };

  const quickLogin = (role: string) => {
    const creds: Record<string, [string, string]> = {
      manager: ['manager@routemind.ai', 'manager123'],
      agent:   ['ravi@routemind.ai',    'agent123'],
      admin:   ['admin@routemind.ai',   'admin123'],
    };
    const [e, p] = creds[role];
    setEmail(e); setPassword(p);
  };

  return (
    <div className="login-page">
      <div className="login-bg" />
      <div className="login-card card-glass fade-in">
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 60, height: 60, borderRadius: 16,
            background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-violet))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, margin: '0 auto 16px',
            boxShadow: '0 0 40px rgba(59,130,246,0.4)'
          }}>🚚</div>
          <h1 style={{ fontSize: 26, fontWeight: 900, marginBottom: 4 }}>
            <span className="gradient-text">RouteMind AI</span>
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
            Intelligent Delivery Operations Platform
          </p>
        </div>

        {/* Quick login */}
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, textAlign: 'center',
            textTransform: 'uppercase', letterSpacing: 1 }}>Quick Demo Login</p>
          <div style={{ display: 'flex', gap: 8 }}>
            {['manager', 'agent', 'admin'].map(role => (
              <button key={role} onClick={() => quickLogin(role)}
                className="btn btn-secondary" style={{ flex: 1, fontSize: 12, padding: '6px 8px' }}>
                {role === 'manager' ? '👔' : role === 'agent' ? '🛵' : '⚙️'} {role}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              id="login-email"
              className="input"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              id="login-password"
              className="input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
            />
          </div>

          {error && <div className="alert alert-danger" style={{ marginBottom: 12 }}>{error}</div>}

          <button id="login-submit" type="submit" className="btn btn-primary btn-lg"
            style={{ width: '100%', justifyContent: 'center' }}
            disabled={isLoading}>
            {isLoading ? <><span className="spinner" style={{ width: 16, height: 16 }} /> Signing in...</> : '🚀 Sign In'}
          </button>
        </form>

        <div style={{ marginTop: 24, padding: 16, background: 'rgba(255,255,255,0.03)',
          borderRadius: 10, border: '1px solid var(--border)' }}>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600 }}>DEMO CREDENTIALS</p>
          <div style={{ display: 'grid', gap: 4, fontSize: 12, color: 'var(--text-muted)' }}>
            <span>Manager: manager@routemind.ai / manager123</span>
            <span>Agent: ravi@routemind.ai / agent123</span>
          </div>
        </div>
      </div>
    </div>
  );
}
