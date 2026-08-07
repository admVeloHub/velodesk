/**
 * ConsumidorGovNovaCpfPage — nova demanda ConsumidorGov por CPF (rota /especiais/consumidor-gov/nova)
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import RegisterClientModal from '../../desk/components/RegisterClientModal';
import { useGovNovaDemandaCpf } from '../../../hooks/useGovNovaDemandaCpf';

export default function ConsumidorGovNovaCpfPage() {
  const navigate = useNavigate();

  const handleSuccess = (cgId) => {
    navigate(`/especiais/consumidor-gov/ticket/${cgId}`, { replace: true });
  };

  const handleClose = () => {
    navigate('/especiais/consumidor-gov');
  };

  const {
    cpfRef,
    cpfInput,
    loading,
    registerOpen,
    pendingCpf,
    handleAdvance,
    handleRegisterSaved,
    handleRegisterClose,
    handleCpfChange,
    handleKeyDown,
  } = useGovNovaDemandaCpf({ onSuccess: handleSuccess, onClose: handleClose });

  return (
    <>
      <div className="ra-registro ra-nova-cpf-page" id="consumidorGovNovaCpf">
        <header className="ra-registro__header">
          <div className="ra-registro__header-left">
            <div className="ra-registro__breadcrumb">
              <span>ConsumidorGov</span>
              <i className="ti ti-chevron-right" aria-hidden="true" />
              <span>Nova demanda</span>
            </div>
            <div className="ra-registro__header-meta">
              <span className="ra-registro__protocol">Cadastro por CPF</span>
            </div>
          </div>
          <div className="ra-registro__header-actions">
            <button type="button" className="ra-registro__gestao-btn" onClick={handleClose}>
              Voltar
            </button>
          </div>
        </header>

        <div className="ra-registro__body ra-nova-cpf-page__body" onKeyDown={handleKeyDown}>
          <div className="ra-nova-cpf-page__card ra-nova-cpf">
            <h2 className="ra-nova-cpf-page__title">Informe o CPF do consumidor</h2>
            <p className="ra-nova-cpf-page__hint">
              Os dados do cliente serão carregados automaticamente e a demanda será criada ao avançar.
            </p>
            <div className="ra-nova-cpf__field">
              <label className="ra-nova-cpf__label" htmlFor="pcNovaCpfPageInput">
                CPF do consumidor
              </label>
              <input
                ref={cpfRef}
                id="pcNovaCpfPageInput"
                type="text"
                className="ra-nova-cpf__input"
                value={cpfInput}
                onChange={(event) => handleCpfChange(event.target.value)}
                placeholder="000.000.000-00"
                autoComplete="off"
                inputMode="numeric"
                maxLength={14}
                disabled={loading}
              />
            </div>
            <footer className="ra-nova-cpf-page__footer">
              <button
                type="button"
                className="btn-secondary ra-registro__btn"
                onClick={handleClose}
                disabled={loading}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-primary ra-registro__btn ra-nova-cpf__submit"
                onClick={handleAdvance}
                disabled={loading}
              >
                {loading ? 'Criando demanda…' : 'Avançar'}
              </button>
            </footer>
          </div>
        </div>
      </div>

      <RegisterClientModal
        open={registerOpen}
        cpf={pendingCpf}
        onClose={handleRegisterClose}
        onSaved={handleRegisterSaved}
      />
    </>
  );
}
