/**
 * Seletor de perfil operacional — Agente / Gestão / Workflow / Especiais
 * VERSION: v1.3.0 | DATE: 2026-07-22
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { PROFILES } from '../config/profiles';
import { useProfile } from '../context/ProfileContext';
import { usePermissionsOptional } from '../context/PermissionContext';
import { getAllowedProfilePortals, readCachedPermissions } from '../services/permissions/permissionService';

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
  const badgeRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState(null);

  const allowedPortals = useMemo(() => {
    if (permsCtx?.portalVisivel?.length) {
      return permsCtx.portalVisivel;
    }
    const perm = permsCtx?.permissions ?? readCachedPermissions();
    return getAllowedProfilePortals(perm);
  }, [permsCtx?.permissions, permsCtx?.portalVisivel, permsCtx?.loading]);

  useEffect(() => {
    if (!open || !permsCtx?.reload) return undefined;
    if (allowedPortals.length >= Object.keys(PROFILES).length) return undefined;

    const perm = permsCtx?.permissions ?? readCachedPermissions();
    const shouldHaveFour = perm?.funcaoSlug === 'gestao'
      || (perm?.funcoes || []).includes('gestao')
      || (perm?.portalVisivel || []).includes('gestao')
      || perm?.permissoes?.portal?.gestao === true;

    if (!shouldHaveFour) return undefined;

    void permsCtx.reload().catch(() => {});
    return undefined;
  }, [open, allowedPortals.length, permsCtx]);

  const updateMenuPosition = useCallback(() => {
    const el = badgeRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setMenuStyle({
      position: 'fixed',
      top: rect.bottom + 10,
      left: rect.left,
      minWidth: Math.max(rect.width, 220),
      zIndex: 10050,
    });
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    updateMenuPosition();
    const onReflow = () => updateMenuPosition();
    window.addEventListener('resize', onReflow);
    window.addEventListener('scroll', onReflow, true);
    return () => {
      window.removeEventListener('resize', onReflow);
      window.removeEventListener('scroll', onReflow, true);
    };
  }, [open, updateMenuPosition]);

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

  const dropdown = open && menuStyle ? createPortal(
    <div
      className="eco-profile-dropdown open eco-profile-dropdown--portal"
      id={badgeId + 'Dropdown'}
      style={menuStyle}
      role="menu"
    >
      <ProfileRoleOptions profileId={profileId} onSelect={handleSelect} allowedPortals={allowedPortals} />
    </div>,
    document.body,
  ) : null;

  return (
    <>
      <div className={'header-profile-wrap' + (className ? ' ' + className : '')}>
        <button
          ref={badgeRef}
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
      </div>
      {dropdown}
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
