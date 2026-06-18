import { useState } from 'react';
import { Box, Tab, Tabs, Paper, Typography } from '@mui/material';

const TABS = ['Formulário lateral', 'Formulários', 'Workflows', 'Backup', 'API', 'Automações'];

export default function ConfigPage() {
  const [tab, setTab] = useState(0);
  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700 }} gutterBottom>Configurações</Typography>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }} variant="scrollable">
        {TABS.map((t) => <Tab key={t} label={t} />)}
      </Tabs>
      <Paper sx={{ p: 3 }}>
        <Typography color="text.secondary">{TABS[tab]} — painel admin (Fase 4).</Typography>
      </Paper>
    </Box>
  );
}
