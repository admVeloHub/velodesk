/** Analytics IA v1.1.0 */
import { Box, Paper, Typography, Stack } from '@mui/material';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function AnalyticsPage() {
  const chartData = {
    labels: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'],
    datasets: [
      {
        label: 'Tickets resolvidos',
        data: [12, 19, 8, 15, 22],
        backgroundColor: '#1634FF',
        hoverBackgroundColor: '#000058',
      },
    ],
  };

  return (
    <Box>
      <Typography variant="h5" gutterBottom>Analytics IA</Typography>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <Paper className="container-main" sx={{ p: 2, flex: 2 }}>
          <Bar data={chartData} options={{ responsive: true, plugins: { legend: { display: false } } }} />
        </Paper>
        <Paper className="velohub-card" sx={{ p: 2, flex: 1, cursor: 'default' }}>
          <Typography variant="subtitle2" color="text.secondary">Insights IA</Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>Pico de reclamações Fibra às terças. Sugestão: reforço N2.</Typography>
        </Paper>
      </Stack>
    </Box>
  );
}
