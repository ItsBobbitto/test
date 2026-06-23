export interface Env {
  GAME_ROOM: DurableObjectNamespace<GameRoom>;
}

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
  message?: string;
  timestamp: number;
}

interface GameState {
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

const UPGRADES: UpgradeDef[] = [
  { id: "grandma", name: "Grandma", baseCost: 100, cpsPerUnit: 0.5, iconName: "Heart", color: "#ec4899" },
  { id: "farm", name: "Farm", baseCost: 500, cpsPerUnit: 2, iconName: "Leaf", color: "#22c55e" },
  { id: "factory", name: "Factory", baseCost: 2000, cpsPerUnit: 10, iconName: "Cog", color: "#f97316" },
  { id: "lab", name: "Lab", baseCost: 10000, cpsPerUnit: 50, iconName: "Zap", color: "#06b6d4" },
  { id: "portal", name: "Portal", baseCost: 50000, cpsPerUnit: 200, iconName: "Globe", color: "#a855f7" },
  { id: "timemachine", name: "Time Machine", baseCost: 200000, cpsPerUnit: 750, iconName: "Clock", color: "#eab308" },
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
  activeEvent: null,
  eventFeed: [],
  comboCount: 0,
  clickValue: 1,
  lastReward: null,
};

function corsHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: corsHeaders() });
}

function getUpgradeCost(def: UpgradeDef, owned: number): number {
  return Math.floor(def.baseCost * Math.pow(1.15, owned));
}

function normalizePath(url: URL): string {
  return url.pathname.replace(/^\/api/, "") || "/";
}

function computeBaseCps(state: GameState): number {
  return UPGRADES.reduce((total, upgrade) => total + (state.upgradeCounts[upgrade.id] || 0) * upgrade.cpsPerUnit, 0);
}

function computeDisplayCps(state: GameState): number {
  return computeBaseCps(state) * (1 + state.permanentCpsBonus) * state.cpsBoostMultiplier;
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
  if (!type) return amount !== undefined ? mapAmountToEventType(Number(amount)) : "CHAT";

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

export class GameRoom {
  private state: DurableObjectState;
  private clients = new Set<WritableStreamDefaultWriter<Uint8Array>>();
  private encoder = new TextEncoder();
  private gameState: GameState = { ...EMPTY_STATE };

  constructor(state: DurableObjectState) {
    this.state = state;
    this.state.blockConcurrencyWhile(async () => {
      this.gameState = (await this.state.storage.get<GameState>("gameState")) ?? { ...EMPTY_STATE };
    });
  }

  async fetch(request: Request): Promise<Response> {
    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders() });

    const url = new URL(request.url);
    const path = normalizePath(url);

    if (request.method === "GET" && path === "/stream/events") return this.openEventsStream();
    if (request.method === "GET" && path === "/stream/status") return json({ ok: true, state: this.serializeState(), connectedClients: this.clients.size });
    if (request.method === "GET" && path === "/stream/event") {
      return json({
        ok: true,
        message: "Use POST /api/stream/event to trigger global game events.",
        example: { type: "super_chat", username: "Viewer", amount: 5 },
      });
    }

    if (request.method === "POST" && path === "/stream/click") {
      await this.registerClick();
      await this.saveAndBroadcast();
      return json({ ok: true, state: this.serializeState() });
    }

    if (request.method === "POST" && path === "/stream/event") {
      const body = await request.json().catch(() => ({})) as Record<string, unknown>;
      const eventType = normalizeEventType(body.type, body.eventType, body.amount);
      const username = String(body.username || body.name || "Anonymous");
      const amount = body.amount !== undefined ? Number(body.amount) : undefined;
      const message = body.message !== undefined ? String(body.message).slice(0, 120) : undefined;

      this.gameState.lastReward = { username, amount, eventType, message, timestamp: Date.now() };
      await this.triggerGameEvent(eventType, username, message);

      this.broadcast({ type: "EVENT", event: { type: eventType, username, amount, message, timestamp: Date.now() } });
      await this.saveAndBroadcast();
      return json({ ok: true, eventType, state: this.serializeState(), connectedClients: this.clients.size });
    }

    return json({ ok: false, message: "Not found" }, 404);
  }

  private serializeState() {
    this.expireActiveEventIfNeeded();
    return {
      ...this.gameState,
      displayCps: computeDisplayCps(this.gameState),
      upgrades: UPGRADES,
    };
  }

  private addFeed(name: string, tier: EventTier, message?: string) {
    this.gameState.eventFeed = [{
      id: Math.random().toString(36).slice(2, 9),
      name,
      tier,
      timestamp: Date.now(),
      message,
    }, ...this.gameState.eventFeed].slice(0, 10);
  }

  private async save() {
    await this.state.storage.put("gameState", this.gameState);
  }

  private async saveAndBroadcast() {
    this.expireActiveEventIfNeeded();
    this.autoClaimUpgrades();
    await this.save();
    await this.scheduleActiveEventAlarm();
    this.broadcast({ type: "STATE", state: this.serializeState() });
  }

  async alarm(): Promise<void> {
    this.expireActiveEventIfNeeded();
    await this.save();
    this.broadcast({ type: "STATE", state: this.serializeState() });
  }

  private async scheduleActiveEventAlarm() {
    if (this.gameState.activeEvent) {
      await this.state.storage.setAlarm(this.gameState.activeEvent.endTime + 50);
    } else {
      await this.state.storage.deleteAlarm();
    }
  }

  private write(writer: WritableStreamDefaultWriter<Uint8Array>, payload: unknown) {
    return writer.write(this.encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
  }

  private broadcast(payload: unknown) {
    for (const writer of this.clients) {
      this.write(writer, payload).catch(() => this.clients.delete(writer));
    }
  }

  private openEventsStream(): Response {
    const stream = new TransformStream();
    const writer = stream.writable.getWriter();
    this.clients.add(writer);
    this.write(writer, { type: "CONNECTED", clients: this.clients.size }).catch(() => this.clients.delete(writer));
    this.write(writer, { type: "STATE", state: this.serializeState() }).catch(() => this.clients.delete(writer));

    const interval = setInterval(() => {
      writer.write(this.encoder.encode(": ping\n\n")).catch(() => {
        clearInterval(interval);
        this.clients.delete(writer);
      });
    }, 15000);

    return new Response(stream.readable, {
      headers: {
        ...corsHeaders(),
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  }

  private async registerClick(count = 1) {
    for (let i = 0; i < count; i += 1) {
      this.gameState.comboCount += 1;
      this.gameState.totalClicks += 1;

      const comboMult =
        this.gameState.comboCount >= 150 ? 2 :
        this.gameState.comboCount >= 75 ? 1.5 :
        this.gameState.comboCount >= 30 ? 1.25 :
        this.gameState.comboCount >= 10 ? 1.1 : 1;

      const value = (this.gameState.multiplier + this.gameState.permanentMultiplierBoost) * comboMult;
      this.gameState.clickValue = value;
      this.gameState.cookies += value;
    }

    if (!this.gameState.upgradesUnlocked && this.gameState.totalClicks >= 1000) {
      this.gameState.upgradesUnlocked = true;
      this.gameState.permanentMultiplierBoost += 1;
      this.addFeed("Cookie Core Claimed", "HIGH", "All upgrades unlocked and auto-claimed");
    }
  }

  private autoClaimUpgrades() {
    if (!this.gameState.upgradesUnlocked) return;

    let keepBuying = true;
    while (keepBuying) {
      keepBuying = false;
      for (const upgrade of UPGRADES) {
        const owned = this.gameState.upgradeCounts[upgrade.id] || 0;
        const cost = getUpgradeCost(upgrade, owned);
        if (this.gameState.cookies >= cost) {
          this.gameState.cookies -= cost;
          this.gameState.upgradeCounts[upgrade.id] = owned + 1;
          this.addFeed(`${upgrade.name} claimed`, "LOW", `Auto-claimed at ${cost.toLocaleString()} cookies`);
          keepBuying = true;
        }
      }
    }
  }

  private expireActiveEventIfNeeded() {
    if (!this.gameState.activeEvent || Date.now() <= this.gameState.activeEvent.endTime) return;
    const wasMultiplier = this.gameState.activeEvent.type === "MULTIPLIER" || this.gameState.activeEvent.type === "CHAOS";
    this.gameState.activeEvent = null;
    if (wasMultiplier) this.gameState.multiplier = 1;
  }

  private async triggerGameEvent(type: string, actor: string, message?: string) {
    switch (type) {
      case "CHAT":
        this.addFeed(actor, "LOW", message || "sent a chat message");
        await this.registerClick();
        break;
      case "COOKIE_RAIN":
        this.gameState.cookies += 250;
        this.addFeed("Cookie Rain", "LOW", "+250 cookies instantly");
        break;
      case "CLICK_FRENZY":
        this.gameState.multiplier = 2;
        this.gameState.activeEvent = { id: "frenzy", name: "FRENZY x2", endTime: Date.now() + 300000, type: "MULTIPLIER", metadata: { mult: 2 } };
        this.addFeed("Click Frenzy", "LOW", "2x multiplier for 5 min");
        break;
      case "GOLDEN_RAIN":
        await this.registerClick(120);
        this.addFeed("Golden Rain", "MID", "+120 global clicks");
        break;
      case "CHAOS_MODE":
        this.gameState.multiplier = 4;
        this.gameState.activeEvent = { id: "chaos", name: "CHAOS MODE", endTime: Date.now() + 300000, type: "CHAOS", metadata: { mult: 4 } };
        this.addFeed("Chaos Mode", "MID", "4x multiplier");
        break;
      case "SUBSCRIBER":
        this.gameState.cookies += 100;
        this.addFeed("New Subscriber", "LOW", `${actor}: +100 cookies`);
        break;
      case "MEMBERSHIP":
        this.gameState.permanentCpsBonus = Math.min(0.5, this.gameState.permanentCpsBonus + 0.1);
        this.addFeed("Channel Member", "MID", `${actor}: permanent +10% CPS`);
        break;
      case "ARMY":
        await this.registerClick(60);
        this.addFeed("Gifted Members", "HIGH", `${actor}: +60 global clicks`);
        break;
      case "BOSS":
        this.gameState.cookies += 1500;
        this.addFeed("Boss Cookie", "HIGH", "+1,500 cookies");
        break;
      case "WORLD_RESET":
        this.gameState = { ...EMPTY_STATE };
        this.gameState.activeEvent = { id: "reset", name: "A NEW WORLD BEGINS", endTime: Date.now() + 2000, type: "RESET", metadata: {} };
        this.addFeed("World Reset", "HIGH", "Everything reset to zero");
        break;
    }
  }
}

export default {
  fetch(request: Request, env: Env): Response | Promise<Response> {
    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders() });

    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) {
      return json({ ok: false, message: "Use /api/stream/status" }, 404);
    }

    const id = env.GAME_ROOM.idFromName("global");
    const room = env.GAME_ROOM.get(id);
    return room.fetch(request);
  },
};
