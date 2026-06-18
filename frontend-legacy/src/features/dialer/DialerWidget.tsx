/** 55PBX Dialer widget v1.0.0 */
import { useState } from 'react';
import { Fab, Paper, TextField, IconButton, Box, Typography } from '@mui/material';
import PhoneIcon from '@mui/icons-material/Phone';
import CloseIcon from '@mui/icons-material/Close';

export default function DialerWidget() {
  const [open, setOpen] = useState(false);
  const [number, setNumber] = useState('');

  return (
    <>
      <Fab color="secondary" sx={{ position: 'fixed', bottom: 24, right: 24 }} onClick={() => setOpen(!open)}>
        <PhoneIcon />
      </Fab>
      {open && (
        <Paper sx={{ position: 'fixed', bottom: 90, right: 24, p: 2, width: 280, zIndex: 1300 }} elevation={8}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Discador 55PBX</Typography>
            <IconButton size="small" onClick={() => setOpen(false)}><CloseIcon fontSize="small" /></IconButton>
          </Box>
          <TextField fullWidth size="small" label="Número" value={number} onChange={(e) => setNumber(e.target.value)} />
        </Paper>
      )}
    </>
  );
}
