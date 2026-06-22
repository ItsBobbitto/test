import { useState } from 'react';

const API = window.location.origin + '/api/stream/event';

async function fire(payload: object, setFeedback: (s: string) => void) {
  try {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setFeedback(data.eventType ?? 'sent');
  } catch {
    setFeedback('error');
  }
  setTimeout(() => setFeedback(''), 1500);
}

const SUPERCHATS = [
  { label: '$2',  color: '#3b82f6', payload: { type: 'super_chat', amount: 2 } },
  { label: '$5',  color: '#22c55e', payload: { type: 'super_chat', amount: 5 } },
  { label: '$10', color: '#eab308', payload: { type: 'super_chat', amount: 10 } },
  { label: '$20', color: '#f97316', payload: { type: 'super_chat', amount: 20 } },
  { label: '$50', color: '#ef4444', payload: { type: 'super_chat', amount: 50 } },
];

const JEWELS = [
  { label: '20',   color: '#a78bfa', payload: { type: 'jewels', amount: 20 } },
  { label: '50',   color: '#a78bfa', payload: { type: 'jewels', amount: 50 } },
  { label: '100',  color: '#8b5cf6', payload: { type: 'jewels', amount: 100 } },
  { label: '200',  color: '#8b5cf6', payload: { type: 'jewels', amount: 200 } },
  { label: '500',  color: '#d946ef', payload: { type: 'jewels', amount: 500 } },
  { label: '1000', color: '#d946ef', payload: { type: 'jewels', amount: 1000 } },
];

const OTHERS = [
  { label: 'Chat Click',       color: '#71717a', payload: { type: 'chat' } },
  { label: 'Subscriber',       color: '#ef4444', payload: { type: 'subscriber' } },
  { label: 'Channel Member',   color: '#22c55e', payload: { type: 'channel_membership' } },
  { label: 'Gifted Members',   color: '#3b82f6', payload: { type: 'gifted_membership' } },
  { label: 'Cookie Rain',      color: '#f59e0b', payload: { type: 'COOKIE_RAIN' } },
  { label: 'Frenzy x3',        color: '#f59e0b', payload: { type: 'CLICK_FRENZY' } },
  { label: 'Auto-Click Storm', color: '#f59e0b', payload: { type: 'GOLDEN_RAIN' } },
  { label: 'Chaos Mode',       color: '#a855f7', payload: { type: 'CHAOS_MODE' } },
  { label: 'Boss Cookie',      color: '#ef4444', payload: { type: 'BOSS' } },
  { label: 'World Reset',      color: '#ef4444', payload: { type: 'WORLD_RESET' } },
  { label: 'Army',             color: '#3b82f6', payload: { type: 'ARMY' } },
];

export function ControlPage() {
  const [feedback, setFeedback] = useState('');

  return (
    <div className="control-page">
      {feedback && (
        <div className="control-toast">
          {feedback}
        </div>
      )}

      <div className="control-hero">
        <p>Stream Control</p>
        <h1>Trigger Stream Rewards</h1>
        <code>{API}</code>
      </div>

      <section className="control-panel">
        <div className="control-section-title">Super Chat</div>
        <div className="reward-grid five">
          {SUPERCHATS.map(b => (
            <button
              key={b.label}
              onClick={() => fire(b.payload, setFeedback)}
              className="reward-button"
              style={{ background: b.color + '33', border: `2px solid ${b.color}88`, color: b.color }}
            >
              {b.label}
            </button>
          ))}
        </div>
      </section>

      <section className="control-panel">
        <div className="control-section-title">Jewels</div>
        <div className="reward-grid three">
          {JEWELS.map(b => (
            <button
              key={b.label}
              onClick={() => fire(b.payload, setFeedback)}
              className="reward-button"
              style={{ background: b.color + '22', border: `2px solid ${b.color}66`, color: b.color }}
            >
              {b.label}
            </button>
          ))}
        </div>
      </section>

      <section className="control-panel">
        <div className="control-section-title">Events</div>
        <div className="reward-grid two">
          {OTHERS.map(b => (
            <button
              key={b.label}
              onClick={() => fire(b.payload, setFeedback)}
              className="reward-button compact"
              style={{ background: b.color + '22', border: `2px solid ${b.color}55`, color: b.color }}
            >
              {b.label}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
