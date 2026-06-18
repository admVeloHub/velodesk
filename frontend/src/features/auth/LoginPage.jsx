/**
 * LoginPage v1.0.0 — autenticação JWT
 * VERSION: v1.0.0 | DATE: 2026-06-18 | AUTHOR: VeloHub Development Team
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function LoginPage() {
  const [email, setEmail] = useState('admin@velodesk.local');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/tickets?desk=v2', { replace: true });
    } catch {
      setError('Credenciais inválidas ou API indisponível');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page" style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-primary, #0f172a)', padding: '2rem',
    }}>
      <div className="login-card" style={{
        maxWidth: 420, width: '100%', background: 'var(--bg-secondary, #1e293b)',
        border: '1px solid var(--border-color, #334155)', borderRadius: 12, padding: '2rem',
      }}>
        <h1 style={{ margin: '0 0 .5rem', color: '#f8fafc', fontSize: '1.5rem' }}>Velodesk</h1>
        <p style={{ margin: '0 0 1.5rem', color: '#94a3b8', fontSize: '.9rem' }}>Helpdesk VeloHub</p>
        {error && (
          <div style={{
            marginBottom: '1rem', padding: '.75rem', borderRadius: 8,
            background: 'rgba(239,68,68,.15)', color: '#fca5a5', fontSize: '.875rem',
          }}>
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <label style={{ display: 'block', marginBottom: '.35rem', color: '#cbd5e1', fontSize: '.8rem' }}>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{
              width: '100%', marginBottom: '1rem', padding: '.65rem .75rem', borderRadius: 8,
              border: '1px solid #475569', background: '#0f172a', color: '#f1f5f9', boxSizing: 'border-box',
            }}
          />
          <label style={{ display: 'block', marginBottom: '.35rem', color: '#cbd5e1', fontSize: '.8rem' }}>Senha</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{
              width: '100%', marginBottom: '1.25rem', padding: '.65rem .75rem', borderRadius: 8,
              border: '1px solid #475569', background: '#0f172a', color: '#f1f5f9', boxSizing: 'border-box',
            }}
          />
          <button type="submit" className="btn-primary" disabled={loading} style={{ width: '100%' }}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
        <p style={{ marginTop: '1rem', color: '#64748b', fontSize: '.75rem' }}>
          Dev: admin@velodesk.local / admin123
        </p>
      </div>
    </div>
  );
}
