/** Chat WhatsApp v1.0.0 */
import { useQuery } from '@tanstack/react-query';
import { Box, Paper, Typography, List, ListItemButton, ListItemText, Alert, CircularProgress, Stack } from '@mui/material';
import { whatsappApi } from '../../api/client';

export default function ChatPage() {
  const { data: status } = useQuery({ queryKey: ['wa-status'], queryFn: whatsappApi.status, refetchInterval: 10000 });
  const { data: conversations = [], isLoading, error } = useQuery({
    queryKey: ['wa-conversations'],
    queryFn: whatsappApi.conversations,
    enabled: !!status?.connected,
  });

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700 }} gutterBottom>Chat WhatsApp</Typography>
      {!status?.connected && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          WhatsApp desconectado. Inicie o backend com ENABLE_WHATSAPP=true e escaneie o QR no terminal.
        </Alert>
      )}
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
        <Paper sx={{ maxHeight: 480, overflow: 'auto', flex: 1 }}>
          {isLoading ? <CircularProgress sx={{ m: 2 }} /> : error ? (
            <Typography sx={{ p: 2 }} color="text.secondary">Conversas indisponíveis</Typography>
          ) : (
            <List dense>
              {conversations.map((c: { id: string; name: string; lastMessage: string }) => (
                <ListItemButton key={c.id}>
                  <ListItemText primary={c.name} secondary={c.lastMessage} />
                </ListItemButton>
              ))}
            </List>
          )}
        </Paper>
        <Paper sx={{ p: 3, minHeight: 480, flex: 2 }}>
          <Typography color="text.secondary">Selecione uma conversa para exibir mensagens.</Typography>
        </Paper>
      </Stack>
    </Box>
  );
}
