/**
 * Aplica tema do canal Especiais no body (modais portaled) e retorna vars CSS.
 */
import { useEffect } from 'react';
import { getEspeciaisThemeVars } from '../config/especiaisTheme';

export function useEspeciaisChannelTheme(channelId) {
  const themeVars = getEspeciaisThemeVars(channelId);

  useEffect(() => {
    const vars = getEspeciaisThemeVars(channelId);
    const { body } = document;
    const prevChannel = body.dataset.especiaisChannel;
    body.dataset.especiaisChannel = channelId;

    const prevVars = {};
    Object.entries(vars).forEach(([key, value]) => {
      prevVars[key] = body.style.getPropertyValue(key);
      body.style.setProperty(key, value);
    });

    return () => {
      if (prevChannel) body.dataset.especiaisChannel = prevChannel;
      else delete body.dataset.especiaisChannel;

      Object.entries(prevVars).forEach(([key, value]) => {
        if (value) body.style.setProperty(key, value);
        else body.style.removeProperty(key);
      });
    };
  }, [channelId]);

  return themeVars;
}
