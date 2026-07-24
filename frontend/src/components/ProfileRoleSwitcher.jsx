/**
 * ProfileRoleSwitcher v1.4.0 — indicador read-only da visão (RBAC)
 * VERSION: v1.4.0 | DATE: 2026-07-23
 */
import React from 'react';
import { useProfile } from '../context/ProfileContext';

export default function ProfileRoleSwitcher({
  variant = 'badge',
  className = '',
  badgeId = 'profileRoleBadge',
}) {
  const { profile } = useProfile();

  if (variant === 'menu') {
    return (
      <div className={'profile-role-menu profile-role-menu--locked' + (className ? ' ' + className : '')}>
        <span className="profile-role-badge profile-role-badge--locked profile-role-badge--inline">
          <i className={'fas ' + profile.icon} aria-hidden="true" />
          {profile.label}
        </span>
        <p className="profile-role-menu__hint">Definida pela sua função no login.</p>
      </div>
    );
  }

  return (
    <div className={'header-profile-wrap' + (className ? ' ' + className : '')}>
      <span
        className="profile-role-badge profile-role-badge--locked"
        id={badgeId}
        style={{ background: 'linear-gradient(135deg, ' + profile.color + ', var(--eco-blue, #1634FF))' }}
        title="Visão definida pela sua função"
      >
        <i className={'fas ' + profile.icon} aria-hidden="true" />
        <span>{profile.label}</span>
      </span>
    </div>
  );
}
