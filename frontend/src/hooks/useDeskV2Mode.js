/**
 * Hook modo desk v2 (?desk=v2)
 * VERSION: v1.0.1 | DATE: 2026-07-22
 */
import { useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

export function useDeskV2Mode() {
  const [searchParams] = useSearchParams();
  const isDeskV2 = useMemo(() => searchParams.get('desk') === 'v2', [searchParams]);

  useEffect(() => {
    if (isDeskV2) {
      document.body.classList.add('desk-v2-mode');
    } else {
      document.body.classList.remove('desk-v2-mode');
    }
    document.title = 'Velodesk';
    return () => document.body.classList.remove('desk-v2-mode');
  }, [isDeskV2]);

  return isDeskV2;
}
