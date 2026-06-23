import { Router } from "express";
import type { Response, Request } from "express";

type EventTier = "LOW" | "MID" | "HIGH";

interface EventRecord {
  id: string;
  name: string;
  tier: EventTier;
  timestamp: number;
  message?: string;
}

interface UpgradeDef {
  id: string;
  name: string;
  baseCost: number;
  cpsPerUnit: number;
  iconName: string;
  color: string;
}

interface ActiveEvent {
  id: string;
  name: string;
  endTime: number;
  type: string;
  metadata?: Record<string, number>;
}

interface RewardEvent {
  username: string;
  amount?: number;
  eventType: string;
  timestamp: number;
}

interface SharedGameState {
  cookies: number;
  totalClicks: number;
  upgradeCounts: Record<string, number>;
  upgradesUnlocked: boolean;
  multiplier: number;
  permanentCpsBonus: number;
  permanentMultiplierBoost: number;
  cpsBoostMultiplier: number;
  activeEvent: ActiveEvent | null;
  eventFeed: EventRecord[];
  comboCount: number;
  clickValue: number;
  lastReward: RewardEvent | null;
}

const router = Router();
const clients = new Set<Response>();

const UPGRADES: UpgradeDef[] = [
  { id: "grandma", name: "Grandma", baseCost: 100, cpsPerUnit: 0.5, iconName: "Heart", color: "#ec4899" },
  { id: "farm", name: "Farm", baseCost: 500, cpsPerUnit: 2, iconName: "Leaf", color: "#22c55e" },
  { id: "factory", name: "Factory", baseCost: 2000, cpsPerUnit: 10, iconName: "Cog", color: "#f97316" },
  { id: "lab", name: "Lab", baseCost: 10000, cpsPerUnit: 50, iconName: "Zap", color: "#06b6d4" },
  { id: "portal", name: "Portal", baseCost: 50000, cpsPerUnit: 200, iconName: "Globe", color: "#a855f7" },
  { id: "timemachine", name: "Time Machine", baseCost: 200000, cpsPerUnit: 750, iconName: "Clock", color: "#eab308" },
];

const state: SharedGameState = {
  cookies: 0,
  totalClicks: 0,
  upgradeCounts: {},
  upgradesUnlocked: false,
  multiplier: 1,
  permanentCpsBonus: 0,
  permanentMultiplierBoost: 0,
  cpsBoostMultiplier: 1,
  activeEvent: null,
  eventFeed: [],
  comboCount: 0,
  clickValue: 1,
  lastReward: null,
};

let comboResetTimer: ReturnType<typeof setTimeout> | null = null;
let chaosTimer: ReturnType<typeof setInterval> | null = null;
let autoClickStormTimer: ReturnType<typeof setInterval> | null = null;
let autoClickArmyTimer: ReturnType<typeof setInterval> | null = null;

function getUpgradeCost(def: UpgradeDef, owned: number): number {
  return Math.floor(def.baseCost * Math.pow(1.15, owned));
}

function computeBaseCps(): number {
  return UPGRADES.reduce((total, upgrade) => total + (state.upgradeCounts[upgrade.id] || 0) * upgrade.cpsPerUnit, 0);
}

function computeDisplayCps(): number {
  return computeBaseCps() * (1 + state.permanentCpsBonus) * state.cpsBoostMultiplier;
}

function serializeState() {
  return {
    ...state,
    displayCps: computeDisplayCps(),
    upgrades: UPGRADES,
  };
}

function writeSse(client: Response, payload: object) {
  client.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function broadcast(payload: object) {
  for (const client of clients) {
    try {
      writeSse(client, payload);
    } catch {
      clients.delete(client);
    }
  }
}

function broadcastState() {
  broadcast({ type: "STATE", state: serializeState() });
}

function addEventToFeed(name: string, tier: EventTier, message?: string) {
  state.eventFeed = [{
    id: Math.random().toString(36).slice(2, 9),
    name,
    tier,
    timestamp: Date.now(),
    message,
  }, ...state.eventFeed].slice(0, 10);
}

function clearTimedEvents() {
  if (chaosTimer) clearInterval(chaosTimer);
  if (autoClickStormTimer) clearInterval(autoClickStormTimer);
  if (autoClickArmyTimer) clearInterval(autoClickArmyTimer);
  if (comboResetTimer) clearTimeout(comboResetTimer);
  chaosTimer = null;
  autoClickStormTimer = null;
  autoClickArmyTimer = null;
  comboResetTimer = null;
}

function autoClaimUpgrades() {
  if (!state.upgradesUnlocked) return;

  let bought = false;
  let keepBuying = true;

  while (keepBuying) {
    keepBuying = false;

    for (const upgrade of UPGRADES) {
      const owned = state.upgradeCounts[upgrade.id] || 0;
      const cost = getUpgradeCost(upgrade, owned);

      if (state.cookies >= cost) {
        state.cookies -= cost;
        state.upgradeCounts[upgrade.id] = owned + 1;
        bought = true;
        keepBuying = true;
        addEventToFeed(`${upgrade.name} claimed`, "LOW", `Auto-claimed at ${cost.toLocaleString()} cookies`);
      }
    }
  }

  if (bought) broadcastState();
}

function unlockUpgradesIfReady() {
  if (state.upgradesUnlocked || state.totalClicks < 1000) return;

  state.upgradesUnlocked = true;
  state.permanentMultiplierBoost += 1;
  addEventToFeed("Core Upgrade Claimed", "HIGH", "1000 global clicks unlocked auto upgrades");
  autoClaimUpgrades();
}

function registerClick(count = 1) {
  for (let i = 0; i < count; i += 1) {
    if (comboResetTimer) clearTimeout(comboResetTimer);
    comboResetTimer = setTimeout(() => {
      state.comboCount = 0;
      broadcastState();
    }, 3000);

    state.comboCount += 1;
    state.totalClicks += 1;

    const comboMult =
      state.comboCount >= 150 ? 2 :
      state.comboCount >= 75 ? 1.5 :
      state.comboCount >= 30 ? 1.25 :
      state.comboCount >= 10 ? 1.1 : 1;

    const value = (state.multiplier + state.permanentMultiplierBoost) * comboMult;
    state.clickValue = value;
    state.cookies += value;

    if (state.activeEvent?.type === "BOSS" && (state.activeEvent.metadata?.hp ?? 0) > 0) {
      const hp = (state.activeEvent.metadata?.hp ?? 0) - 1;
      if (hp <= 0) {
        state.cookies += 500;
        state.multiplier = 2;
        state.activeEvent = {
          id: "boss-defeated",
          name: "BOSS DEFEATED - 2x MULT",
          endTime: Date.now() + 20000,
          type: "MULTIPLIER",
          metadata: { mult: 2 },
        };
        addEventToFeed("Boss defeated", "HIGH", "+500 cookies and 2x multiplier");
      } else {
        state.activeEvent = { ...state.activeEvent, metadata: { ...state.activeEvent.metadata, hp } };
      }
    }
  }

  unlockUpgradesIfReady();
  autoClaimUpgrades();
}

function resetGame() {
  clearTimedEvents();
  state.cookies = 0;
  state.totalClicks = 0;
  state.upgradeCounts = {};
  state.upgradesUnlocked = false;
  state.multiplier = 1;
  state.permanentCpsBonus = 0;
  state.permanentMultiplierBoost = 0;
  state.cpsBoostMultiplier = 1;
  state.comboCount = 0;
  state.clickValue = 1;
  state.lastReward = null;
  state.eventFeed = [];
  state.activeEvent = { id: "reset", name: "A NEW WORLD BEGINS", endTime: Date.now() + 2000, type: "RESET", metadata: {} };
  addEventToFeed("World Reset", "HIGH", "Everything reset to zero");
}

function triggerGameEvent(type: string, actor = "Viewer") {
  switch (type) {
    case "CHAT":
      registerClick();
      break;

    case "COOKIE_RAIN":
      state.cookies += 250;
      addEventToFeed("Cookie Rain", "LOW", "+250 cookies instantly");
      break;

    case "CLICK_FRENZY":
      state.multiplier = 2;
      state.activeEvent = { id: "frenzy", name: "FRENZY x2", endTime: Date.now() + 300000, type: "MULTIPLIER", metadata: { mult: 2 } };
      addEventToFeed("Click Frenzy", "LOW", "2x multiplier for 5 min");
      break;

    case "SUBSCRIBER":
      state.cookies += 100;
      state.multiplier = 1.5;
      state.activeEvent = { id: "subscriber", name: "SUB HYPE x1.5", endTime: Date.now() + 90000, type: "MULTIPLIER", metadata: { mult: 1.5 } };
      addEventToFeed("New Subscriber", "LOW", `${actor}: +100 cookies and 1.5x mult for 90s`);
      break;

    case "GOLDEN_RAIN":
      state.activeEvent = { id: "golden", name: "AUTO-CLICK STORM", endTime: Date.now() + 600000, type: "GOLDEN", metadata: {} };
      addEventToFeed("Golden Rain", "MID", "Auto-click storm for 10 min");
      if (autoClickStormTimer) clearInterval(autoClickStormTimer);
      autoClickStormTimer = setInterval(() => {
        registerClick(15);
        broadcastState();
      }, 1000);
      break;

    case "CHAOS_MODE":
      state.multiplier = 1;
      state.activeEvent = { id: "chaos", name: "CHAOS MODE", endTime: Date.now() + 300000, type: "CHAOS", metadata: { mult: 1 } };
      addEventToFeed("Chaos Mode", "MID", "Random multipliers for 5 min");
      if (chaosTimer) clearInterval(chaosTimer);
      chaosTimer = setInterval(() => {
        if (state.activeEvent?.id !== "chaos") return;
        const mult = Math.floor(Math.random() * 9) + 1;
        state.multiplier = mult;
        state.activeEvent = { ...state.activeEvent, metadata: { mult } };
        broadcastState();
      }, 1500);
      break;

    case "MEMBERSHIP":
      state.permanentCpsBonus = Math.min(0.5, state.permanentCpsBonus + 0.1);
      addEventToFeed("Channel Member", "MID", `${actor}: permanent +10% CPS`);
      break;

    case "BOSS":
      state.activeEvent = { id: "boss", name: "BOSS COOKIE", endTime: Date.now() + 30000, type: "BOSS", metadata: { hp: 150, maxHp: 150 } };
      addEventToFeed("Boss Cookie", "HIGH", "Defeat for 500 cookies and 2x mult");
      break;

    case "WORLD_RESET":
      resetGame();
      break;

    case "ARMY":
      state.activeEvent = { id: "army", name: "AUTO-CLICK ARMY", endTime: Date.now() + 30000, type: "ARMY", metadata: {} };
      addEventToFeed("Gifted Members", "HIGH", `${actor}: 12 clicks every half-second`);
      if (autoClickArmyTimer) clearInterval(autoClickArmyTimer);
      autoClickArmyTimer = setInterval(() => {
        registerClick(12);
        broadcastState();
      }, 500);
      break;
  }

  autoClaimUpgrades();
}

function mapAmountToEventType(amount: number): string {
  if (amount >= 50) return "WORLD_RESET";
  if (amount >= 20) return "BOSS";
  if (amount >= 10) return "CHAOS_MODE";
  if (amount >= 5) return "GOLDEN_RAIN";
  if (amount >= 2) return "CLICK_FRENZY";
  return "COOKIE_RAIN";
}

function mapJewelsToEventType(jewels: number): string {
  if (jewels >= 1000) return "WORLD_RESET";
  if (jewels >= 500) return "BOSS";
  if (jewels >= 200) return "CHAOS_MODE";
  if (jewels >= 100) return "GOLDEN_RAIN";
  if (jewels >= 50) return "CLICK_FRENZY";
  if (jewels >= 20) return "COOKIE_RAIN";
  return "CHAT";
}

function normalizeEventType(type?: unknown, eventType?: unknown, amount?: unknown): string {
  if (eventType) return String(eventType).toUpperCase();

  if (!type) {
    return amount !== undefined ? mapAmountToEventType(Number(amount)) : "CHAT";
  }

  const t = String(type).toUpperCase();

  if (["SUBSCRIBER", "SUBSCRIBE", "NEW_SUBSCRIBER", "SUB", "FOLLOW", "FOLLOWER"].includes(t)) return "SUBSCRIBER";
  if (["MEMBERSHIP", "MEMBER", "CHANNEL_MEMBERSHIP", "MEMBER_JOIN", "NEW_MEMBER"].includes(t)) return "MEMBERSHIP";
  if (["GIFT_SUB", "GIFTED_SUB", "ARMY", "GIFTED_MEMBERSHIP", "GIFTED_MEMBER", "GIFT_MEMBERSHIP"].includes(t)) return "ARMY";
  if (["SUPERCHAT", "SUPER_CHAT", "DONATION", "TIP"].includes(t)) return amount !== undefined ? mapAmountToEventType(Number(amount)) : "CLICK_FRENZY";
  if (["SUPER_STICKER", "SUPERSTICKER"].includes(t)) return "CLICK_FRENZY";
  if (["SUPER_THANKS", "SUPERTHANKS"].includes(t)) return amount !== undefined ? mapAmountToEventType(Number(amount)) : "GOLDEN_RAIN";
  if (["JEWELS", "JEWEL_GIFT", "GIFT_JEWELS", "JEWEL"].includes(t)) return amount !== undefined ? mapJewelsToEventType(Number(amount)) : "COOKIE_RAIN";
  if (["CHAT", "MESSAGE", "LIVE_CHAT"].includes(t)) return "CHAT";

  return t;
}

router.get("/stream/events", (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  clients.add(res);
  writeSse(res, { type: "CONNECTED", clients: clients.size });
  writeSse(res, { type: "STATE", state: serializeState() });

  const keepAlive = setInterval(() => {
    try {
      res.write(": ping\n\n");
    } catch {
      clearInterval(keepAlive);
      clients.delete(res);
    }
  }, 15000);

  req.on("close", () => {
    clearInterval(keepAlive);
    clients.delete(res);
  });
});

router.get("/stream/event", (_req: Request, res: Response) => {
  res.json({
    ok: true,
    message: "Use POST /api/stream/event to trigger game events.",
    example: { type: "super_chat", username: "Viewer", amount: 5 },
    status: "/api/stream/status",
  });
});

router.post("/stream/click", (_req: Request, res: Response) => {
  registerClick();
  broadcastState();
  res.json({ ok: true, state: serializeState() });
});

router.post("/stream/event", (req: Request, res: Response) => {
  const { type, username, amount, source, eventType } = req.body;
  const gameEventType = normalizeEventType(type, eventType, amount);
  const actor = username || "Anonymous";

  state.lastReward = {
    username: actor,
    amount: amount !== undefined ? Number(amount) : undefined,
    eventType: gameEventType,
    timestamp: Date.now(),
  };

  triggerGameEvent(gameEventType, actor);

  const payload = {
    type: gameEventType,
    username: actor,
    amount: amount !== undefined ? Number(amount) : undefined,
    source: source || "webhook",
    timestamp: Date.now(),
  };

  broadcast({ type: "EVENT", event: payload });
  broadcastState();

  res.json({ ok: true, eventType: gameEventType, connectedClients: clients.size, state: serializeState() });
});

router.get("/stream/status", (_req: Request, res: Response) => {
  res.json({ connectedClients: clients.size, ok: true, state: serializeState() });
});

setInterval(() => {
  const now = Date.now();
  let changed = false;

  if (state.activeEvent && now > state.activeEvent.endTime) {
    const wasMultiplier = state.activeEvent.type === "MULTIPLIER" || state.activeEvent.type === "CHAOS";
    state.activeEvent = null;
    if (wasMultiplier) state.multiplier = 1;
    changed = true;
  }

  const cps = computeDisplayCps();
  if (cps > 0) {
    state.cookies += cps * (state.multiplier + state.permanentMultiplierBoost);
    changed = true;
  }

  autoClaimUpgrades();

  if (changed) broadcastState();
}, 1000);

export default router;
