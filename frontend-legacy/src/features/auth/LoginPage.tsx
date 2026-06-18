/** LoginPage v1.1.0 */
import { useState } from 'react';
import { Box, Button, Paper, TextField, Typography, Alert } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export default function LoginPage() {
  const [email, setEmail] = useState('admin@velodesk.local');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/workspace');
    } catch {
      setError('Credenciais inválidas ou API indisponível');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default', p: 2 }}>
      <Paper className="container-main" sx={{ p: 4, maxWidth: 420, width: '100%' }}>
        <Typography variant="h4" sx={{ fontWeight: 700, color: 'primary.dark' }} gutterBottom>
          Velodesk
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Helpdesk VeloHub
        </Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Box component="form" onSubmit={handleSubmit}>
          <TextField fullWidth label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} margin="normal" required />
          <TextField fullWidth label="Senha" type="password" value={password} onChange={(e) => setPassword(e.target.value)} margin="normal" required />
          <Button fullWidth type="submit" variant="contained" color="primary" size="large" sx={{ mt: 2 }} disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </Button>
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
          Dev: admin@velodesk.local / admin123
        </Typography>
      </Paper>
    </Box>
  );
}
