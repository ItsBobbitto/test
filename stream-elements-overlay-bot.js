/*
  StreamElements reward overlay bridge

  Paste this into a StreamElements custom widget JS panel.
  Set GAME_EVENT_ENDPOINT if the cookie game should react to events.
*/

const GAME_EVENT_ENDPOINT = "https://chlimro.applesmp.us/api/stream/event";

const REWARD_COPY = {
  SUBSCRIBER: "Sub Hype: +100 cookies and 1.5x for 90s",
  CLICK_FRENZY: "Super Chat Reward: 2x Frenzy for 5 min",
  GOLDEN_RAIN: "Super Chat Reward: Auto-click Storm for 10 min",
  CHAOS_MODE: "Super Chat Reward: Chaos Mode for 5 min",
  BOSS: "Super Chat Reward: Boss Cookie spawned",
  WORLD_RESET: "Super Chat Reward: World Reset triggered",
};

function getName(event) {
  return (
    event?.displayName ||
    event?.name ||
    event?.username ||
    event?.nick ||
    event?.sender ||
    "Someone"
  );
}

function mapSuperChatAmount(amount) {
  if (amount >= 50) return "WORLD_RESET";
  if (amount >= 20) return "BOSS";
  if (amount >= 10) return "CHAOS_MODE";
  if (amount >= 5) return "GOLDEN_RAIN";
  if (amount >= 2) return "CLICK_FRENZY";
  return "COOKIE_RAIN";
}

function showRewardAlert({ username, amount, eventType }) {
  const wrap = document.createElement("div");
  wrap.className = "stream-reward-alert";

  const title =
    eventType === "SUBSCRIBER"
      ? `${username} subscribed`
      : `${username} sent ${amount ? `$${amount}` : "a reward"}`;

  wrap.innerHTML = `
    <div class="stream-reward-icon">âš¡</div>
    <div class="stream-reward-copy">
      <strong>${title}</strong>
      <span>${REWARD_COPY[eventType] || "Chat reward triggered"}</span>
    </div>
  `;

  document.body.appendChild(wrap);
  requestAnimationFrame(() => wrap.classList.add("show"));

  setTimeout(() => {
    wrap.classList.remove("show");
    setTimeout(() => wrap.remove(), 450);
  }, 5200);
}

async function sendGameEvent({ username, amount, eventType }) {
  if (!GAME_EVENT_ENDPOINT) return;

  try {
    await fetch(GAME_EVENT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventType,
        username,
        amount,
        source: "streamelements-youtube",
      }),
    });
  } catch (error) {
    console.warn("Could not send event to game API", error);
  }
}

function injectRewardStyles() {
  if (document.getElementById("stream-reward-styles")) return;
  const style = document.createElement("style");
  style.id = "stream-reward-styles";
  style.textContent = `
    .stream-reward-alert {
      position: fixed;
      left: 50%;
      top: 7%;
      display: flex;
      align-items: center;
      gap: 16px;
      min-width: 420px;
      max-width: min(680px, calc(100vw - 48px));
      padding: 18px 22px;
      border: 1px solid rgba(255,255,255,.16);
      border-radius: 22px;
      background:
        radial-gradient(circle at 18% 50%, rgba(255, 70, 70, .32), transparent 11rem),
        linear-gradient(135deg, rgba(18,18,18,.94), rgba(6,6,6,.86));
      box-shadow: 0 26px 80px rgba(0,0,0,.48), 0 0 44px rgba(255, 55, 55, .20);
      color: white;
      font-family: Inter, Arial, sans-serif;
      opacity: 0;
      transform: translate(-50%, -18px) scale(.96);
      transition: opacity .35s ease, transform .35s ease;
      z-index: 999999;
    }

    .stream-reward-alert.show {
      opacity: 1;
      transform: translate(-50%, 0) scale(1);
    }

    .stream-reward-icon {
      display: grid;
      place-items: center;
      width: 58px;
      height: 58px;
      border-radius: 18px;
      background: linear-gradient(135deg, #ff3f45, #951b22);
      box-shadow: inset 0 1px 0 rgba(255,255,255,.3), 0 14px 30px rgba(239,68,68,.24);
      font-size: 32px;
    }

    .stream-reward-copy {
      display: grid;
      gap: 5px;
    }

    .stream-reward-copy strong {
      font-size: 26px;
      line-height: 1;
      letter-spacing: 0;
      text-shadow: 0 3px 16px rgba(0,0,0,.42);
    }

    .stream-reward-copy span {
      color: rgba(255,255,255,.72);
      font-size: 15px;
      font-weight: 800;
    }
  `;
  document.head.appendChild(style);
}

window.addEventListener("onWidgetLoad", () => {
  injectRewardStyles();
});

window.addEventListener("onEventReceived", (obj) => {
  injectRewardStyles();

  const detail = obj?.detail || {};
  const listener = String(detail.listener || "").toLowerCase();
  const event = detail.event || {};
  const username = getName(event);
  const amount = Number(event.amount || event.amountFormatted || event.value || 0);

  let visibleEventType = null;

  if (
    listener.includes("subscriber") ||
    listener.includes("subscription") ||
    listener.includes("member") ||
    listener.includes("follow")
  ) {
    visibleEventType = "SUBSCRIBER";
  }

  if (
    listener.includes("superchat") ||
    listener.includes("super_chat") ||
    listener.includes("tip") ||
    listener.includes("donation")
  ) {
    visibleEventType = mapSuperChatAmount(amount);
  }

  if (!visibleEventType) return;

  const payload = {
    username,
    amount,
    eventType: visibleEventType,
  };

  showRewardAlert(payload);
  sendGameEvent(payload);
});


===== YOUTUBE_NO_GOOGLE_CLOUD_SETUP.md =====
# Connect YouTube Without Google Cloud

Use StreamElements as the YouTube event bridge. This avoids Google Cloud, OAuth app setup, YouTube Data API keys, and quota management.

## What This Supports

- YouTube Super Chat
- Super Sticker style donation events when StreamElements exposes them
- Subscribers
- Channel memberships
- Gifted memberships

## Setup

1. Log in to StreamElements with the YouTube channel that will stream.
2. Create or open an overlay in StreamElements.
3. Add a Custom Widget.
4. Paste the contents of `stream-elements-overlay-bot.js` into the widget JavaScript panel.
5. Save the widget and add the overlay URL to OBS as a Browser Source.
6. Run this app and the API server on a public HTTPS URL.
7. In `stream-elements-overlay-bot.js`, set `GAME_EVENT_ENDPOINT` to your app's event endpoint:

```js
const GAME_EVENT_ENDPOINT = "https://your-domain.com/api/stream/event";
```

## How Events Reach The Game

The game page opens a server-sent event stream at:

```text
/api/stream/events
```

The API server accepts StreamElements-style payloads at:

```text
POST /api/stream/event
```

The server maps the incoming event to a gameplay event, then broadcasts it to the open game page.

## Reward Mapping

```text
$2+ Super Chat   -> CLICK_FRENZY
$5+ Super Chat   -> GOLDEN_RAIN
$10+ Super Chat  -> CHAOS_MODE
$20+ Super Chat  -> BOSS
$50+ Super Chat  -> WORLD_RESET
Subscriber       -> SUBSCRIBER
Channel member   -> MEMBERSHIP
Gifted members   -> ARMY
```

## Important Notes

- StreamElements must be connected to the YouTube channel. That connection is handled by StreamElements, not by this app.
- If you only need on-screen overlay alerts, the widget script can run by itself.
- If you want the cookie game to react, the widget or bridge must send events to `/api/stream/event`.
- For local testing, use the in-game simulator or the control page endpoint before going live.
