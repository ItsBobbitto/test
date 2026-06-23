# Chat Event Sparks Global API

This is the API that makes clicks global for every viewer.

Your frontend is already at:

```text
https://chlimro.applesmp.us
```

This Worker must be routed to:

```text
https://chlimro.applesmp.us/api/*
```

## Files To Add To GitHub

Add this folder to your repo, for example:

```text
cloudflare-global-api/
  package.json
  wrangler.toml
  src/index.ts
  streamelements-widget.js
```

## Deploy Option A: Cloudflare Dashboard With GitHub

1. Push `cloudflare-global-api/` to your GitHub repo.
2. Open Cloudflare Dashboard.
3. Go to **Workers & Pages**.
4. Click **Create application**.
5. Choose **Worker**.
6. Connect your GitHub repo.
7. Set the root directory to:

```text
cloudflare-global-api
```

8. Use these commands:

```text
Build command: npm install
Deploy command: npm run deploy
```

If Cloudflare asks for the entry point, use:

```text
src/index.ts
```

## Deploy Option B: Wrangler From Your PC

Inside `cloudflare-global-api/`, run:

```bash
npm install
npx wrangler login
npm run deploy
```

## Add The Route

After the Worker is deployed:

1. Open Cloudflare Dashboard.
2. Go to **Workers & Pages**.
3. Open the Worker named `chat-event-sparks-api`.
4. Go to **Settings**.
5. Go to **Triggers**.
6. Add a route:

```text
chlimro.applesmp.us/api/*
```

7. Choose the zone:

```text
applesmp.us
```

## Test

Open this in your browser:

```text
https://chlimro.applesmp.us/api/stream/status
```

It should show JSON like:

```json
{
  "ok": true,
  "state": {
    "cookies": 0,
    "totalClicks": 0
  }
}
```

If you still see the React "Page not found" page, the Worker route is not attached correctly.

## StreamElements Bot Code

Paste `streamelements-widget.js` into:

```text
StreamElements overlay -> Custom Widget -> JavaScript
```

The endpoint is already set:

```js
const GAME_EVENT_ENDPOINT = "https://chlimro.applesmp.us/api/stream/event";
```
