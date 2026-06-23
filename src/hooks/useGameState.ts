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

export function getUpgradeCost(def: UpgradeDef, owned: number): number {
  return Math.floor(def.baseCost * Math.pow(1.15, owned));
}

async function postJson(path: string, payload?: object): Promise<GameState | null> {
  try {
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload ? JSON.stringify(payload) : undefined,
    });
    const data = await response.json();
    return data.state ?? null;
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
          setState({ ...EMPTY_STATE, ...data.state, upgrades: data.state.upgrades ?? UPGRADES });
        }
      } catch {
        // Ignore malformed stream messages.
      }
    };

    return () => source.close();
  }, []);

  const handleClick = useCallback(async () => {
    const next = await postJson('/api/stream/click');
    if (next) setState({ ...EMPTY_STATE, ...next, upgrades: next.upgrades ?? UPGRADES });
  }, []);

  const triggerEvent = useCallback(async (type: string, actor = 'Viewer') => {
    const next = await postJson('/api/stream/event', {
      type,
      username: actor,
      source: 'game-simulator',
    });
    if (next) setState({ ...EMPTY_STATE, ...next, upgrades: next.upgrades ?? UPGRADES });
  }, []);

  const buyUpgrade = useCallback(() => {
    // Upgrades are auto-claimed by the shared server state after the 1000-click unlock.
  }, []);

  return { state, handleClick, triggerEvent, buyUpgrade, displayCps: state.displayCps };
}
