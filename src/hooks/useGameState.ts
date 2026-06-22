import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

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

export const UPGRADES: UpgradeDef[] = [
  { id: 'cursor',      name: 'Cursor',       baseCost: 15,     cpsPerUnit: 0.1,  iconName: 'MousePointerClick', color: '#3b82f6' },
  { id: 'grandma',     name: 'Grandma',      baseCost: 100,    cpsPerUnit: 0.5,  iconName: 'Heart',             color: '#ec4899' },
  { id: 'farm',        name: 'Farm',         baseCost: 500,    cpsPerUnit: 2,    iconName: 'Leaf',              color: '#22c55e' },
  { id: 'factory',     name: 'Factory',      baseCost: 2000,   cpsPerUnit: 10,   iconName: 'Cog',               color: '#f97316' },
  { id: 'lab',         name: 'Lab',          baseCost: 10000,  cpsPerUnit: 50,   iconName: 'Zap',               color: '#06b6d4' },
  { id: 'portal',      name: 'Portal',       baseCost: 50000,  cpsPerUnit: 200,  iconName: 'Globe',             color: '#a855f7' },
  { id: 'timemachine', name: 'Time Machine', baseCost: 200000, cpsPerUnit: 750,  iconName: 'Clock',             color: '#eab308' },
];

export function getUpgradeCost(def: UpgradeDef, owned: number): number {
  return Math.floor(def.baseCost * Math.pow(1.15, owned));
}

export interface GameState {
  cookies: number;
  upgradeCounts: Record<string, number>;
  multiplier: number;
  permanentCpsBonus: number;
  permanentMultiplierBoost: number;
  cpsBoostMultiplier: number;
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
}

function computeBaseCps(upgradeCounts: Record<string, number>): number {
  return UPGRADES.reduce((total, u) => total + (upgradeCounts[u.id] || 0) * u.cpsPerUnit, 0);
}

const SAVE_KEY = 'cookie_clicker_save_v1';

const EMPTY_STATE: GameState = {
  cookies: 0,
  upgradeCounts: {},
  multiplier: 1,
  permanentCpsBonus: 0,
  permanentMultiplierBoost: 0,
  cpsBoostMultiplier: 1,
  activeEvent: null,
  eventFeed: [],
  comboCount: 0,
  clickValue: 1,
};

function loadSave(): Partial<GameState> {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return {};
    const saved = JSON.parse(raw);
    return {
      cookies: typeof saved.cookies === 'number' ? saved.cookies : 0,
      upgradeCounts: saved.upgradeCounts && typeof saved.upgradeCounts === 'object' ? saved.upgradeCounts : {},
      permanentCpsBonus: typeof saved.permanentCpsBonus === 'number' ? saved.permanentCpsBonus : 0,
      permanentMultiplierBoost: typeof saved.permanentMultiplierBoost === 'number' ? saved.permanentMultiplierBoost : 0,
      cpsBoostMultiplier: typeof saved.cpsBoostMultiplier === 'number' ? saved.cpsBoostMultiplier : 1,
    };
  } catch {
    return {};
  }
}

export function useGameState() {
  const saved = loadSave();
  const [state, setState] = useState<GameState>({
    cookies: saved.cookies ?? 0,
    upgradeCounts: saved.upgradeCounts ?? {},
    multiplier: 1,
    permanentCpsBonus: saved.permanentCpsBonus ?? 0,
    permanentMultiplierBoost: saved.permanentMultiplierBoost ?? 0,
    cpsBoostMultiplier: saved.cpsBoostMultiplier ?? 1,
    activeEvent: null,
    eventFeed: [],
    comboCount: 0,
    clickValue: 1,
  });

  const comboTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chaosIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoClickStormRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoClickArmyRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTimedEvents = useCallback(() => {
    if (chaosIntervalRef.current) clearInterval(chaosIntervalRef.current);
    if (autoClickStormRef.current) clearInterval(autoClickStormRef.current);
    if (autoClickArmyRef.current) clearInterval(autoClickArmyRef.current);
    if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
    chaosIntervalRef.current = null;
    autoClickStormRef.current = null;
    autoClickArmyRef.current = null;
    comboTimerRef.current = null;
  }, []);

  const displayCps = useMemo(() => {
    const base = computeBaseCps(state.upgradeCounts);
    return base * (1 + state.permanentCpsBonus) * state.cpsBoostMultiplier;
  }, [state.upgradeCounts, state.permanentCpsBonus, state.cpsBoostMultiplier]);

  // Auto-save to localStorage whenever progress changes
  useEffect(() => {
    const timeout = setTimeout(() => {
      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify({
          cookies: state.cookies,
          upgradeCounts: state.upgradeCounts,
          permanentCpsBonus: state.permanentCpsBonus,
          permanentMultiplierBoost: state.permanentMultiplierBoost,
          cpsBoostMultiplier: state.cpsBoostMultiplier,
        }));
      } catch { /* ignore */ }
    }, 2000);
    return () => clearTimeout(timeout);
  }, [state.cookies, state.upgradeCounts, state.permanentCpsBonus, state.permanentMultiplierBoost, state.cpsBoostMultiplier]);

  const addCookies = useCallback((amount: number) => {
    setState(prev => ({ ...prev, cookies: prev.cookies + amount }));
  }, []);

  const addEventToFeed = useCallback((name: string, tier: EventTier, message?: string) => {
    setState(prev => ({
      ...prev,
      eventFeed: [{
        id: Math.random().toString(36).substring(2, 9),
        name,
        tier,
        timestamp: Date.now(),
        message,
      }, ...prev.eventFeed].slice(0, 10),
    }));
  }, []);

  const resetCombo = useCallback(() => {
    setState(prev => ({ ...prev, comboCount: 0 }));
  }, []);

  const handleClick = useCallback(() => {
    if (comboTimerRef.current) clearTimeout(comboTimerRef.current);
    comboTimerRef.current = setTimeout(resetCombo, 3000);

    setState(prev => {
      const newCombo = prev.comboCount + 1;
      const comboMult =
        newCombo >= 150 ? 2 :
        newCombo >= 75  ? 1.5 :
        newCombo >= 30  ? 1.25 :
        newCombo >= 10  ? 1.1 : 1;

      const val = (prev.multiplier + prev.permanentMultiplierBoost) * comboMult;
      let nextCookies = prev.cookies + val;

      let activeEvent = prev.activeEvent;
      if (activeEvent?.type === 'BOSS' && (activeEvent.metadata?.hp ?? 0) > 0) {
        const hp = (activeEvent.metadata?.hp ?? 0) - 1;
        if (hp <= 0) {
          nextCookies += 500;
          activeEvent = {
            id: 'boss-defeated',
            name: 'BOSS DEFEATED — 2x MULT',
            endTime: Date.now() + 20000,
            type: 'MULTIPLIER',
            metadata: { mult: 2 },
          };
        } else {
          activeEvent = { ...activeEvent, metadata: { ...activeEvent.metadata, hp } };
        }
      }

      return { ...prev, cookies: nextCookies, comboCount: newCombo, clickValue: val, activeEvent };
    });
  }, [resetCombo]);

  const buyUpgrade = useCallback((id: string) => {
    setState(prev => {
      const def = UPGRADES.find(u => u.id === id);
      if (!def) return prev;
      const owned = prev.upgradeCounts[id] || 0;
      const cost = getUpgradeCost(def, owned);
      if (prev.cookies < cost) return prev;
      return {
        ...prev,
        cookies: prev.cookies - cost,
        upgradeCounts: { ...prev.upgradeCounts, [id]: owned + 1 },
      };
    });
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setState(prev => {
        const base = computeBaseCps(prev.upgradeCounts);
        const cps = base * (1 + prev.permanentCpsBonus) * prev.cpsBoostMultiplier;
        if (cps <= 0) return prev;
        const tick = cps * (prev.multiplier + prev.permanentMultiplierBoost);
        return { ...prev, cookies: prev.cookies + tick };
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setState(prev => {
        if (!prev.activeEvent) return prev;
        if (Date.now() <= prev.activeEvent.endTime) {
          if (prev.activeEvent.type === 'MULTIPLIER') {
            const desired = prev.activeEvent.metadata?.mult ?? 1;
            return prev.multiplier === desired ? prev : { ...prev, multiplier: desired };
          }
          return prev;
        }
        const wasMultiplier = prev.activeEvent.type === 'MULTIPLIER' || prev.activeEvent.type === 'CHAOS';
        return { ...prev, activeEvent: null, multiplier: wasMultiplier ? 1 : prev.multiplier };
      });
    }, 500);
    return () => clearInterval(id);
  }, []);

  const triggerEvent = useCallback((type: string, actor = "Viewer") => {
    switch (type) {
      case 'CHAT':
        handleClick();
        break;

      case 'CLICK_FRENZY':
        addEventToFeed('Click Frenzy', 'LOW', '2x Multiplier for 5 min');
        setState(prev => ({
          ...prev,
          multiplier: 2,
          activeEvent: { id: 'frenzy', name: 'FRENZY x2', endTime: Date.now() + 300000, type: 'MULTIPLIER', metadata: { mult: 2 } },
        }));
        break;

      case 'COOKIE_RAIN':
        addEventToFeed('Cookie Rain', 'LOW', '+250 Cookies instantly');
        addCookies(250);
        break;

      case 'SUBSCRIBER':
        addEventToFeed('New Subscriber', 'LOW', `${actor}: +100 cookies and 1.5x mult for 90s`);
        addCookies(100);
        setState(prev => ({
          ...prev,
          multiplier: 1.5,
          activeEvent: { id: 'subscriber', name: 'SUB HYPE x1.5', endTime: Date.now() + 90000, type: 'MULTIPLIER', metadata: { mult: 1.5 } },
        }));
        break;

      case 'GOLDEN_RAIN':
        addEventToFeed('Golden Rain', 'MID', 'Auto-click storm for 10 min');
        setState(prev => ({
          ...prev,
          activeEvent: { id: 'golden', name: 'AUTO-CLICK STORM', endTime: Date.now() + 600000, type: 'GOLDEN', metadata: {} },
        }));
        if (autoClickStormRef.current) clearInterval(autoClickStormRef.current);
        autoClickStormRef.current = setInterval(() => handleClick(), 66);
        setTimeout(() => {
          if (autoClickStormRef.current) clearInterval(autoClickStormRef.current);
        }, 600000);
        break;

      case 'CHAOS_MODE':
        addEventToFeed('Chaos Mode', 'MID', 'Random multipliers for 5 min');
        setState(prev => ({
          ...prev,
          multiplier: 1,
          activeEvent: { id: 'chaos', name: 'CHAOS MODE', endTime: Date.now() + 300000, type: 'CHAOS', metadata: { mult: 1 } },
        }));
        if (chaosIntervalRef.current) clearInterval(chaosIntervalRef.current);
        chaosIntervalRef.current = setInterval(() => {
          const m = Math.floor(Math.random() * 9) + 1;
          setState(p => p.activeEvent?.id === 'chaos'
            ? { ...p, multiplier: m, activeEvent: { ...p.activeEvent!, metadata: { mult: m } } }
            : p);
        }, 1500);
        setTimeout(() => {
          if (chaosIntervalRef.current) clearInterval(chaosIntervalRef.current);
        }, 300000);
        break;

      case 'MEMBERSHIP':
        addEventToFeed('Channel Member', 'MID', `${actor}: permanent +10% CPS`);
        setState(prev => ({
          ...prev,
          permanentCpsBonus: Math.min(0.5, prev.permanentCpsBonus + 0.1),
        }));
        break;

      case 'BOSS':
        addEventToFeed('Boss Cookie', 'HIGH', 'Defeat for 1500 cookies + 3x mult');
        setState(prev => ({
          ...prev,
          activeEvent: { id: 'boss', name: 'BOSS COOKIE', endTime: Date.now() + 30000, type: 'BOSS', metadata: { hp: 150, maxHp: 150 } },
        }));
        break;

      case 'WORLD_RESET':
        stopTimedEvents();
        try {
          localStorage.removeItem(SAVE_KEY);
        } catch { /* ignore */ }
        setState({
          ...EMPTY_STATE,
          eventFeed: [{
            id: Math.random().toString(36).substring(2, 9),
            name: 'World Reset',
            tier: 'HIGH',
            timestamp: Date.now(),
            message: 'Everything reset to zero',
          }],
          activeEvent: { id: 'reset', name: 'A NEW WORLD BEGINS', endTime: Date.now() + 2000, type: 'RESET', metadata: {} },
        });
        break;

      case 'ARMY':
        addEventToFeed('Gifted Members', 'HIGH', `${actor}: 12 cursors for 30s`);
        setState(prev => ({
          ...prev,
          activeEvent: { id: 'army', name: 'AUTO-CLICK ARMY', endTime: Date.now() + 30000, type: 'ARMY', metadata: {} },
        }));
        if (autoClickArmyRef.current) clearInterval(autoClickArmyRef.current);
        autoClickArmyRef.current = setInterval(() => {
          setState(p => {
            const m = p.multiplier + p.permanentMultiplierBoost;
            return { ...p, cookies: p.cookies + 12 * m };
          });
        }, 500);
        setTimeout(() => {
          if (autoClickArmyRef.current) clearInterval(autoClickArmyRef.current);
        }, 30000);
        break;
    }
  }, [addCookies, handleClick, addEventToFeed, stopTimedEvents]);

  return { state, handleClick, triggerEvent, buyUpgrade, displayCps };
}
