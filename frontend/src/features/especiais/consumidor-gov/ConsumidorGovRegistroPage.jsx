/**
 * ConsumidorGovRegistroPage — formulário de registro / resposta RA
 */
import React, { useCallback, useMemo, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useNotifications } from '../../../context/NotificationContext';
import {
  CG_MOTIVOS,
  CG_ORGAOS,
  CG_PRODUTOS,
  CG_TIPOS,
  formatSlaRestante,
  getStatusLabel,
} from '../../../services/especiais/consumidorGovData';
import {
  createEmptyDemanda,
  getDemandaById,
  saveDemandaDraft,
} from '../../../services/especiais/consumidorGovStore';
import { registerDemandaAndCreateTicket } from '../../../services/especiais/consumidorGovTicketService';

const RESPOSTA_MAX = 2000;

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

export default function ConsumidorGovRegistroPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showNotification } = useNotifications();
  const isNew = !id;

  const initial = useMemo(() => {
    if (isNew) return createEmptyDemanda();
    return getDemandaById(id);
  }, [id, isNew]);

  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState({});
  const [registering, setRegistering] = useState(false);

  if (!isNew && !initial) {
    return <Navigate to="/especiais/consumidor-gov" replace />;
  }

  const updateField = useCallback((field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }, []);

  const handleGoGestao = () => {
    navigate('/especiais/consumidor-gov');
  };

  const handleSaveDraft = () => {
    saveDemandaDraft(form);
    showNotification('Rascunho salvo com sucesso.', 'success');
  };

  const handleRegister = async () => {
    const nextErrors = {};
    if (!form.assunto?.trim()) nextErrors.assunto = 'Informe o assunto';
    if (!form.consumidor?.trim()) nextErrors.consumidor = 'Informe o consumidor';
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      showNotification('Preencha os campos obrigatórios.', 'warning');
      return;
    }

    setRegistering(true);
    try {
      const { id } = await registerDemandaAndCreateTicket(form);
      showNotification('Demanda registrada e workflow acionado.', 'success');
      navigate(`/especiais/consumidor-gov/ticket/${id}`);
    } catch {
      showNotification('Não foi possível registrar a demanda.', 'error');
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

  const protocoloDisplay = form.protocoloGov ? `#${form.protocoloGov}` : '—';
  const slaRestante = formatSlaRestante(form.prazoLegal);

  return (
    <div className="ra-registro" id="consumidorGovRegistro">
      <header className="ra-registro__header">
        <div className="ra-registro__header-left">
          <div className="ra-registro__breadcrumb">
            <span>ConsumidorGov</span>
            <i className="ti ti-chevron-right" aria-hidden="true" />
            <span>Registro de demanda</span>
          </div>
          <div className="ra-registro__header-meta">
            <span className="ra-registro__protocol">{protocoloDisplay}</span>
            <span className={`ra-badge ra-badge--${form.statusGov}`}>
              {getStatusLabel(form.statusGov)}
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
              <h2 className="ra-registro__card-title">Dados da demanda</h2>
              <div className="ra-registro__field">
                <label htmlFor="cg-assunto">Assunto</label>
                <input
                  id="cg-assunto"
                  type="text"
                  className={`ra-registro__input${errors.assunto ? ' is-error' : ''}`}
                  value={form.assunto}
                  onChange={(e) => updateField('assunto', e.target.value)}
                  placeholder="Ex.: Internet cai toda noite após 22h"
                />
                {errors.assunto ? <span className="ra-registro__error">{errors.assunto}</span> : null}
              </div>
              <div className="ra-registro__field">
                <label htmlFor="cg-descricao">Descrição da demanda</label>
                <textarea
                  id="cg-descricao"
                  className="ra-registro__textarea"
                  rows={5}
                  value={form.descricao}
                  onChange={(e) => updateField('descricao', e.target.value)}
                  placeholder="Descreva a demanda do consumidor..."
                />
              </div>
              <div className="ra-registro__row ra-registro__row--2">
                <div className="ra-registro__field">
                  <label htmlFor="cg-id-ext">ID da demanda</label>
                  <input
                    id="cg-id-ext"
                    type="text"
                    className="ra-registro__input ra-registro__input--readonly"
                    value={form.idDemanda || '—'}
                    readOnly
                  />
                </div>
                <div className="ra-registro__field">
                  <label htmlFor="cg-data">Data da demanda</label>
                  <input
                    id="cg-data"
                    type="text"
                    className="ra-registro__input ra-registro__input--readonly"
                    value={formatDateInput(form.dataDemanda)}
                    readOnly
                  />
                </div>
              </div>
            </section>

            <section className="ra-registro__card">
              <div className="ra-registro__card-head">
                <h2 className="ra-registro__card-title">Classificação e workflow</h2>
                {form.workflowAtivo ? (
                  <span className="ra-registro__wf-badge">Workflow ativo</span>
                ) : null}
              </div>
              <div className="ra-registro__row ra-registro__row--3">
                <div className="ra-registro__field">
                  <label htmlFor="cg-produto">Produto</label>
                  <select
                    id="cg-produto"
                    className="ra-registro__select"
                    value={form.produto}
                    onChange={(e) => updateField('produto', e.target.value)}
                  >
                    {CG_PRODUTOS.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div className="ra-registro__field">
                  <label htmlFor="cg-tipo">Tipo</label>
                  <select
                    id="cg-tipo"
                    className="ra-registro__select"
                    value={form.tipo}
                    onChange={(e) => updateField('tipo', e.target.value)}
                  >
                    {CG_TIPOS.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div className="ra-registro__field">
                  <label htmlFor="cg-motivo">Motivo</label>
                  <select
                    id="cg-motivo"
                    className="ra-registro__select"
                    value={form.motivo}
                    onChange={(e) => updateField('motivo', e.target.value)}
                  >
                    <option value="">Selecione...</option>
                    {CG_MOTIVOS.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>
            </section>

            <section className="ra-registro__card">
              <div className="ra-registro__card-head">
                <h2 className="ra-registro__card-title">Resposta pública — ConsumidorGov</h2>
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
              <h3 className="ra-registro__side-title">Órgão ConsumidorGov</h3>
              <div className="ra-registro__field">
                <label htmlFor="cg-orgao">Órgão</label>
                <select
                  id="cg-orgao"
                  className="ra-registro__select"
                  value={form.orgaoGov || ''}
                  onChange={(e) => updateField('orgaoGov', e.target.value)}
                >
                  <option value="">Selecione...</option>
                  {CG_ORGAOS.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </div>
              <div className="ra-registro__row ra-registro__row--2">
                <div className="ra-registro__field">
                  <label htmlFor="cg-cidade">Cidade</label>
                  <input
                    id="cg-cidade"
                    type="text"
                    className="ra-registro__input"
                    value={form.cidade || ''}
                    onChange={(e) => updateField('cidade', e.target.value)}
                  />
                </div>
                <div className="ra-registro__field">
                  <label htmlFor="cg-uf">UF</label>
                  <input
                    id="cg-uf"
                    type="text"
                    className="ra-registro__input"
                    maxLength={2}
                    value={form.uf || ''}
                    onChange={(e) => updateField('uf', e.target.value.toUpperCase())}
                  />
                </div>
              </div>
            </section>

            <section className="ra-registro__side-card ra-registro__side-card--whatsapp">
              <h3 className="ra-registro__side-title">
                <i className="ti ti-brand-whatsapp" aria-hidden="true" />
                Primeiro contato via WhatsApp
              </h3>
              <div className="ra-registro__field">
                <label htmlFor="cg-telefone">Telefone</label>
                <input
                  id="cg-telefone"
                  type="text"
                  className="ra-registro__input"
                  value={form.telefoneWhatsapp}
                  onChange={(e) => updateField('telefoneWhatsapp', e.target.value)}
                  placeholder="(11) 99999-9999"
                />
              </div>
              <div className="ra-registro__field">
                <label htmlFor="cg-wa-msg">Mensagem</label>
                <textarea
                  id="cg-wa-msg"
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
                <label htmlFor="cg-consumidor">Nome</label>
                <input
                  id="cg-consumidor"
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
                <label htmlFor="cg-cpf">CPF</label>
                <input
                  id="cg-cpf"
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
                <label htmlFor="cg-atendente">Atendente</label>
                <input
                  id="cg-atendente"
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
          <span>{getStatusLabel(form.statusGov)}</span>
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
            {registering ? 'Registrando...' : 'Registrar e acionar workflow'}
          </button>
        </div>
      </footer>
    </div>
  );
}
