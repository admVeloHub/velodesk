/**
 * useBacenNovaDemandaCpf — lookup CPF + criação automática de demanda/ticket Bacen
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { createDemandaFromCliente, createDemandaFromCpf } from '../services/especiais/bacenTicketService';
import { isValidCpfDigits, maskCpfInput, normalizeCpf } from '../services/desk/utils';
import { useNotifications } from '../context/NotificationContext';

export function useBacenNovaDemandaCpf({ onSuccess, onClose } = {}) {
  const { showNotification } = useNotifications();
  const cpfRef = useRef(null);
  const [cpfInput, setCpfInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [pendingCpf, setPendingCpf] = useState('');

  useEffect(() => {
    cpfRef.current?.focus();
  }, []);

  const finishWithCliente = useCallback(async (clienteDoc) => {
    setLoading(true);
    try {
      const result = await createDemandaFromCliente(clienteDoc);
      showNotification('Demanda registrada e ticket criado.', 'success');
      onSuccess?.(result.id);
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Não foi possível criar a demanda.';
      showNotification(msg, 'error');
    } finally {
      setLoading(false);
    }
  }, [onSuccess, showNotification]);

  const handleAdvance = useCallback(async () => {
    const cpf = normalizeCpf(cpfInput);
    if (!isValidCpfDigits(cpf)) {
      showNotification('Informe um CPF completo (11 dígitos).', 'error');
      cpfRef.current?.focus();
      return;
    }
    setLoading(true);
    try {
      const result = await createDemandaFromCpf(cpf);
      showNotification('Demanda registrada e ticket criado.', 'success');
      onSuccess?.(result.id);
    } catch (err) {
      if (err?.response?.status === 404) {
        setPendingCpf(cpf);
        setRegisterOpen(true);
        return;
      }
      const msg = err?.response?.data?.message || err?.message || 'Não foi possível consultar o CPF.';
      showNotification(msg, 'error');
    } finally {
      setLoading(false);
    }
  }, [cpfInput, onSuccess, showNotification]);

  const handleRegisterSaved = useCallback(async (clienteDoc) => {
    setRegisterOpen(false);
    await finishWithCliente(clienteDoc);
  }, [finishWithCliente]);

  const handleRegisterClose = useCallback(() => {
    setRegisterOpen(false);
  }, []);

  const handleCpfChange = useCallback((value) => {
    setCpfInput(maskCpfInput(value));
  }, []);

  const handleKeyDown = useCallback((event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleAdvance();
    }
    if (event.key === 'Escape' && !registerOpen) {
      event.preventDefault();
      onClose?.();
    }
  }, [handleAdvance, onClose, registerOpen]);

  return {
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
  };
}
