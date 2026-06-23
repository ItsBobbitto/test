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
