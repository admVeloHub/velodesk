/** VelohubPrimaryHeader v1.1.0 — mock ecossistema VeloHub (header principal) */
import { KeyboardEvent, MouseEvent, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useThemeMode } from '../contexts/ThemeModeContext';
import { useVelodeskModule } from '../contexts/VelodeskModuleContext';
import { useAuth } from '../contexts/AuthContext';
import {
  resolveVelohubModule,
  VELOHUB_MODULE_ROUTES,
  VelohubMockModule,
} from '../features/hub/velohubModules';

const LOGO_LIGHT = '/VeloHubLogo 2.png';
const LOGO_DARK = '/VeloHubLogo darktheme.png';
const DEFAULT_AVATAR =
  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIxNiIgY3k9IjE2IiByPSIxNiIgZmlsbD0iIzAwMzRGRiIvPjwvc3ZnPg==';

const MOCK_NAV: { id: VelohubMockModule; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'conhecimento', label: 'Conhecimento' },
  { id: 'apoio', label: 'Apoio' },
  { id: 'desk', label: 'Desk' },
  { id: 'velobot', label: 'VeloBot' },
];

export default function VelohubPrimaryHeader() {
  const { mode, toggleMode } = useThemeMode();
  const { activateDesk, deactivateDesk } = useVelodeskModule();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [logoError, setLogoError] = useState(false);
  const activeModule = resolveVelohubModule(location.pathname);

  const handleModuleClick = (moduleId: VelohubMockModule) => {
    if (moduleId === 'desk') {
      activateDesk();
      navigate(VELOHUB_MODULE_ROUTES.desk);
      return;
    }
    deactivateDesk();
    navigate(VELOHUB_MODULE_ROUTES[moduleId]);
  };

  const handleLogout = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    logout();
    navigate('/login');
  };

  const handleThemeKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleMode();
    }
  };

  const avatarSrc = user?.name
    ? `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=1634FF&color=fff&size=44&bold=true`
    : DEFAULT_AVATAR;

  return (
    <header className="velohub-header velohub-header--primary">
      <div className="header-container">
        <div className="velohub-logo" id="logo-container">
          {!logoError ? (
            <img
              id="logo-image"
              className="logo-image"
              src={mode === 'dark' ? LOGO_DARK : LOGO_LIGHT}
              alt="VeloHub Logo"
              onError={() => setLogoError(true)}
            />
          ) : (
            <span className="logo-fallback">VeloHub</span>
          )}
        </div>

        <nav className="nav-menu" aria-label="Navegação ecossistema VeloHub">
          {MOCK_NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`nav-link${activeModule === item.id ? ' active' : ''}`}
              onClick={() => handleModuleClick(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="user-section">
          <div className="user-info" title="Perfil VeloHub (mock)" role="presentation">
            <img
              id="user-avatar"
              className="user-avatar"
              src={avatarSrc}
              alt="Avatar"
              onError={(event) => {
                event.currentTarget.src = DEFAULT_AVATAR;
              }}
            />
            <span id="user-name" className="user-name">
              {user?.name}
            </span>
            <button id="logout-btn" className="logout-btn" type="button" title="Sair" onClick={handleLogout}>
              <i className="fas fa-sign-out-alt" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div
          className="theme-switch-wrapper"
          id="theme-toggle"
          role="button"
          tabIndex={0}
          title={mode === 'dark' ? 'Tema claro' : 'Tema escuro'}
          onClick={toggleMode}
          onKeyDown={handleThemeKeyDown}
        >
          <i className="bx bx-sun theme-icon" aria-hidden="true" />
          <i className="bx bx-moon theme-icon" aria-hidden="true" />
        </div>
      </div>
    </header>
  );
}
