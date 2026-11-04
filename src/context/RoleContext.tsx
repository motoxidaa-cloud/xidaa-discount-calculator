import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import type { Role } from '../types';

const ROLE_KEY = 'xidaa.role.v1';

interface RoleContextValue {
  role: Role | null;
  setRole: (r: Role) => void;
  clearRole: () => void;
}

const RoleContext = createContext<RoleContextValue | null>(null);

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<Role | null>(() => {
    try {
      const v = localStorage.getItem(ROLE_KEY);
      return v === 'admin' || v === 'sales' ? v : null;
    } catch {
      return null;
    }
  });

  const setRole = useCallback((r: Role) => {
    setRoleState(r);
    try {
      localStorage.setItem(ROLE_KEY, r);
    } catch {
      /* ignore */
    }
  }, []);

  const clearRole = useCallback(() => {
    setRoleState(null);
    try {
      localStorage.removeItem(ROLE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  return <RoleContext.Provider value={{ role, setRole, clearRole }}>{children}</RoleContext.Provider>;
}

export function useRole(): RoleContextValue {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error('useRole must be used within RoleProvider');
  return ctx;
}

export function roleLabel(role: Role | null): string {
  return role === 'admin' ? 'Administrator' : role === 'sales' ? 'Sales Executive' : '';
}
