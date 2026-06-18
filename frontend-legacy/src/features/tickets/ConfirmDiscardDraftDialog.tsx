/** ConfirmDiscardDraftDialog v1.0.0 — confirma descarte de rascunho local */
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';

interface Props {
  open: boolean;
  protocolo?: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function ConfirmDiscardDraftDialog({ open, protocolo, onCancel, onConfirm }: Props) {
  return (
    <Dialog open={open} onClose={onCancel} maxWidth="xs" fullWidth>
      <DialogTitle>Descartar rascunho?</DialogTitle>
      <DialogContent>
        <DialogContentText>
          O chamado{protocolo ? ` ${protocolo}` : ''} ainda não foi salvo. As alterações serão perdidas.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Cancelar</Button>
        <Button onClick={onConfirm} color="error" variant="contained">
          Descartar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
