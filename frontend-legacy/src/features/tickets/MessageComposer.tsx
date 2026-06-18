/** MessageComposer v1.2.0 — rascunho: POST único no Salvar/status; persistido: fluxo atual */
import { useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  ClickAwayListener,
  Divider,
  Fade,
  IconButton,
  Link,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FormatBoldIcon from '@mui/icons-material/FormatBold';
import FormatItalicIcon from '@mui/icons-material/FormatItalic';
import FormatUnderlinedIcon from '@mui/icons-material/FormatUnderlined';
import CloseIcon from '@mui/icons-material/Close';
import { Ticket } from '../../types';
import { suggestResponse } from '../ai/aiSuggestions';
import { ticketsApi, uploadsApi } from '../../api/client';
import { SAVE_STATUS_OPTIONS } from './ticketStatuses';
import { isDraftTicket } from './draftTicket';
import type { TicketUpdateMeta } from './ticketUpdateMeta';

interface Props {
  ticket: Ticket;
  onUpdate: (t: Ticket, meta?: TicketUpdateMeta) => void;
}

function wrapSelection(textarea: HTMLTextAreaElement, before: string, after: string): string {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const selected = textarea.value.substring(start, end);
  const next = `${textarea.value.substring(0, start)}${before}${selected}${after}${textarea.value.substring(end)}`;
  return next;
}

function fileLabel(url: string, index: number): string {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split('/');
    const name = parts[parts.length - 1];
    return name || `Anexo ${index + 1}`;
  } catch {
    return `Anexo ${index + 1}`;
  }
}

export default function MessageComposer({ ticket, onUpdate }: Props) {
  const [tab, setTab] = useState(0);
  const [reply, setReply] = useState('');
  const [attachments, setAttachments] = useState<string[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [statusPickerOpen, setStatusPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const lastClient = ticket.messages?.filter((m) => m.sender === 'them' || m.type === 'client').slice(-1)[0];
  const aiResponse = ticket.openedBy === 'client' || ticket.source === 'digital'
    ? suggestResponse(ticket, lastClient?.text)
    : null;

  const applyFormat = (before: string, after: string) => {
    const textarea = inputRef.current;
    if (!textarea) return;
    const next = wrapSelection(textarea, before, after);
    setReply(next);
    requestAnimationFrame(() => textarea.focus());
  };

  const uploadFile = async (file: File) => {
    setUploadError(null);
    setUploading(true);
    try {
      const { signedUrl, publicUrl } = await uploadsApi.getSignedUrl({
        fileName: file.name,
        contentType: file.type || 'application/octet-stream',
      });
      await fetch(signedUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
      });
      setAttachments((prev) => [...prev, publicUrl]);
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        || 'Upload indisponível. Bucket GCP será configurado posteriormente.';
      setUploadError(message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const saveWithStatus = async (status: string) => {
    setSaving(true);
    try {
      if (isDraftTicket(ticket)) {
        const lateral = (ticket.lateralForm ?? {}) as Record<string, unknown>;
        const created = await ticketsApi.create({
          chamadoProtocolo: ticket.chamadoProtocolo,
          status,
          lateralForm: lateral,
          text: reply,
          internal: tab === 1,
          attachments,
          ...lateral,
        });
        onUpdate(created, { fromDraftId: ticket._id });
      } else {
        const hasContent = reply.trim().length > 0 || attachments.length > 0;
        const statusChanged = status !== ticket.status;
        if (!hasContent && !statusChanged) {
          setStatusPickerOpen(false);
          return;
        }

        if (hasContent) {
          await ticketsApi.addMessage(ticket._id, {
            text: reply,
            sender: 'me',
            internal: tab === 1,
            attachments,
          });
        }
        if (statusChanged) {
          await ticketsApi.update(ticket._id, { status });
        }
        const fresh = await ticketsApi.get(ticket._id);
        onUpdate(fresh);
      }

      setReply('');
      setAttachments([]);
      setUploadError(null);
      setStatusPickerOpen(false);
    } finally {
      setSaving(false);
    }
  };

  const publicMessages = ticket.messages || [];
  const internalMessages = ticket.internalNotes || [];

  const saveActions = (
    <ClickAwayListener onClickAway={() => setStatusPickerOpen(false)}>
      <Box sx={{ position: 'relative', display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-end' }}>
        <Fade in={statusPickerOpen}>
          <Paper
            variant="outlined"
            sx={{
              position: 'absolute',
              right: 0,
              bottom: 'calc(100% + 6px)',
              py: 0.25,
              minWidth: 168,
              width: 'max-content',
              zIndex: 10,
              pointerEvents: statusPickerOpen ? 'auto' : 'none',
            }}
          >
            <Stack direction="column" spacing={0} sx={{ width: 'max-content', minWidth: 168 }}>
              {SAVE_STATUS_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  fullWidth
                  size="small"
                  variant="text"
                  disabled={saving || uploading}
                  onClick={() => saveWithStatus(option.value)}
                  sx={{
                    justifyContent: 'flex-start',
                    whiteSpace: 'nowrap',
                    fontWeight: option.value === ticket.status ? 700 : 500,
                    color: option.color ?? 'text.primary',
                    '&:hover': {
                      backgroundColor: 'action.hover',
                      color: option.color ?? 'text.primary',
                    },
                  }}
                >
                  {option.label}
                </Button>
              ))}
            </Stack>
          </Paper>
        </Fade>
        <Button
          variant="outlined"
          className="btn-container-secondary"
          onClick={() => setStatusPickerOpen((open) => !open)}
          disabled={uploading || saving}
          endIcon={statusPickerOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        >
          Salvar
        </Button>
      </Box>
    </ClickAwayListener>
  );

  return (
    <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', pr: 0.5 }}>
      <Paper
        variant="outlined"
        sx={{
          mb: 1,
          p: 2,
          minHeight: 160,
          maxHeight: 320,
          overflow: 'auto',
        }}
      >
          {publicMessages.length === 0 && internalMessages.length === 0 && (
            <Typography variant="body2" color="text.secondary">Nenhuma mensagem registrada.</Typography>
          )}
          {publicMessages.map((m, i) => (
            <Box key={m.id ?? `pub-${i}`} sx={{ textAlign: m.sender === 'me' ? 'right' : 'left', mb: 1 }}>
              <Chip
                size="small"
                label={m.text}
                color={m.sender === 'me' ? 'primary' : 'default'}
                sx={{ maxWidth: '85%', height: 'auto', '& .MuiChip-label': { whiteSpace: 'normal' } }}
              />
              {(m.attachments || []).length > 0 && (
                <Stack direction="row" spacing={0.5} sx={{ mt: 0.5, justifyContent: m.sender === 'me' ? 'flex-end' : 'flex-start', flexWrap: 'wrap' }}>
                  {(m.attachments || []).map((url, idx) => (
                    <Link key={`${url}-${idx}`} href={url} target="_blank" rel="noopener noreferrer" variant="caption">
                      {fileLabel(url, idx)}
                    </Link>
                  ))}
                </Stack>
              )}
            </Box>
          ))}
          {internalMessages.map((m, i) => (
            <Box key={m.id ?? `int-${i}`} sx={{ textAlign: 'left', mb: 1 }}>
              <Chip
                size="small"
                label={m.text}
                color="warning"
                variant="outlined"
                sx={{ maxWidth: '85%', height: 'auto', '& .MuiChip-label': { whiteSpace: 'normal' } }}
              />
              {(m.attachments || []).length > 0 && (
                <Stack direction="row" spacing={0.5} sx={{ mt: 0.5, flexWrap: 'wrap' }}>
                  {(m.attachments || []).map((url, idx) => (
                    <Link key={`${url}-${idx}`} href={url} target="_blank" rel="noopener noreferrer" variant="caption">
                      {fileLabel(url, idx)}
                    </Link>
                  ))}
                </Stack>
              )}
            </Box>
          ))}
      </Paper>

      {aiResponse && (
        <Alert severity="info" sx={{ mb: 2 }} action={<Button size="small" onClick={() => setReply(aiResponse)}>Usar</Button>}>
          <strong>Sugestão IA:</strong> {aiResponse}
        </Alert>
      )}

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 1 }}>
          <Tab label="Resposta pública" />
          <Tab label="Anotação interna" />
        </Tabs>
        <TextField
          fullWidth
          multiline
          rows={3}
          inputRef={inputRef}
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          placeholder={tab === 0 ? 'Digite a mensagem pública...' : 'Digite a anotação interna...'}
          sx={{ mb: 1 }}
        />

        <Paper variant="outlined" sx={{ px: 1, py: 0.5, mb: 1 }}>
          <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>Formatação</Typography>
            <Tooltip title="Negrito">
              <IconButton size="small" onClick={() => applyFormat('**', '**')} aria-label="Negrito">
                <FormatBoldIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Itálico">
              <IconButton size="small" onClick={() => applyFormat('_', '_')} aria-label="Itálico">
                <FormatItalicIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Sublinhado">
              <IconButton size="small" onClick={() => applyFormat('<u>', '</u>')} aria-label="Sublinhado">
                <FormatUnderlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
            <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>Anexos</Typography>
            <Button
              size="small"
              startIcon={<AttachFileIcon />}
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? 'Enviando...' : 'Anexar arquivo'}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadFile(file);
              }}
            />
          </Stack>
        </Paper>

        {uploadError && (
          <Alert severity="warning" sx={{ mb: 1 }} onClose={() => setUploadError(null)}>
            {uploadError}
          </Alert>
        )}

        {attachments.length > 0 && (
          <Stack direction="row" spacing={0.5} sx={{ mb: 1, flexWrap: 'wrap' }}>
            {attachments.map((url, idx) => (
              <Chip
                key={`${url}-${idx}`}
                size="small"
                label={fileLabel(url, idx)}
                onDelete={() => setAttachments((prev) => prev.filter((_, i) => i !== idx))}
                deleteIcon={<CloseIcon />}
              />
            ))}
          </Stack>
        )}
      </Paper>
      </Box>

      <Box
        sx={{
          flexShrink: 0,
          display: 'flex',
          justifyContent: 'flex-end',
          pt: 1,
          pb: 0.5,
          mt: 'auto',
          bgcolor: 'var(--cor-chamado-fundo)',
        }}
      >
        <Box sx={{ width: 'fit-content', maxWidth: '100%' }}>{saveActions}</Box>
      </Box>
    </Box>
  );
}
