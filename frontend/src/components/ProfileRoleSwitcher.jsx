/**
 * Seletor de perfil operacional — Agente / Supervisor
 * VERSION: v1.0.0 | DATE: 2026-06-19
 */
import React, { useState } from 'react';
import { PROFILES } from '../config/profiles';
import { useProfile } from '../context/ProfileContext';

function ProfileRoleOptions({ profileId, onSelect }) {
  return (
    <>
      <div className="eco-profile-dropdown-header">Visão do portal</div>
      {Object.keys(PROFILES).map((id) => (
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
  const { profile, profileId, setProfile } = useProfile();
  const [open, setOpen] = useState(false);

  const handleSelect = (id) => {
    setProfile(id);
    setOpen(false);
    onSelect?.(id);
  };

  if (variant === 'menu') {
    return (
      <div className={'profile-role-menu' + (className ? ' ' + className : '')}>
        <ProfileRoleOptions profileId={profileId} onSelect={handleSelect} />
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
            <ProfileRoleOptions profileId={profileId} onSelect={handleSelect} />
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
