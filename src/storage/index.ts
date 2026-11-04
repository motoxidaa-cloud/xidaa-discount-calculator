/**
 * Storage entry point. Uses Supabase when configured; otherwise (development
 * only) falls back to the clearly-labelled DemoAdapter. In production builds
 * without Supabase configuration the app refuses to run in demo mode — it
 * shows a configuration-required screen instead.
 */
import { SUPABASE_CONFIGURED } from '../lib/supabase';
import { DemoAdapter } from './demoAdapter';
import { SupabaseAdapter } from './supabaseAdapter';
import type { DataAdapter } from './types';

export const IS_DEMO_ENABLED =
  !SUPABASE_CONFIGURED && import.meta.env.DEV;

let adapter: DataAdapter | null = null;

export function getDataAdapter(): DataAdapter {
  if (!adapter) {
    if (SUPABASE_CONFIGURED) {
      adapter = new SupabaseAdapter();
    } else if (IS_DEMO_ENABLED) {
      adapter = new DemoAdapter();
    } else {
      throw new Error('Supabase is not configured. See .env and README.md.');
    }
  }
  return adapter;
}

export function isDemoMode(): boolean {
  return IS_DEMO_ENABLED;
}

export function isSupabaseConfigured(): boolean {
  return SUPABASE_CONFIGURED;
}
