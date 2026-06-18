import { Dialog, DialogTitle, DialogContent, TextField, Button, Box } from '@mui/material';
import { useState } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function AiAssistantDialog({ open, onClose }: Props) {
  const [input, setInput] = useState('');
  const [reply, setReply] = useState('');

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Assistente IA</DialogTitle>
      <DialogContent>
        <TextField fullWidth multiline rows={3} label="Sua pergunta" value={input} onChange={(e) => setInput(e.target.value)} sx={{ mb: 2 }} />
        <Button variant="contained" onClick={() => setReply('Sugestão: use tom formal Velodesk e confirme dados do cliente antes de escalar.')}>Gerar sugestão</Button>
        {reply && <Box sx={{ mt: 2, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>{reply}</Box>}
      </DialogContent>
    </Dialog>
  );
}
