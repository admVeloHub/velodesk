/** VelodeskSecondaryHeader v1.0.0 — header secundário do módulo Desk */
import { useState } from 'react';
import { Menu, MenuItem } from '@mui/material';
import { useLocation, useNavigate } from 'react-router-dom';
import { useProfile } from '../contexts/ProfileContext';
import { NAV_ITEMS, PROFILES, VelodeskProfile } from '../types';

function isNavActive(path: string, currentPath: string) {
  if (path === '/workspace') return currentPath === '/' || currentPath === '/workspace';
  return currentPath === path || currentPath.startsWith(`${path}/`);
}

export default function VelodeskSecondaryHeader({ onOpenAi }: { onOpenAi?: () => void }) {
  const { profile, setProfile, allowedNav } = useProfile();
  const navigate = useNavigate();
  const location = useLocation();
  const [profileAnchor, setProfileAnchor] = useState<null | HTMLElement>(null);

  const navItems = allowedNav.map((key) => ({ key, ...NAV_ITEMS[key] }));

  return (
    <>
      <header className="velohub-header velodesk-header">
        <div className="header-container">
          <div className="velodesk-module-badge" aria-label="Módulo Velodesk">
            Velodesk
          </div>

          <nav className="nav-menu" aria-label="Navegação Velodesk">
            {navItems.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`nav-link${isNavActive(item.path, location.pathname) ? ' active' : ''}`}
                onClick={() => navigate(item.path)}
              >
                {item.label}
              </button>
            ))}
            <button
              type="button"
              className="nav-link"
              onClick={(event) => setProfileAnchor(event.currentTarget)}
              title="Trocar perfil"
            >
              {PROFILES[profile].label}
            </button>
            {onOpenAi && (
              <button type="button" className="nav-link" onClick={onOpenAi} title="Assistente IA">
                IA
              </button>
            )}
          </nav>
        </div>
      </header>

      <Menu anchorEl={profileAnchor} open={!!profileAnchor} onClose={() => setProfileAnchor(null)}>
        {(Object.keys(PROFILES) as VelodeskProfile[]).map((p) => (
          <MenuItem
            key={p}
            selected={p === profile}
            onClick={() => {
              setProfile(p);
              setProfileAnchor(null);
              navigate(`/${PROFILES[p].defaultPage}`);
            }}
          >
            {PROFILES[p].label}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
