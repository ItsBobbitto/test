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

function displayCpsFor(state: GameState): number {
  const base = UPGRADES.reduce((total, upgrade) => total + (state.upgradeCounts[upgrade.id] || 0) * upgrade.cpsPerUnit, 0);
  return base * (1 + state.permanentCpsBonus) * state.cpsBoostMultiplier;
}

function addFeed(state: GameState, name: string, tier: EventTier, message?: string): GameState {
  return {
    ...state,
    eventFeed: [{
      id: Math.random().toString(36).slice(2, 9),
      name,
      tier,
      timestamp: Date.now(),
      message,
    }, ...state.eventFeed].slice(0, 10),
  };
}

function autoClaim(state: GameState): GameState {
  if (!state.upgradesUnlocked) return state;

  let next = { ...state, upgradeCounts: { ...state.upgradeCounts } };
  let keepBuying = true;

  while (keepBuying) {
    keepBuying = false;
    for (const upgrade of UPGRADES) {
      const owned = next.upgradeCounts[upgrade.id] || 0;
      const cost = getUpgradeCost(upgrade, owned);
      if (next.cookies >= cost) {
        next.cookies -= cost;
        next.upgradeCounts[upgrade.id] = owned + 1;
        next = addFeed(next, `${upgrade.name} claimed`, 'LOW', `Auto-claimed at ${cost.toLocaleString()} cookies`);
        keepBuying = true;
      }
    }
  }

  return { ...next, displayCps: displayCpsFor(next) };
}

function applyClick(state: GameState, count = 1): GameState {
  let next = { ...state };

  for (let i = 0; i < count; i += 1) {
    const comboCount = next.comboCount + 1;
    const comboMult =
      comboCount >= 150 ? 2 :
      comboCount >= 75 ? 1.5 :
      comboCount >= 30 ? 1.25 :
      comboCount >= 10 ? 1.1 : 1;
    const clickValue = (next.multiplier + next.permanentMultiplierBoost) * comboMult;

    next = {
      ...next,
      cookies: next.cookies + clickValue,
      totalClicks: next.totalClicks + 1,
      comboCount,
      clickValue,
    };
  }

  if (!next.upgradesUnlocked && next.totalClicks >= 1000) {
    next = addFeed({
      ...next,
      upgradesUnlocked: true,
      permanentMultiplierBoost: next.permanentMultiplierBoost + 1,
    }, 'Cookie Core Claimed', 'HIGH', 'All upgrades are now unlocked and auto-claimed');
  }

  return autoClaim({ ...next, displayCps: displayCpsFor(next) });
}

function applyEvent(state: GameState, type: string, actor = 'Viewer'): GameState {
  const eventType = type.toUpperCase();
  let next = {
    ...state,
    lastReward: { username: actor, eventType, timestamp: Date.now() },
  };

  switch (eventType) {
    case 'CHAT':
      return applyClick(next);
    case 'COOKIE_RAIN':
      return addFeed({ ...next, cookies: next.cookies + 250 }, 'Cookie Rain', 'LOW', '+250 cookies instantly');
    case 'CLICK_FRENZY':
      return addFeed({
        ...next,
        multiplier: 2,
        activeEvent: { id: 'frenzy', name: 'FRENZY x2', endTime: Date.now() + 300000, type: 'MULTIPLIER', metadata: { mult: 2 } },
      }, 'Click Frenzy', 'LOW', '2x multiplier for 5 min');
    case 'GOLDEN_RAIN':
      return addFeed({
        ...next,
        activeEvent: { id: 'golden', name: 'AUTO-CLICK STORM', endTime: Date.now() + 600000, type: 'GOLDEN', metadata: {} },
      }, 'Golden Rain', 'MID', 'Auto-click storm');
    case 'CHAOS_MODE':
      return addFeed({
        ...next,
        multiplier: 4,
        activeEvent: { id: 'chaos', name: 'CHAOS MODE', endTime: Date.now() + 300000, type: 'CHAOS', metadata: { mult: 4 } },
      }, 'Chaos Mode', 'MID', '4x multiplier');
    case 'SUBSCRIBER':
      return addFeed({ ...next, cookies: next.cookies + 100 }, 'New Subscriber', 'LOW', `${actor}: +100 cookies`);
    case 'MEMBERSHIP':
      return addFeed({ ...next, permanentCpsBonus: Math.min(0.5, next.permanentCpsBonus + 0.1) }, 'Channel Member', 'MID', `${actor}: permanent +10% CPS`);
    case 'ARMY':
      return addFeed(applyClick(next, 12), 'Gifted Members', 'HIGH', `${actor}: +12 global clicks`);
    case 'BOSS':
      return addFeed({ ...next, activeEvent: { id: 'boss', name: 'BOSS COOKIE', endTime: Date.now() + 30000, type: 'BOSS', metadata: { hp: 150, maxHp: 150 } } }, 'Boss Cookie', 'HIGH', 'Boss spawned');
    case 'WORLD_RESET':
      return addFeed({ ...EMPTY_STATE, activeEvent: { id: 'reset', name: 'A NEW WORLD BEGINS', endTime: Date.now() + 2000, type: 'RESET', metadata: {} } }, 'World Reset', 'HIGH', 'Everything reset to zero');
    default:
      return next;
  }
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
    return data.state ?? null;
  } catch {
    return null;
  }
}

function withDefaults(state: GameState): GameState {
  const merged = { ...EMPTY_STATE, ...state, upgrades: state.upgrades ?? UPGRADES };
  return { ...merged, displayCps: merged.displayCps || displayCpsFor(merged) };
}

export function useGameState() {
  const [state, setState] = useState<GameState>(EMPTY_STATE);

  useEffect(() => {
    let source: EventSource | null = null;
    try {
      source = new EventSource(`${window.location.origin}/api/stream/events`);
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
    } catch {
      source = null;
    }

    return () => source?.close();
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setState(prev => {
        const cps = displayCpsFor(prev);
        if (cps <= 0) return prev;
        return autoClaim({ ...prev, cookies: prev.cookies + cps, displayCps: cps });
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const handleClick = useCallback(async () => {
    setState(prev => applyClick(prev));
    const next = await postJson('/api/stream/click');
    if (next) setState(withDefaults(next));
  }, []);

  const triggerEvent = useCallback(async (type: string, actor = 'Viewer') => {
    setState(prev => applyEvent(prev, type, actor));
    const next = await postJson('/api/stream/event', {
      type,
      username: actor,
      source: 'game-simulator',
    });
    if (next) setState(withDefaults(next));
  }, []);

  const buyUpgrade = useCallback(() => {
    // Upgrades auto-claim after Cookie Core unlock.
  }, []);

  return { state, handleClick, triggerEvent, buyUpgrade, displayCps: state.displayCps };
}
