/** LateralForm v1.2.1 — e-mail/telefone com floating label (sem caption redundante) */
import {
  Box,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import { PRODUCT_TREE, Ticket } from '../../types';
import { mergeChamadoForm, readChamadoForm } from './ticketChamadoForm';
import {
  BASE,
  compactFieldSx,
  scaled,
  sectionDividerSx,
  sectionTitleSx,
  sidebarSx,
} from './ticketFormStyles';

const TIPO_CHAMADO_OPTIONS = ['Reclamação', 'Solicitação', 'Informação', 'Elogio', 'Cancelamento'];

interface Props {
  ticket: Ticket;
  onChange: (lateralForm: Record<string, unknown>) => void;
}

interface ListFieldProps {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
}

function ListField({ label, values, onChange }: ListFieldProps) {
  const updateItem = (index: number, value: string) => {
    const next = [...values];
    next[index] = value;
    onChange(next);
  };

  const addItem = () => onChange([...values, '']);

  const removeItem = (index: number) => {
    if (values.length <= 1) {
      onChange(['']);
      return;
    }
    onChange(values.filter((_, i) => i !== index));
  };

  return (
    <Box>
      {values.map((value, index) => (
        <Stack key={`${label}-${index}`} direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
          <TextField
            fullWidth
            size="small"
            label={values.length > 1 ? `${label} ${index + 1}` : label}
            value={value}
            sx={compactFieldSx}
            onChange={(e) => updateItem(index, e.target.value)}
          />
          {values.length > 1 && (
            <IconButton size="small" aria-label={`Remover ${label}`} onClick={() => removeItem(index)}>
              <RemoveIcon fontSize="small" />
            </IconButton>
          )}
          {index === values.length - 1 && (
            <IconButton size="small" aria-label={`Adicionar ${label}`} onClick={addItem}>
              <AddIcon fontSize="small" />
            </IconButton>
          )}
        </Stack>
      ))}
    </Box>
  );
}

export default function LateralForm({ ticket, onChange }: Props) {
  const form = readChamadoForm(ticket);
  const motivos = form.produto ? Object.keys(PRODUCT_TREE[form.produto] || {}) : [];
  const detalhes = form.produto && form.motivo ? PRODUCT_TREE[form.produto]?.[form.motivo] || [] : [];

  const update = (partial: Partial<ReturnType<typeof readChamadoForm>>) => {
    onChange(mergeChamadoForm(ticket, partial));
  };

  return (
    <Box sx={sidebarSx}>
      <Typography sx={sectionTitleSx}>Atribuições</Typography>
      <TextField
        fullWidth
        size="small"
        label="Responsável"
        value={form.responsavel}
        sx={compactFieldSx}
        onChange={(e) => update({ responsavel: e.target.value })}
      />
      <TextField
        fullWidth
        size="small"
        label="Atribuído"
        value={form.atribuido}
        sx={compactFieldSx}
        onChange={(e) => update({ atribuido: e.target.value })}
      />

      <Divider sx={sectionDividerSx} />

      <Typography sx={sectionTitleSx}>Cliente</Typography>
      <TextField
        fullWidth
        size="small"
        label="CPF"
        value={form.clienteCpf}
        sx={compactFieldSx}
        onChange={(e) => update({ clienteCpf: e.target.value })}
      />
      <TextField
        fullWidth
        size="small"
        label="Nome"
        value={form.clienteNome}
        sx={compactFieldSx}
        onChange={(e) => update({ clienteNome: e.target.value })}
      />
      <ListField
        label="E-mail"
        values={form.clienteEmail}
        onChange={(clienteEmail) => update({ clienteEmail })}
      />
      <ListField
        label="Telefone"
        values={form.clienteTelefone}
        onChange={(clienteTelefone) => update({ clienteTelefone })}
      />

      <Divider sx={sectionDividerSx} />

      <Typography sx={sectionTitleSx}>Tabulação</Typography>
      <FormControl fullWidth size="small" sx={compactFieldSx}>
        <InputLabel>Tipo de chamado</InputLabel>
        <Select
          label="Tipo de chamado"
          value={form.tipoChamado}
          onChange={(e) => update({ tipoChamado: e.target.value })}
        >
          {TIPO_CHAMADO_OPTIONS.map((o) => (
            <MenuItem key={o} value={o} sx={{ fontSize: scaled(BASE.menuItemFont) }}>{o}</MenuItem>
          ))}
        </Select>
      </FormControl>
      <FormControl fullWidth size="small" sx={compactFieldSx}>
        <InputLabel>Produto</InputLabel>
        <Select
          label="Produto"
          value={form.produto}
          onChange={(e) => update({ produto: e.target.value, motivo: '', detalhe: '' })}
        >
          {Object.keys(PRODUCT_TREE).map((p) => (
            <MenuItem key={p} value={p} sx={{ fontSize: scaled(BASE.menuItemFont) }}>{p}</MenuItem>
          ))}
        </Select>
      </FormControl>
      {motivos.length > 0 && (
        <FormControl fullWidth size="small" sx={compactFieldSx}>
          <InputLabel>Motivo</InputLabel>
          <Select
            label="Motivo"
            value={form.motivo}
            onChange={(e) => update({ motivo: e.target.value, detalhe: '' })}
          >
            {motivos.map((m) => (
              <MenuItem key={m} value={m} sx={{ fontSize: scaled(BASE.menuItemFont) }}>{m}</MenuItem>
            ))}
          </Select>
        </FormControl>
      )}
      {detalhes.length > 0 && (
        <FormControl fullWidth size="small" sx={compactFieldSx}>
          <InputLabel>Detalhe</InputLabel>
          <Select label="Detalhe" value={form.detalhe} onChange={(e) => update({ detalhe: e.target.value })}>
            {detalhes.map((d) => (
              <MenuItem key={d} value={d} sx={{ fontSize: scaled(BASE.menuItemFont) }}>{d}</MenuItem>
            ))}
          </Select>
        </FormControl>
      )}
    </Box>
  );
}
