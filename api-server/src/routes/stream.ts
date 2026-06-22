import { Router } from "express";
import type { Response, Request } from "express";

const router = Router();

const clients = new Set<Response>();

function broadcastEvent(payload: object) {
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  for (const client of clients) {
    try {
      client.write(data);
    } catch {
      clients.delete(client);
    }
  }
}

function mapAmountToEventType(amount: number): string {
  if (amount >= 50) return "WORLD_RESET";
  if (amount >= 20) return "BOSS";
  if (amount >= 10) return "CHAOS_MODE";
  if (amount >= 5)  return "GOLDEN_RAIN";
  if (amount >= 2)  return "CLICK_FRENZY";
  return "COOKIE_RAIN";
}

function mapJewelsToEventType(jewels: number): string {
  if (jewels >= 1000) return "WORLD_RESET";
  if (jewels >= 500)  return "BOSS";
  if (jewels >= 200)  return "CHAOS_MODE";
  if (jewels >= 100)  return "GOLDEN_RAIN";
  if (jewels >= 50)   return "CLICK_FRENZY";
  if (jewels >= 20)   return "COOKIE_RAIN";
  return "CHAT";
}

router.get("/stream/events", (req: Request, res: Response) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  res.write(`data: ${JSON.stringify({ type: "CONNECTED", clients: clients.size + 1 })}\n\n`);

  clients.add(res);

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

router.post("/stream/event", (req: Request, res: Response) => {
  const { type, username, amount, source, eventType } = req.body;

  let gameEventType: string = "CHAT";

  if (eventType) {
    gameEventType = String(eventType).toUpperCase();
  } else if (type) {
    const t = String(type).toUpperCase();
    if (
      t === "SUBSCRIBER" || t === "SUBSCRIBE" ||
      t === "NEW_SUBSCRIBER" || t === "SUB" || t === "FOLLOW" || t === "FOLLOWER"
    ) {
      gameEventType = "SUBSCRIBER";
    } else if (
      t === "MEMBERSHIP" || t === "MEMBER" ||
      t === "CHANNEL_MEMBERSHIP" || t === "MEMBER_JOIN" || t === "NEW_MEMBER"
    ) {
      gameEventType = "MEMBERSHIP";
    } else if (
      t === "GIFT_SUB" || t === "GIFTED_SUB" || t === "ARMY" ||
      t === "GIFTED_MEMBERSHIP" || t === "GIFTED_MEMBER" || t === "GIFT_MEMBERSHIP"
    ) {
      gameEventType = "ARMY";
    } else if (
      t === "SUPERCHAT" || t === "SUPER_CHAT" || t === "DONATION" || t === "TIP"
    ) {
      gameEventType = amount !== undefined ? mapAmountToEventType(Number(amount)) : "CLICK_FRENZY";
    } else if (t === "SUPER_STICKER" || t === "SUPERSTICKER") {
      gameEventType = "CLICK_FRENZY";
    } else if (t === "SUPER_THANKS" || t === "SUPERTHANKS") {
      gameEventType = amount !== undefined ? mapAmountToEventType(Number(amount)) : "GOLDEN_RAIN";
    } else if (
      t === "JEWELS" || t === "JEWEL_GIFT" || t === "GIFT_JEWELS" || t === "JEWEL"
    ) {
      gameEventType = amount !== undefined ? mapJewelsToEventType(Number(amount)) : "COOKIE_RAIN";
    } else if (t === "CHAT" || t === "MESSAGE" || t === "LIVE_CHAT") {
      gameEventType = "CHAT";
    } else {
      gameEventType = t;
    }
  } else if (amount !== undefined) {
    gameEventType = mapAmountToEventType(Number(amount));
  }

  const payload = {
    type: gameEventType,
    username: username || "Anonymous",
    amount: amount !== undefined ? Number(amount) : undefined,
    source: source || "webhook",
    timestamp: Date.now(),
  };

  broadcastEvent(payload);

  res.json({ ok: true, eventType: gameEventType, connectedClients: clients.size });
});

router.get("/stream/status", (_req: Request, res: Response) => {
  res.json({ connectedClients: clients.size, ok: true });
});

export default router;
