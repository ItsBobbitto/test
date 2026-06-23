/*
  StreamElements -> Chat Event Sparks

  Paste this entire file into a StreamElements Custom Widget JavaScript panel.
*/

const GAME_EVENT_ENDPOINT = "https://chlimro.applesmp.us/api/stream/event";

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

function getAmount(event) {
  const raw = event?.amount || event?.amountFormatted || event?.value || 0;
  const cleaned = String(raw).replace(/[^0-9.]/g, "");
  return Number(cleaned || 0);
}

async function sendGameEvent(payload) {
  try {
    await fetch(GAME_EVENT_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.warn("Chat Event Sparks API failed", error);
  }
}

window.addEventListener("onEventReceived", (obj) => {
  const detail = obj?.detail || {};
  const listener = String(detail.listener || "").toLowerCase();
  const event = detail.event || {};
  const username = getName(event);
  const amount = getAmount(event);

  if (listener.includes("message") || listener.includes("chat")) {
    sendGameEvent({ type: "chat", username, source: "streamelements" });
    return;
  }

  if (
    listener.includes("superchat") ||
    listener.includes("super_chat") ||
    listener.includes("tip") ||
    listener.includes("donation")
  ) {
    sendGameEvent({ type: "super_chat", username, amount, source: "streamelements" });
    return;
  }

  if (
    listener.includes("subscriber") ||
    listener.includes("subscription") ||
    listener.includes("follow")
  ) {
    sendGameEvent({ type: "subscriber", username, source: "streamelements" });
    return;
  }

  if (
    listener.includes("member") &&
    (listener.includes("gift") || listener.includes("bulk"))
  ) {
    sendGameEvent({ type: "gifted_membership", username, source: "streamelements" });
    return;
  }

  if (listener.includes("member")) {
    sendGameEvent({ type: "channel_membership", username, source: "streamelements" });
  }
});
