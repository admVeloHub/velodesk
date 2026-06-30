/**
 * VeloNewsProvider v1.0.1 — feed VeloHub + polling 3 min
 * VERSION: v1.0.1 | DATE: 2026-06-30 | AUTHOR: VeloHub Development Team
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  acknowledgeNews,
  fetchAcknowledgments,
  fetchVeloNews,
} from '../../api/veloNewsApi';
import { useAuth } from '../../context/AuthContext';
import { CriticalModalManager } from './criticalModalManager';
import {
  computeUnreadCount,
  findPendingCritical,
  sortVeloNewsDesc,
} from './veloNewsHelpers';

const POLL_MS = 3 * 60 * 1000;
const RECENT_LIMIT = 6;

const VeloNewsContext = createContext(null);

export function VeloNewsProvider({ children }) {
  const { user, authStatus } = useAuth();
  const userEmail = user?.email || '';
  const userName = user?.name || user?.email || 'Usuário';

  const [veloNews, setVeloNews] = useState([]);
  const [acknowledgedNewsIds, setAcknowledgedNewsIds] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingCriticalNews, setPendingCriticalNews] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [popoverOpen, setPopoverOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [criticalModalNews, setCriticalModalNews] = useState(null);
  const [readModalNews, setReadModalNews] = useState(null);
  const [criticalBubbleVisible, setCriticalBubbleVisible] = useState(false);

  const bellAnchorRef = useRef(null);
  const remindTimerRef = useRef(null);

  const applyCriticalState = useCallback((critical) => {
    if (!critical) {
      setPendingCriticalNews(null);
      setCriticalBubbleVisible(false);
      return;
    }

    const criticalKey = CriticalModalManager.getCriticalKey(critical);
    if (CriticalModalManager.isNewCriticalNews(criticalKey)) {
      CriticalModalManager.resetForNewCriticalNews();
      CriticalModalManager.setLastCriticalNews(criticalKey);
    }

    setPendingCriticalNews(critical);

    if (CriticalModalManager.shouldShowModal(critical)) {
      setCriticalBubbleVisible(true);
    }
  }, []);

  const refreshFeed = useCallback(async () => {
    if (!userEmail || authStatus !== 'authorized') return;

    setError('');
    try {
      const [news, ackIds] = await Promise.all([
        fetchVeloNews(RECENT_LIMIT),
        fetchAcknowledgments(userEmail),
      ]);

      const sorted = sortVeloNewsDesc(news);
      setVeloNews(sorted);
      setAcknowledgedNewsIds(ackIds);
      setUnreadCount(computeUnreadCount(sorted, ackIds));

      const critical = findPendingCritical(sorted, ackIds);
      applyCriticalState(critical);
    } catch (err) {
      setError(err?.message || 'Não foi possível carregar o VeloNews.');
      setVeloNews([]);
      setUnreadCount(0);
      setPendingCriticalNews(null);
      setCriticalBubbleVisible(false);
    } finally {
      setLoading(false);
    }
  }, [userEmail, authStatus, applyCriticalState]);

  useEffect(() => {
    if (authStatus !== 'authorized' || !userEmail) return undefined;

    setLoading(true);
    refreshFeed();
    const intervalId = setInterval(refreshFeed, POLL_MS);
    return () => clearInterval(intervalId);
  }, [authStatus, userEmail, refreshFeed]);

  useEffect(() => {
    if (!pendingCriticalNews || criticalModalNews) return undefined;

    const tick = () => {
      if (
        pendingCriticalNews
        && CriticalModalManager.shouldRemindLater()
        && CriticalModalManager.shouldShowModal(pendingCriticalNews)
      ) {
        CriticalModalManager.clearRemindLater();
        setCriticalBubbleVisible(true);
      }
    };

    remindTimerRef.current = setInterval(tick, 15000);
    return () => {
      if (remindTimerRef.current) clearInterval(remindTimerRef.current);
    };
  }, [pendingCriticalNews, criticalModalNews]);

  const togglePopover = useCallback(() => {
    setPopoverOpen((v) => !v);
  }, []);

  const closePopover = useCallback(() => {
    setPopoverOpen(false);
  }, []);

  const openHistoryModal = useCallback(() => {
    setPopoverOpen(false);
    setHistoryOpen(true);
  }, []);

  const closeHistoryModal = useCallback(() => {
    setHistoryOpen(false);
  }, []);

  const openCriticalModal = useCallback((news) => {
    if (!news) return;
    setCriticalBubbleVisible(false);
    setCriticalModalNews(news);
    setPopoverOpen(false);
  }, []);

  const closeCriticalModal = useCallback(() => {
    setCriticalModalNews(null);
    if (pendingCriticalNews && !acknowledgedNewsIds.includes(String(pendingCriticalNews._id))) {
      setCriticalBubbleVisible(true);
    }
  }, [pendingCriticalNews, acknowledgedNewsIds]);

  const openReadModal = useCallback((news) => {
    setReadModalNews(news);
    setPopoverOpen(false);
  }, []);

  const closeReadModal = useCallback(() => {
    setReadModalNews(null);
  }, []);

  const handleOpenNewsItem = useCallback((news) => {
    const isCritical = news.is_critical === 'Y';
    const isAcknowledged = acknowledgedNewsIds.some((id) => String(id) === String(news._id));
    if (isCritical && !isAcknowledged && !news.solved) {
      openCriticalModal(news);
    } else {
      openReadModal(news);
    }
  }, [acknowledgedNewsIds, openCriticalModal, openReadModal]);

  const handleAcknowledge = useCallback(async (newsId) => {
    if (!userEmail || !newsId) return false;
    try {
      await acknowledgeNews(newsId, userEmail, userName);
      const id = String(newsId);
      setAcknowledgedNewsIds((prev) => {
        if (prev.some((item) => String(item) === id)) return prev;
        const next = [...prev, id];
        setUnreadCount(computeUnreadCount(veloNews, next));
        const nextCritical = findPendingCritical(veloNews, next);
        setPendingCriticalNews(nextCritical);
        setCriticalBubbleVisible(Boolean(nextCritical));
        return next;
      });
      return true;
    } catch (err) {
      console.error('Erro ao confirmar VeloNews:', err);
      return false;
    }
  }, [userEmail, userName, veloNews]);

  const value = useMemo(() => ({
    veloNews,
    acknowledgedNewsIds,
    unreadCount,
    pendingCriticalNews,
    loading,
    error,
    popoverOpen,
    historyOpen,
    criticalModalNews,
    readModalNews,
    criticalBubbleVisible,
    bellAnchorRef,
    togglePopover,
    closePopover,
    openHistoryModal,
    closeHistoryModal,
    openCriticalModal,
    closeCriticalModal,
    openReadModal,
    closeReadModal,
    handleOpenNewsItem,
    handleAcknowledge,
    refreshFeed,
    userEmail,
    userName,
  }), [
    veloNews,
    acknowledgedNewsIds,
    unreadCount,
    pendingCriticalNews,
    loading,
    error,
    popoverOpen,
    historyOpen,
    criticalModalNews,
    readModalNews,
    criticalBubbleVisible,
    togglePopover,
    closePopover,
    openHistoryModal,
    closeHistoryModal,
    openCriticalModal,
    closeCriticalModal,
    openReadModal,
    closeReadModal,
    handleOpenNewsItem,
    handleAcknowledge,
    refreshFeed,
    userEmail,
    userName,
  ]);

  return (
    <VeloNewsContext.Provider value={value}>
      {children}
    </VeloNewsContext.Provider>
  );
}

export function useVeloNews() {
  const ctx = useContext(VeloNewsContext);
  if (!ctx) throw new Error('useVeloNews requires VeloNewsProvider');
  return ctx;
}
