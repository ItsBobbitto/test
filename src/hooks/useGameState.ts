import { useState, useEffect, useCallback } from 'react';

export type EventTier = 'LOW' | 'MID' | 'HIGH';

export interface EventRecord {
  id: string;
  name: string;
  tier: EventTier;
  timestamp: number;
  message?: string;
}

export interface UpgradeDef {
  id: string;
  name: string;
  baseCost: number;
  cpsPerUnit: number;
  iconName: string;
  color: string;
}

export interface RewardEvent {
  username: string;
  amount?: number;
  eventType: string;
  timestamp: number;
}

export interface GameState {
  cookies: number;
  totalClicks: number;
  upgradeCounts: Record<string, number>;
  upgradesUnlocked: boolean;
  multiplier: number;
  permanentCpsBonus: number;
  permanentMultiplierBoost: number;
  cpsBoostMultiplier: number;
  displayCps: number;
  activeEvent: {
    id: string;
    name: string;
    endTime: number;
    type: string;
    metadata?: Record<string, number>;
  } | null;
  eventFeed: EventRecord[];
  comboCount: number;
  clickValue: number;
  lastReward: RewardEvent | null;
  upgrades?: UpgradeDef[];
}

export const UPGRADES: UpgradeDef[] = [
  { id: 'grandma', name: 'Grandma', baseCost: 100, cpsPerUnit: 0.5, iconName: 'Heart', color: '#ec4899' },
  { id: 'farm', name: 'Farm', baseCost: 500, cpsPerUnit: 2, iconName: 'Leaf', color: '#22c55e' },
  { id: 'factory', name: 'Factory', baseCost: 2000, cpsPerUnit: 10, iconName: 'Cog', color: '#f97316' },
  { id: 'lab', name: 'Lab', baseCost: 10000, cpsPerUnit: 50, iconName: 'Zap', color: '#06b6d4' },
  { id: 'portal', name: 'Portal', baseCost: 50000, cpsPerUnit: 200, iconName: 'Globe', color: '#a855f7' },
  { id: 'timemachine', name: 'Time Machine', baseCost: 200000, cpsPerUnit: 750, iconName: 'Clock', color: '#eab308' },
];

const EMPTY_STATE: GameState = {
  cookies: 0,
  totalClicks: 0,
  upgradeCounts: {},
  upgradesUnlocked: false,
  multiplier: 1,
  permanentCpsBonus: 0,
  permanentMultiplierBoost: 0,
  cpsBoostMultiplier: 1,
  displayCps: 0,
  activeEvent: null,
  eventFeed: [],
  comboCount: 0,
  clickValue: 1,
  lastReward: null,
  upgrades: UPGRADES,
};

const OFFLINE_EVENT: EventRecord = {
  id: 'api-offline',
  name: 'API offline',
  tier: 'HIGH',
  timestamp: Date.now(),
  message: 'Global clicks require the API server.',
};

export function getUpgradeCost(def: UpgradeDef, owned: number): number {
  return Math.floor(def.baseCost * Math.pow(1.15, owned));
}

function displayCpsFor(state: GameState): number {
  const upgrades = state.upgrades ?? UPGRADES;
  const base = upgrades.reduce((total, upgrade) => total + (state.upgradeCounts[upgrade.id] || 0) * upgrade.cpsPerUnit, 0);
  return base * (1 + state.permanentCpsBonus) * state.cpsBoostMultiplier;
}

function withDefaults(state: GameState): GameState {
  const merged = { ...EMPTY_STATE, ...state, upgrades: state.upgrades ?? UPGRADES };
  return { ...merged, displayCps: merged.displayCps || displayCpsFor(merged) };
}

function offlineState(): GameState {
  return { ...EMPTY_STATE, eventFeed: [OFFLINE_EVENT] };
}

async function postJson(path: string, payload?: object): Promise<GameState | null> {
  try {
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload ? JSON.stringify(payload) : undefined,
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data.state ? withDefaults(data.state) : null;
  } catch {
    return null;
  }
}

export function useGameState() {
  const [state, setState] = useState<GameState>(EMPTY_STATE);

  useEffect(() => {
    const source = new EventSource(`${window.location.origin}/api/stream/events`);

    source.onmessage = (message) => {
      try {
        const data = JSON.parse(message.data);
        if (data.type === 'STATE' && data.state) {
          setState(withDefaults(data.state));
        }
      } catch {
        // Ignore malformed stream messages.
      }
    };

    source.onerror = () => {
      setState(offlineState());
    };

    return () => source.close();
  }, []);

  const handleClick = useCallback(async () => {
    const next = await postJson('/api/stream/click');
    if (next) {
      setState(next);
    } else {
      setState(offlineState());
    }
  }, []);

  const triggerEvent = useCallback(async (type: string, actor = 'Viewer') => {
    const next = await postJson('/api/stream/event', {
      type,
      username: actor,
      source: 'game-simulator',
    });

    if (next) {
      setState(next);
    } else {
      setState(offlineState());
    }
  }, []);

  const buyUpgrade = useCallback(() => {
    // Upgrades auto-claim on the API server after Cookie Core unlock.
  }, []);

  return { state, handleClick, triggerEvent, buyUpgrade, displayCps: state.displayCps };
}
