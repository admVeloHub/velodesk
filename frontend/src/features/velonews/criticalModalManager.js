/**
 * criticalModalManager v1.0.0 — estado local do modal crítico (chaves VeloHub)
 * VERSION: v1.0.0 | DATE: 2026-06-30 | AUTHOR: VeloHub Development Team
 */

export const CriticalModalManager = {
  ACKNOWLEDGED_KEY: 'velohub-critical-acknowledged',
  REMIND_LATER_KEY: 'velohub-remind-later',
  SHOW_REMIND_BUTTON_KEY: 'velohub-show-remind-button',
  LAST_CRITICAL_KEY: 'velohub-last-critical-news',

  isAcknowledged(newsTitle = null) {
    if (newsTitle) {
      return localStorage.getItem(CriticalModalManager.ACKNOWLEDGED_KEY) === newsTitle;
    }
    return localStorage.getItem(CriticalModalManager.ACKNOWLEDGED_KEY) === 'true';
  },

  setAcknowledged(newsTitle = null) {
    if (newsTitle) {
      localStorage.setItem(CriticalModalManager.ACKNOWLEDGED_KEY, newsTitle);
    } else {
      localStorage.setItem(CriticalModalManager.ACKNOWLEDGED_KEY, 'true');
    }
  },

  shouldRemindLater() {
    const remindLater = localStorage.getItem(CriticalModalManager.REMIND_LATER_KEY);
    if (!remindLater) return false;
    return Date.now() >= parseInt(remindLater, 10);
  },

  setRemindLater() {
    const threeMinutesFromNow = Date.now() + 3 * 60 * 1000;
    localStorage.setItem(CriticalModalManager.REMIND_LATER_KEY, String(threeMinutesFromNow));
    localStorage.setItem(CriticalModalManager.SHOW_REMIND_BUTTON_KEY, 'false');
  },

  clearRemindLater() {
    localStorage.removeItem(CriticalModalManager.REMIND_LATER_KEY);
  },

  shouldShowRemindButton() {
    return localStorage.getItem(CriticalModalManager.SHOW_REMIND_BUTTON_KEY) !== 'false';
  },

  shouldShowModal(criticalNews) {
    if (!criticalNews) return false;
    if (CriticalModalManager.isAcknowledged(criticalNews.title)) return false;
    if (CriticalModalManager.shouldRemindLater()) {
      CriticalModalManager.clearRemindLater();
      return true;
    }
    return true;
  },

  getLastCriticalNews() {
    return localStorage.getItem(CriticalModalManager.LAST_CRITICAL_KEY);
  },

  setLastCriticalNews(criticalKey) {
    localStorage.setItem(CriticalModalManager.LAST_CRITICAL_KEY, criticalKey);
  },

  isNewCriticalNews(criticalKey) {
    return CriticalModalManager.getLastCriticalNews() !== criticalKey;
  },

  resetForNewCriticalNews() {
    localStorage.removeItem(CriticalModalManager.ACKNOWLEDGED_KEY);
    localStorage.removeItem(CriticalModalManager.REMIND_LATER_KEY);
    localStorage.setItem(CriticalModalManager.SHOW_REMIND_BUTTON_KEY, 'true');
  },

  getCriticalKey(news) {
    if (!news) return '';
    return `${news._id}-${news.title}`;
  },
};
