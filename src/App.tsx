import { useEffect, useState } from 'react';
import { Loader2, ServerCog } from 'lucide-react';
import { RoleProvider, useRole } from './context/RoleContext';
import { AppProvider, useApp } from './context/AppContext';
import { isDemoMode, isSupabaseConfigured } from './storage';
import { RoleSelectScreen } from './components/RoleSelectScreen';
import { Header, MobileBottomNav } from './components/Navigation';
import { HomeScreen } from './components/HomeScreen';
import { OrderForm } from './components/OrderForm';
import { ResultsScreen } from './components/ResultsScreen';
import { SavedOrdersScreen } from './components/SavedOrdersScreen';
import { SettingsScreen } from './components/SettingsScreen';
import { ToastContainer } from './components/ToastContainer';
import { Spinner } from './components/ui';

function parseHash(): string {
  const h = window.location.hash.replace(/^#\/?/, '');
  return ['home', 'neworder', 'orders', 'settings', 'results'].includes(h) ? h : 'home';
}

function Root() {
  const { role } = useRole();
  const { view, navigate, editingOrderId, viewOrderId, ready, dataError } = useApp();

  // Initial route from hash.
  useEffect(() => {
    navigate(parseHash() as any);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync view to hash.
  useEffect(() => {
    const target = view === 'home' ? '' : `/${view}`;
    const expected = `#${target}`;
    if (window.location.hash !== expected) {
      try {
        window.history.replaceState(null, '', `${window.location.pathname}${expected}`);
      } catch {
        /* ignore */
      }
    }
  }, [view]);

  if (!role) {
    return <RoleSelectScreen />;
  }

  let content: React.ReactNode;
  if (!ready) {
    content = dataError ? (
      <div className="rounded-2xl bg-red-50 border border-red-200 text-red-600 px-5 py-4 text-sm">{dataError}</div>
    ) : (
      <Spinner label="Loading configuration…" />
    );
  } else if (view === 'home') {
    content = <HomeScreen />;
  } else if (view === 'neworder') {
    content = <OrderForm />;
  } else if (view === 'results') {
    content = viewOrderId ? <ResultsScreen mode="snapshot" /> : <ResultsScreen mode="compute" />;
  } else if (view === 'orders') {
    content = <SavedOrdersScreen />;
  } else if (view === 'settings') {
    content = <SettingsScreen />;
  } else {
    content = <HomeScreen />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-teal-50 text-charcoal">
      <Header />
      {isDemoMode() && (
        <div className="fixed top-16 inset-x-0 z-30 bg-amber-400 text-slate-900 text-center text-[12px] font-bold py-1.5 px-3">
          DEMO MODE — data stays on this device. Configure Supabase for production persistence.
        </div>
      )}
      <main className={`max-w-7xl mx-auto px-4 py-6 ${isDemoMode() ? 'pt-20' : ''} pb-32 md:pb-12`}>
        {content}
      </main>
      <MobileBottomNav />
      <ToastContainer />
    </div>
  );
}

function UnconfiguredScreen() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 p-4">
      <div className="max-w-md w-full rounded-3xl bg-white border border-slate-200 shadow-xl p-8 text-center">
        <ServerCog className="w-10 h-10 text-slate-300 mx-auto mb-4" />
        <h1 className="text-lg font-extrabold text-slate-800">Supabase is not configured</h1>
        <p className="text-sm text-slate-500 mt-2 leading-relaxed">
          This build requires a Supabase project. Set <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">VITE_SUPABASE_URL</code> and{' '}
          <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">VITE_SUPABASE_ANON_KEY</code> in <code className="bg-slate-100 px-1.5 py-0.5 rounded text-xs">.env</code>, apply the migration, and run the setup script — see README.md.
        </p>
      </div>
    </div>
  );
}

export default function App() {
  if (!isSupabaseConfigured() && !import.meta.env.DEV) {
    return <UnconfiguredScreen />;
  }
  return (
    <RoleProvider>
      <AppProvider>
        <Root />
      </AppProvider>
    </RoleProvider>
  );
}
