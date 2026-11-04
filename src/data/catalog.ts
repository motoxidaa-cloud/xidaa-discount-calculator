/**
 * Official Xidaa catalogue data.
 *
 * The model list combines the 13 core models with every additional distinct
 * vehicle found while inspecting the supplied Xidaa catalogues ("XIDAA
 * UPDATED PRICE LIST 31 JANUARY.pdf" and "XIDAA BROUCHERS.pdf").
 *
 * Per product requirements, NO model is pre-assigned to the DL category —
 * every model starts as Other and an administrator maps DL models in Settings.
 * Approved prices and costs are intentionally empty (null): profitability is
 * therefore "Not Verified" until an administrator configures them.
 */
import type { BatteryRecord, ModelRecord } from '../types';

interface SeedModel {
  id: string;
  name: string;
}

export const CATALOGUE_MODELS_SEED: SeedModel[] = [
  // --- Core catalogue (13 required models) ---
  { id: 'x-single-light', name: 'X-Single Light' },
  { id: 'x-double-light', name: 'X-Double Light' },
  { id: 'x-torvo', name: 'X-Torvo' },
  { id: 'x-e4', name: 'X-E4' },
  { id: 'x-fh-big-activa', name: 'X-FH (Big Activa)' },
  { id: 'x-ozone', name: 'X-Ozone' },
  { id: 'x-cs3', name: 'X-CS3' },
  { id: 'x-orl-cheetah', name: 'X-ORL Cheetah' },
  { id: 'x-robox', name: 'X-Robox' },
  { id: 'x-ambretta', name: 'X-Ambretta' },
  { id: 'x-tank', name: 'X-Tank' },
  { id: 'x-yokozuna', name: 'X-Yokozuna' },
  { id: 'x-boston', name: 'X-Boston' },
  // --- Additional distinct models verified in the supplied catalogue ---
  { id: 'x-pro', name: 'X-Pro' },
  { id: 'x-act', name: 'X-Act' },
  { id: 'x-oki', name: 'X-Oki' },
  { id: 'x-b-act', name: 'X-B.Act' },
  { id: 'x-goddess', name: 'X-Goddess' },
  { id: 'x-beta', name: 'X-Beta' },
  { id: 'x-load-master', name: 'X-Load Master' },
  { id: 'x-3-wheel-load-master', name: 'X-3 Wheel Load Master' },
  { id: 'x-3-wheeler-handicapped', name: 'X-3 Wheeler (Handicapped)' },
  { id: 'x-l5', name: 'X-L5 (Export)' },
];

export function buildSeedModels(): ModelRecord[] {
  return CATALOGUE_MODELS_SEED.map((m, i) => ({
    id: m.id,
    name: m.name,
    category: 'Other',
    approvedPricePaise: null,
    costPaise: null,
    active: true,
    sortOrder: i,
  }));
}

export const BATTERY_VARIANTS_SEED: BatteryRecord[] = [
  {
    id: 'battery-60-30-lfp',
    name: '60V / 30Ah LFP',
    capacityAh: 30,
    tech: 'LFP',
    approvedPricePaise: null,
    costPaise: null,
    active: true,
  },
  {
    id: 'battery-60-45-lfp',
    name: '60V / 45Ah LFP',
    capacityAh: 45,
    tech: 'LFP',
    approvedPricePaise: null,
    costPaise: null,
    active: true,
  },
  {
    id: 'battery-60-55-pouch',
    name: '60V / 55Ah Pouch Cell',
    capacityAh: 55,
    tech: 'Pouch Cell',
    approvedPricePaise: null,
    costPaise: null,
    active: true,
  },
];
