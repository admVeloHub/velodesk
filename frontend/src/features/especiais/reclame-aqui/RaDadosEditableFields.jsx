/**
 * RaDadosEditableFields — ID Reclame Aqui, Assunto e Prazo de resposta editáveis no DADOS
 */
import React, { useEffect, useState } from 'react';
import { reclamacoesApi } from '../../../api/client';
import { useNotifications } from '../../../context/NotificationContext';

/** Converte ISO -> valor aceito por <input type="datetime-local"> (hora local). */
function toDatetimeLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function RaDadosEditableFields({ raItem, onSaved }) {
  const { showNotification } = useNotifications();
  const [saving, setSaving] = useState(false);
  const [idReclamacaoRa, setIdReclamacaoRa] = useState(raItem?.idReclamacaoRa || '');
  const [assunto, setAssunto] = useState(raItem?.assunto || '');
  const [prazoRa, setPrazoRa] = useState(raItem?.prazoRa || '');

  useEffect(() => {
    setIdReclamacaoRa(raItem?.idReclamacaoRa || '');
    setAssunto(raItem?.assunto || '');
    setPrazoRa(raItem?.prazoRa || '');
  }, [raItem?.id]);

  if (!raItem) return null;

  const patchFields = async (patch) => {
    if (!raItem?.id || saving) return;
    setSaving(true);
    try {
      const updated = await reclamacoesApi.patch('reclame-aqui', raItem.id, patch);
      onSaved?.({ ...raItem, ...updated });
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Não foi possível salvar.';
      showNotification(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleIdBlur = () => {
    const value = idReclamacaoRa.trim();
    if (value === (raItem.idReclamacaoRa || '')) return;
    patchFields({ protocoloExterno: value, idDemandaExterna: value });
  };

  const handleAssuntoBlur = () => {
    const value = assunto.trim();
    if (value === (raItem.assunto || '')) return;
    patchFields({ assunto: value });
  };

  const handlePrazoChange = (raw) => {
    const iso = raw ? new Date(raw).toISOString() : '';
    setPrazoRa(iso);
    patchFields({ prazoLegal: iso || null });
  };

  return (
    <>
      <div>
        <dt>ID Reclame Aqui</dt>
        <dd>
          <input
            type="text"
            className="ra-registro__input"
            value={idReclamacaoRa}
            onChange={(e) => setIdReclamacaoRa(e.target.value)}
            onBlur={handleIdBlur}
            disabled={saving}
            placeholder="ID da reclamação"
          />
        </dd>
      </div>
      <div>
        <dt>Assunto</dt>
        <dd>
          <input
            type="text"
            className="ra-registro__input"
            value={assunto}
            onChange={(e) => setAssunto(e.target.value)}
            onBlur={handleAssuntoBlur}
            disabled={saving}
            placeholder="Assunto da reclamação"
          />
        </dd>
      </div>
      <div>
        <dt>Prazo de resposta</dt>
        <dd>
          <input
            type="datetime-local"
            className="ra-registro__input"
            value={toDatetimeLocalInput(prazoRa)}
            onChange={(e) => handlePrazoChange(e.target.value)}
            disabled={saving}
          />
        </dd>
      </div>
    </>
  );
}
