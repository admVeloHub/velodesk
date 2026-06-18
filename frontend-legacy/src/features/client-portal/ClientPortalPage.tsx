/** Portal Cliente v1.0.0 */
import { Box, Paper, Typography, Chip, List, ListItem, ListItemText, Stack } from '@mui/material';

export default function ClientPortalPage() {
  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700 }} gutterBottom>Portal do Cliente</Typography>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <Paper sx={{ p: 2, flex: 1 }}>
          <Typography variant="h6">Maria Silva</Typography>
          <Typography variant="body2" color="text.secondary">CPF ••••8901</Typography>
          <Chip label="NPS 8" color="success" size="small" sx={{ mt: 1 }} />
        </Paper>
        <Paper sx={{ p: 2, flex: 2 }}>
          <Typography variant="subtitle1" gutterBottom>Produtos contratados</Typography>
          <List dense>
            <ListItem><ListItemText primary="Internet Fibra 500Mbps" secondary="Ativo" /></ListItem>
            <ListItem><ListItemText primary="TV HD" secondary="Ativo" /></ListItem>
          </List>
        </Paper>
      </Stack>
    </Box>
  );
}
