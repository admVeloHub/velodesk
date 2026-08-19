/**
 * ReclameAquiRegistroPage v1.2.0 — produto da tabulação Desk; motivo do órgão
 * VERSION: v1.2.0 | DATE: 2026-08-19
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useNotifications } from '../../../context/NotificationContext';
import { tabulationApi } from '../../../api/client';
import { useTabulation } from '../../../context/TabulationContext';
import { TABULACAO_OPCOES_CATEGORIAS } from '../../../services/tabulationConfig';
import {
  RA_TIPOS,
  formatSlaRestante,
  getStatusLabel,
} from '../../../services/especiais/reclameAquiData';
import {
  createEmptyReclamacao,
  getReclamacaoById,
  saveReclamacaoDraft,
} from '../../../services/especiais/reclameAquiStore';
import { registerReclamacaoAndCreateTicket } from '../../../services/especiais/reclameAquiTicketService';

const RESPOSTA_MAX = 2000;

function toDatetimeLocal(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDateInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function whatsappUrl(phone, message) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return null;
  const text = encodeURIComponent(message || '');
  return `https://wa.me/55${digits}?text=${text}`;
}

export default function ReclameAquiRegistroPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showNotification } = useNotifications();
  const { getProdutoNames } = useTabulation();
  const isNew = !id;
  const produtoOptions = getProdutoNames();

  const initial = useMemo(() => {
    if (isNew) return createEmptyReclamacao();
    return getReclamacaoById(id);
  }, [id, isNew]);

  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState({});
  const [registering, setRegistering] = useState(false);
  const [motivos, setMotivos] = useState([]);

  useEffect(() => {
    let cancelled = false;
    tabulationApi.getOpcoes(TABULACAO_OPCOES_CATEGORIAS.MOTIVO_RECLAME_AQUI, false)
      .then((doc) => {
        if (cancelled) return;
        const list = (doc?.opcoes || [])
          .filter((item) => item.ativo !== false)
          .map((item) => item.valor)
          .filter(Boolean);
        setMotivos(list);
      })
      .catch(() => {
        if (!cancelled) setMotivos([]);
      });
    return () => { cancelled = true; };
  }, []);

  if (!isNew && !initial) {
    return <Navigate to="/especiais/reclame-aqui" replace />;
  }

  const updateField = useCallback((field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }, []);

  const handleGoGestao = () => {
    navigate('/especiais/reclame-aqui');
  };

  const handleSaveDraft = () => {
    saveReclamacaoDraft(form);
    showNotification('Rascunho salvo com sucesso.', 'success');
  };

  const handleRegister = async () => {
    const nextErrors = {};
    if (!form.assunto?.trim()) nextErrors.assunto = 'Informe o assunto';
    if (!form.consumidor?.trim()) nextErrors.consumidor = 'Informe o consumidor';
    if (!form.idReclamacaoRa?.trim()) nextErrors.idReclamacaoRa = 'Informe o ID da reclamação (Id Origem)';
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      showNotification('Preencha os campos obrigatórios.', 'warning');
      return;
    }

    setRegistering(true);
    try {
      const { id } = await registerReclamacaoAndCreateTicket(form);
      showNotification('Reclamação registrada.', 'success');
      navigate(`/especiais/reclame-aqui/ticket/${id}`);
    } catch {
      showNotification('Não foi possível registrar a reclamação.', 'error');
    } finally {
      setRegistering(false);
    }
  };

  const handleWhatsApp = () => {
    const url = whatsappUrl(form.telefoneWhatsapp, form.whatsappMensagem);
    if (!url) {
      showNotification('Informe um telefone válido.', 'warning');
      return;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const protocoloDisplay = form.idReclamacaoRa ? `#${form.idReclamacaoRa}` : '—';
  const slaRestante = formatSlaRestante(form.prazoRa);

  return (
    <div className="ra-registro" id="reclameAquiRegistro">
      <header className="ra-registro__header">
        <div className="ra-registro__header-left">
          <div className="ra-registro__breadcrumb">
            <span>Reclame Aqui</span>
            <i className="ti ti-chevron-right" aria-hidden="true" />
            <span>Registro de reclamação</span>
          </div>
          <div className="ra-registro__header-meta">
            <span className="ra-registro__protocol">{protocoloDisplay}</span>
            <span className={`ra-badge ra-badge--${form.statusRa}`}>
              {getStatusLabel(form.statusRa)}
            </span>
          </div>
        </div>
        <button type="button" className="ra-registro__gestao-btn" onClick={handleGoGestao}>
          Ir para gestão
          <i className="ti ti-arrow-right" aria-hidden="true" />
        </button>
      </header>

      <div className="ra-registro__body">
        <div className="ra-registro__layout">
          <main className="ra-registro__main">
            <section className="ra-registro__card">
              <h2 className="ra-registro__card-title">Dados da reclamação</h2>
              <div className="ra-registro__field">
                <label htmlFor="ra-assunto">Assunto</label>
                <input
                  id="ra-assunto"
                  type="text"
                  className={`ra-registro__input${errors.assunto ? ' is-error' : ''}`}
                  value={form.assunto}
                  onChange={(e) => updateField('assunto', e.target.value)}
                  placeholder="Ex.: Internet cai toda noite após 22h"
                />
                {errors.assunto ? <span className="ra-registro__error">{errors.assunto}</span> : null}
              </div>
              <div className="ra-registro__field">
                <label htmlFor="ra-descricao">Descrição da reclamação</label>
                <textarea
                  id="ra-descricao"
                  className="ra-registro__textarea"
                  rows={5}
                  value={form.descricao}
                  onChange={(e) => updateField('descricao', e.target.value)}
                  placeholder="Descreva a reclamação do consumidor..."
                />
              </div>
              <div className="ra-registro__row ra-registro__row--2">
                <div className="ra-registro__field">
                  <label htmlFor="ra-id-ext">ID da reclamação</label>
                  <input
                    id="ra-id-ext"
                    type="text"
                    className={`ra-registro__input${errors.idReclamacaoRa ? ' is-error' : ''}`}
                    value={form.idReclamacaoRa || ''}
                    onChange={(e) => updateField('idReclamacaoRa', e.target.value)}
                    placeholder="Id Origem da reclamação"
                    readOnly={!isNew}
                  />
                  {errors.idReclamacaoRa ? <span className="ra-registro__error">{errors.idReclamacaoRa}</span> : null}
                </div>
                <div className="ra-registro__field">
                  <label htmlFor="ra-data">Data da reclamação</label>
                  <input
                    id="ra-data"
                    type="text"
                    className="ra-registro__input ra-registro__input--readonly"
                    value={formatDateInput(form.dataReclamacao)}
                    readOnly
                  />
                </div>
              </div>
            </section>

            <section className="ra-registro__card">
              <div className="ra-registro__card-head">
                <h2 className="ra-registro__card-title">Classificação</h2>
              </div>
              <div className="ra-registro__row ra-registro__row--3">
                <div className="ra-registro__field">
                  <label htmlFor="ra-produto">Produto</label>
                  <select
                    id="ra-produto"
                    className="ra-registro__select"
                    value={form.produto}
                    onChange={(e) => updateField('produto', e.target.value)}
                  >
                    <option value="">Selecione...</option>
                    {produtoOptions.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                    {form.produto && !produtoOptions.includes(form.produto) ? (
                      <option value={form.produto}>{form.produto}</option>
                    ) : null}
                  </select>
                </div>
                <div className="ra-registro__field">
                  <label htmlFor="ra-tipo">Tipo</label>
                  <select
                    id="ra-tipo"
                    className="ra-registro__select"
                    value={form.tipo}
                    onChange={(e) => updateField('tipo', e.target.value)}
                  >
                    {RA_TIPOS.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div className="ra-registro__field">
                  <label htmlFor="ra-motivo">Motivo</label>
                  <select
                    id="ra-motivo"
                    className="ra-registro__select"
                    value={form.motivo}
                    onChange={(e) => updateField('motivo', e.target.value)}
                  >
                    <option value="">Selecione...</option>
                    {motivos.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>
            </section>

            <section className="ra-registro__card">
              <div className="ra-registro__card-head">
                <h2 className="ra-registro__card-title">Resposta pública — Reclame Aqui</h2>
                <span className="ra-registro__char-count">
                  {(form.respostaPublica || '').length} / {RESPOSTA_MAX}
                </span>
              </div>
              <textarea
                className="ra-registro__textarea"
                rows={6}
                maxLength={RESPOSTA_MAX}
                value={form.respostaPublica}
                onChange={(e) => updateField('respostaPublica', e.target.value)}
                placeholder="Escreva a resposta pública..."
              />
            </section>
          </main>

          <aside className="ra-registro__side">
            <section className="ra-registro__side-card">
              <h3 className="ra-registro__side-title">Indicadores operacionais</h3>
              <div className="ra-registro__field">
                <label htmlFor="ra-prazo">Prazo RA</label>
                <input
                  id="ra-prazo"
                  type="datetime-local"
                  className="ra-registro__input"
                  value={toDatetimeLocal(form.prazoRa)}
                  onChange={(e) => updateField(
                    'prazoRa',
                    e.target.value ? new Date(e.target.value).toISOString() : '',
                  )}
                />
              </div>
              <p className="ra-registro__side-label">Passível de nota?</p>
              <div className="ra-registro__toggle">
                <button
                  type="button"
                  className={`ra-registro__toggle-btn${form.passivelNota ? ' is-active' : ''}`}
                  onClick={() => updateField('passivelNota', true)}
                >
                  Sim
                </button>
                <button
                  type="button"
                  className={`ra-registro__toggle-btn${!form.passivelNota ? ' is-active' : ''}`}
                  onClick={() => updateField('passivelNota', false)}
                >
                  Não
                </button>
              </div>
            </section>

            <section className="ra-registro__side-card ra-registro__side-card--whatsapp">
              <h3 className="ra-registro__side-title">
                <i className="ti ti-brand-whatsapp" aria-hidden="true" />
                Primeiro contato via WhatsApp
              </h3>
              <div className="ra-registro__field">
                <label htmlFor="ra-telefone">Telefone</label>
                <input
                  id="ra-telefone"
                  type="text"
                  className="ra-registro__input"
                  value={form.telefoneWhatsapp}
                  onChange={(e) => updateField('telefoneWhatsapp', e.target.value)}
                  placeholder="(11) 99999-9999"
                />
              </div>
              <div className="ra-registro__field">
                <label htmlFor="ra-wa-msg">Mensagem</label>
                <textarea
                  id="ra-wa-msg"
                  className="ra-registro__textarea ra-registro__textarea--sm"
                  rows={3}
                  value={form.whatsappMensagem}
                  onChange={(e) => updateField('whatsappMensagem', e.target.value)}
                />
              </div>
              <button type="button" className="ra-registro__wa-btn" onClick={handleWhatsApp}>
                <i className="ti ti-brand-whatsapp" aria-hidden="true" />
                Enviar via WhatsApp
              </button>
            </section>

            <section className="ra-registro__side-card">
              <h3 className="ra-registro__side-title">Consumidor</h3>
              <div className="ra-registro__field">
                <label htmlFor="ra-consumidor">Nome</label>
                <input
                  id="ra-consumidor"
                  type="text"
                  className={`ra-registro__input${errors.consumidor ? ' is-error' : ''}`}
                  value={form.consumidor}
                  onChange={(e) => updateField('consumidor', e.target.value)}
                  placeholder="Nome completo"
                />
                {errors.consumidor ? (
                  <span className="ra-registro__error">{errors.consumidor}</span>
                ) : null}
              </div>
              <div className="ra-registro__field">
                <label htmlFor="ra-cpf">CPF</label>
                <input
                  id="ra-cpf"
                  type="text"
                  className="ra-registro__input"
                  value={form.cpf}
                  onChange={(e) => updateField('cpf', e.target.value)}
                  placeholder="000.000.000-00"
                />
              </div>
            </section>

            <section className="ra-registro__side-card">
              <div className="ra-registro__field">
                <label htmlFor="ra-atendente">Atendente</label>
                <input
                  id="ra-atendente"
                  type="text"
                  className="ra-registro__input"
                  value={form.atendente === '—' ? '' : form.atendente}
                  onChange={(e) => updateField('atendente', e.target.value || '—')}
                  placeholder="Nome do atendente"
                />
              </div>
            </section>
          </aside>
        </div>
      </div>

      <footer className="ra-registro__footer">
        <div className="ra-registro__footer-summary">
          <span>{protocoloDisplay}</span>
          <span>·</span>
          <span>{form.consumidor || 'Consumidor não informado'}</span>
          <span>·</span>
          <span>{getStatusLabel(form.statusRa)}</span>
          <span>·</span>
          <span>{slaRestante}</span>
        </div>
        <div className="ra-registro__footer-actions">
          <button type="button" className="ra-registro__btn ra-registro__btn--ghost" onClick={handleSaveDraft}>
            Salvar rascunho
          </button>
          <button
            type="button"
            className="ra-registro__btn ra-registro__btn--primary"
            onClick={handleRegister}
            disabled={registering}
          >
            <i className="ti ti-check" aria-hidden="true" />
            {registering ? 'Registrando...' : 'Registrar reclamação'}
          </button>
        </div>
      </footer>
    </div>
  );
}
