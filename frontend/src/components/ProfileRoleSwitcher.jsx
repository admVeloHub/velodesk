/**
 * Seletor de perfil operacional — Agente / Supervisor
 * VERSION: v1.2.0 | DATE: 2026-07-20 | AUTHOR: VeloHub Development Team
 * Em produção o componente não é montado pelos hosts (Header / Painel 360°).
 */
import React, { useState } from 'react';
import { PROFILES } from '../config/profiles';
import { useProfile } from '../context/ProfileContext';
import { usePermissionsOptional } from '../context/PermissionContext';

function ProfileRoleOptions({ profileId, onSelect, allowedPortals }) {
  const portalIds = Object.keys(PROFILES).filter((id) => allowedPortals.includes(id));

  return (
    <>
      <div className="eco-profile-dropdown-header">Visão do portal</div>
      {portalIds.map((id) => (
        <button
          key={id}
          type="button"
          className={'eco-profile-btn' + (profileId === id ? ' active' : '')}
          data-profile={id}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(id);
          }}
        >
          <i className={'fas ' + PROFILES[id].icon} aria-hidden="true" />
          {PROFILES[id].label}
        </button>
      ))}
    </>
  );
}

export default function ProfileRoleSwitcher({
  variant = 'badge',
  className = '',
  badgeId = 'profileRoleBadge',
  onSelect,
}) {
  const { profile, profileId, profileLocked, setProfile } = useProfile();
  const permsCtx = usePermissionsOptional();
  const allowedPortals = permsCtx?.portalVisivel || Object.keys(PROFILES);
  const [open, setOpen] = useState(false);

  const handleSelect = (id) => {
    if (profileLocked) return;
    setProfile(id);
    setOpen(false);
    onSelect?.(id);
  };

  if (profileLocked && variant === 'badge') {
    return (
      <div className={'header-profile-wrap' + (className ? ' ' + className : '')}>
        <span
          className="profile-role-badge profile-role-badge--locked"
          id={badgeId}
          style={{ background: 'linear-gradient(135deg, ' + profile.color + ', var(--eco-blue, #1634FF))' }}
        >
          <i className={'fas ' + profile.icon} aria-hidden="true" />
          <span>{profile.label}</span>
        </span>
      </div>
    );
  }

  if (variant === 'menu') {
    return (
      <div className={'profile-role-menu' + (className ? ' ' + className : '')}>
        <ProfileRoleOptions profileId={profileId} onSelect={handleSelect} allowedPortals={allowedPortals} />
      </div>
    );
  }

  return (
    <>
      <div className={'header-profile-wrap' + (className ? ' ' + className : '')}>
        <button
          type="button"
          className="profile-role-badge"
          id={badgeId}
          onClick={() => setOpen((v) => !v)}
          style={{ background: 'linear-gradient(135deg, ' + profile.color + ', var(--eco-blue, #1634FF))' }}
          aria-expanded={open}
          aria-haspopup="true"
        >
          <i className={'fas ' + profile.icon} aria-hidden="true" />
          <span>{profile.label}</span>
          <i className="fas fa-chevron-down eco-badge-chevron" aria-hidden="true" />
        </button>
        {open ? (
          <div className="eco-profile-dropdown open" id={badgeId + 'Dropdown'}>
            <ProfileRoleOptions profileId={profileId} onSelect={handleSelect} allowedPortals={allowedPortals} />
          </div>
        ) : null}
      </div>
      {open ? (
        <button
          type="button"
          className="eco-dropdown-backdrop"
          onClick={() => setOpen(false)}
          aria-label="Fechar menu de perfil"
        />
      ) : null}
    </>
  );
}
