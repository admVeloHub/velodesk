import { useQuery } from '@tanstack/react-query';
import { Box, Paper, Typography, CircularProgress, Stack } from '@mui/material';
import { statsApi } from '../../api/client';

export default function DashboardPage() {
  const { data, isLoading } = useQuery({ queryKey: ['dashboard'], queryFn: statsApi.dashboard });

  if (isLoading) return <CircularProgress />;

  const cards = [
    { label: 'Total tickets', value: data?.total ?? 0 },
    { label: 'Resolvidos', value: data?.resolved ?? 0 },
    { label: 'Pendentes', value: data?.pending ?? 0 },
    { label: 'Agentes', value: data?.agents ?? 0 },
  ];

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700 }} gutterBottom>Dashboard</Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} useFlexGap sx={{ flexWrap: 'wrap' }}>
        {cards.map((c) => (
          <Paper key={c.label} sx={{ p: 2, textAlign: 'center', minWidth: 140, flex: 1 }}>
            <Typography variant="h4" sx={{ fontWeight: 700 }} color="primary">{c.value}</Typography>
            <Typography variant="body2" color="text.secondary">{c.label}</Typography>
          </Paper>
        ))}
      </Stack>
    </Box>
  );
}
