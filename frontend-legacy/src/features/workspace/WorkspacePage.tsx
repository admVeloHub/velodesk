/** Workspace 360° v1.1.0 */
import { Box, Paper, Typography, Chip, Stack, Button } from '@mui/material';
import { useProfile } from '../../contexts/ProfileContext';
import { PROFILES } from '../../types';

export default function WorkspacePage() {
  const { profile } = useProfile();
  const cfg = PROFILES[profile];
  const chipTextColor = profile === 'management' ? '#000058' : '#F3F7FC';

  return (
    <Box>
      <Typography variant="h5" gutterBottom>Painel 360°</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>{cfg.desc}</Typography>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 2 }}>
        <Paper className="velohub-card" sx={{ p: 2, flex: 1, cursor: 'default' }}>
          <Typography variant="subtitle2" color="text.secondary">Perfil ativo</Typography>
          <Chip label={cfg.label} sx={{ mt: 1, bgcolor: cfg.color, color: chipTextColor }} />
        </Paper>
        <Paper className="velohub-card" sx={{ p: 2, flex: 1, cursor: 'default' }}>
          <Typography variant="subtitle2" color="text.secondary">Fila monitoria</Typography>
          <Typography variant="h4" sx={{ fontWeight: 700, color: 'primary.dark' }}>3</Typography>
        </Paper>
        <Paper className="velohub-card" sx={{ p: 2, flex: 1, cursor: 'default' }}>
          <Typography variant="subtitle2" color="text.secondary">Treinamentos sugeridos</Typography>
          <Stack spacing={1} sx={{ mt: 1 }}>
            <Chip size="small" label="Tabulação ISP — módulo 2" />
            <Chip size="small" label="Tom Velodesk na resposta" />
          </Stack>
        </Paper>
      </Stack>
      <Paper className="container-main" sx={{ p: 2 }}>
        <Typography variant="h6" gutterBottom>Ações rápidas</Typography>
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
          <Button variant="outlined" href="/tickets">Abrir tickets</Button>
          <Button variant="outlined" href="/analytics-ia">Analytics IA</Button>
          <Button variant="contained">Registro rápido</Button>
        </Stack>
      </Paper>
    </Box>
  );
}
