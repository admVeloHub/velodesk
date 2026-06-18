import { useState } from 'react';
import { Box, Tab, Tabs, Paper, Typography } from '@mui/material';

const TABS = ['Importação', 'Leitura', 'Performance', 'Agentes', 'Satisfação'];

export default function ReportsPage() {
  const [tab, setTab] = useState(0);
  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700 }} gutterBottom>Relatórios</Typography>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        {TABS.map((t) => <Tab key={t} label={t} />)}
      </Tabs>
      <Paper sx={{ p: 3 }}>
        <Typography color="text.secondary">Aba {TABS[tab]} — import XLSX e gráficos (Fase 4).</Typography>
      </Paper>
    </Box>
  );
}
