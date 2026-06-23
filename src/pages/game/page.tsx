import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MousePointerClick, Heart, Leaf, Cog, Zap, Globe, Clock,
  type LucideIcon,
} from 'lucide-react';
import { useGameState, UPGRADES, getUpgradeCost } from '../../hooks/useGameState';
import { Progress } from '@/components/ui/progress';

const ICON_MAP: Record<string, LucideIcon> = {
  MousePointerClick, Heart, Leaf, Cog, Zap, Globe, Clock,
};

function formatNum(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + 'B';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return Math.floor(n).toString();
}

const GIFT_PRESETS = [
  { label: '$2',  amount: 2,  event: 'CLICK_FRENZY', desc: 'Frenzy x2 Â· 5 min' },
  { label: '$5',  amount: 5,  event: 'GOLDEN_RAIN',  desc: 'Auto-Click Storm Â· 10 min' },
  { label: '$10', amount: 10, event: 'CHAOS_MODE',   desc: 'Chaos Mode Â· 5 min' },
  { label: '$20', amount: 20, event: 'BOSS',         desc: 'Boss Cookie Â· 150 HP' },
  { label: '$50', amount: 50, event: 'WORLD_RESET',  desc: '+1x mult, CPS x3' },
];

const JEWEL_PRESETS = [
  { label: '20',   event: 'COOKIE_RAIN',  desc: '+250 Cookies' },
  { label: '50',   event: 'CLICK_FRENZY', desc: 'Frenzy x2 Â· 5 min' },
  { label: '100',  event: 'GOLDEN_RAIN',  desc: 'Auto-Click Storm Â· 10 min' },
  { label: '200',  event: 'CHAOS_MODE',   desc: 'Chaos Mode Â· 5 min' },
  { label: '500',  event: 'BOSS',         desc: 'Boss Cookie Â· 150 HP' },
  { label: '1000', event: 'WORLD_RESET',  desc: '+1x mult, CPS x3' },
];

export function GamePage() {
  const { state, handleClick, triggerEvent, buyUpgrade, displayCps } = useGameState();
  const [clicks, setClicks] = useState<{ id: string; x: number; y: number; val: number }[]>([]);
  const [rainItems, setRainItems] = useState<{ id: string; left: number; delay: number }[]>([]);
  const [panelTab, setPanelTab] = useState<'closed' | 'gifts' | 'upgrades'>('closed');
  const [lastBought, setLastBought] = useState<string | null>(null);
  const [hypeEvent, setHypeEvent] = useState<{ username: string; amount?: number; eventType: string } | null>(null);
  const [simName, setSimName] = useState("Viewer");
  const hypeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCookieClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    handleClick();
    const comboMult =
      state.comboCount >= 150 ? 2 :
      state.comboCount >= 75  ? 1.5 :
      state.comboCount >= 30  ? 1.25 :
      state.comboCount >= 10  ? 1.1 : 1;
    const val = (state.multiplier + state.permanentMultiplierBoost) * comboMult;
    const id = Math.random().toString(36).slice(2);
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setClicks(prev => [...prev, { id, x, y, val }]);
    setTimeout(() => setClicks(prev => prev.filter(c => c.id !== id)), 800);
  };

  useEffect(() => {
    const latest = state.eventFeed[0];
    if (latest?.name === 'Cookie Rain' && Date.now() - latest.timestamp < 1000) {
      const items = Array.from({ length: 50 }).map((_, i) => ({
        id: `${i}-${Math.random()}`,
        left: Math.random() * 100,
        delay: Math.random() * 2,
      }));
      setRainItems(items);
      setTimeout(() => setRainItems([]), 3000);
    }
  }, [state.eventFeed]);

  useEffect(() => {
    const source = new EventSource(`${window.location.origin}/api/stream/events`);

    source.onmessage = (message) => {
      try {
        const data = JSON.parse(message.data);
        const eventType = String(data.type || data.eventType || '').toUpperCase();

        if (!eventType || eventType === 'CONNECTED') return;

        const username = String(data.username || data.name || 'Viewer');
        const amount = typeof data.amount === 'number' ? data.amount : undefined;

        triggerEvent(eventType, username);

        if (eventType !== 'CHAT') {
          if (hypeTimeoutRef.current) clearTimeout(hypeTimeoutRef.current);
          setHypeEvent({ username, amount, eventType });
          hypeTimeoutRef.current = setTimeout(() => setHypeEvent(null), 5000);
        }
      } catch {
        // Ignore malformed stream payloads.
      }
    };

    return () => {
      source.close();
      if (hypeTimeoutRef.current) clearTimeout(hypeTimeoutRef.current);
    };
  }, [triggerEvent]);

  const handleBuyUpgrade = (id: string) => {
    buyUpgrade(id);
    setLastBought(id);
    setTimeout(() => setLastBought(null), 400);
  };

  const isChaos  = state.activeEvent?.type === 'CHAOS';
  const isBoss   = state.activeEvent?.type === 'BOSS';
  const isFrenzy = state.activeEvent?.id   === 'frenzy';
  const isArmy   = state.activeEvent?.type === 'ARMY';
  const effectiveMult = state.multiplier + state.permanentMultiplierBoost;
  const membershipStacks = Math.round(state.permanentCpsBonus / 0.1);

  return (
    <div className={`h-[100dvh] w-full flex justify-center bg-transparent ${isChaos ? 'animate-chaos' : ''}`}>
      <div className="w-full h-full flex flex-col relative bg-background shadow-2xl overflow-hidden">

        {/* WORLD RESET OVERLAY */}
        <AnimatePresence>
          {state.activeEvent?.type === 'RESET' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 flex items-center justify-center bg-black"
            >
              <motion.h1
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="font-display text-4xl text-white text-center px-4"
              >
                A NEW WORLD BEGINS
              </motion.h1>
            </motion.div>
          )}
        </AnimatePresence>

        {/* TOP BAR */}
        <div className="shrink-0 w-full border-b border-border bg-sidebar/90 backdrop-blur-sm px-4 pt-3 pb-2 z-40 relative">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold flex items-center gap-1.5 mb-0.5">
                COOKIES
                <span className="inline-flex items-center gap-0.5 text-[9px] text-green-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_4px_#22c55e]" />
                  SIM READY
                </span>
              </div>
              <div className="font-display text-4xl text-primary drop-shadow leading-none">
                {formatNum(state.cookies)}
              </div>
            </div>
            <div className="flex flex-col items-end gap-0.5 pt-0.5">
              <div className="font-mono text-sm font-bold text-white">
                {displayCps.toFixed(1)} <span className="text-[10px] text-muted-foreground">CPS</span>
              </div>
              <div className="font-display text-xl text-accent drop-shadow">
                x{effectiveMult.toFixed(1)}
              </div>
              {membershipStacks > 0 && (
                <div className="text-[10px] text-green-400 font-bold">
                  +{membershipStacks * 10}% CPS
                </div>
              )}
            </div>
          </div>
          {state.comboCount >= 10 && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2">
              <motion.div
                key={state.comboCount}
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className={`font-display text-xs px-3 py-0.5 rounded-full border font-bold ${
                  state.comboCount >= 75 ? 'bg-red-900/80 border-red-500 text-red-300' : 'bg-amber-900/80 border-amber-500 text-amber-300'
                }`}
              >
                {state.comboCount}x COMBO
              </motion.div>
            </div>
          )}
        </div>

        {/* COOKIE ZONE */}
        <div className="h-[360px] relative flex flex-col items-center justify-center overflow-hidden shrink-0">
          {rainItems.map(item => (
            <div
              key={item.id}
              className="cookie-rain-item z-10"
              style={{ left: `${item.left}%`, animationDelay: `${item.delay}s` }}
            />
          ))}

          <AnimatePresence>
            {state.activeEvent && state.activeEvent.type !== 'RESET' && (
              <motion.div
                initial={{ y: -80, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -80, opacity: 0 }}
                className="absolute top-4 z-30 pointer-events-none w-full px-6"
              >
                <div className={`
                  w-full font-display text-xl text-center px-4 py-2.5 rounded-xl shadow-2xl border-2 backdrop-blur-md
                  ${isBoss   ? 'bg-red-900/90 border-red-500 text-white animate-pulse' :
                    isChaos  ? 'bg-purple-800/90 border-purple-400 text-white animate-pulse' :
                    isArmy   ? 'bg-blue-900/90 border-blue-400 text-white' :
                               'bg-amber-600/90 border-amber-300 text-black'}
                `}>
                  {state.activeEvent.name}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* HYPE BANNER â€” shows when a real viewer sends Super Chat / Jewels */}
          <AnimatePresence>
            {hypeEvent && (
              <motion.div
                key={hypeEvent.username + hypeEvent.eventType}
                initial={{ y: 60, opacity: 0, scale: 0.9 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ y: 60, opacity: 0, scale: 0.9 }}
                className="absolute bottom-8 left-0 right-0 z-40 pointer-events-none flex justify-center"
              >
                <div className={`
                  mx-6 w-full rounded-2xl border-2 px-4 py-3 text-center shadow-2xl backdrop-blur-md
                  ${hypeEvent.eventType === 'BOSS' || hypeEvent.eventType === 'WORLD_RESET'
                    ? 'bg-red-900/90 border-red-400 text-white'
                    : hypeEvent.eventType === 'CHAOS_MODE' || hypeEvent.amount && hypeEvent.amount >= 200
                    ? 'bg-purple-900/90 border-purple-400 text-white'
                    : 'bg-amber-600/90 border-amber-300 text-black'}
                `}>
                  <div className="font-display text-2xl font-black leading-none">{hypeEvent.username}</div>
                  {hypeEvent.amount && (
                    <div className="text-sm font-bold mt-0.5 opacity-80">
                      {hypeEvent.eventType === 'jewels' ? `${hypeEvent.amount} Jewels` : `$${hypeEvent.amount}`}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* SIDE REWARDS PANEL */}
          <div className="absolute right-0 inset-y-0 w-[128px] bg-black/70 backdrop-blur-sm border-l border-white/10 z-20 flex flex-col py-2 px-2 overflow-hidden pointer-events-none">
            <div className="text-[8px] uppercase tracking-widest text-amber-400 font-black mb-1">Super Chat</div>
            {[
              { a: '$2',  c: 'text-blue-400',    e: 'Frenzy x2 5m' },
              { a: '$5',  c: 'text-green-400',   e: 'AutoClick 10m' },
              { a: '$10', c: 'text-yellow-400',  e: 'Chaos 5min' },
              { a: '$20', c: 'text-orange-400',  e: 'Boss Cookie' },
              { a: '$50', c: 'text-red-400',     e: 'World Reset' },
            ].map(r => (
              <div key={r.a} className="flex items-baseline gap-1 py-[2px]">
                <span className={`font-display font-black text-[11px] w-8 shrink-0 ${r.c}`}>{r.a}</span>
                <span className="text-[9px] text-white/50 leading-none truncate">{r.e}</span>
              </div>
            ))}
            <div className="my-1.5 border-t border-white/10" />
            <div className="text-[8px] uppercase tracking-widest text-purple-400 font-black mb-1">Jewels</div>
            {[
              { a: '20',   c: 'text-purple-300',  e: '+250 cookies' },
              { a: '50',   c: 'text-purple-300',  e: 'Frenzy x2 5m' },
              { a: '100',  c: 'text-purple-400',  e: 'AutoClick 10m' },
              { a: '200',  c: 'text-purple-400',  e: 'Chaos 5min' },
              { a: '500',  c: 'text-fuchsia-400', e: 'Boss Cookie' },
              { a: '1000', c: 'text-fuchsia-300', e: 'World Reset' },
            ].map(r => (
              <div key={r.a} className="flex items-baseline gap-1 py-[2px]">
                <span className={`font-display font-black text-[11px] w-9 shrink-0 ${r.c}`}>{r.a}</span>
                <span className="text-[9px] text-white/50 leading-none truncate">{r.e}</span>
              </div>
            ))}
          </div>

          <div className="relative mr-[104px]">
            <motion.div
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.93 }}
              onClick={handleCookieClick}
              data-testid="cookie-button"
              className="cursor-pointer rounded-full relative z-20 select-none w-[190px] h-[190px] border-[6px] border-[#5a2f12] shadow-[inset_-18px_-22px_0_rgba(83,39,13,0.26),inset_16px_18px_0_rgba(255,218,146,0.16),0_0_42px_rgba(217,119,6,0.28)] bg-[radial-gradient(circle_at_34%_28%,#f4c16d_0%,#c5792c_42%,#8f4f1d_100%)]"
            >
              <div className="absolute inset-0 rounded-full pointer-events-none opacity-55 bg-[radial-gradient(circle_at_30%_26%,rgba(255,255,255,0.35),transparent_32%)]" />
              {!isBoss && (
                <>
                  <div className="absolute top-9 left-12 w-6 h-6 rounded-full bg-[#3b1f12] shadow-[inset_3px_3px_0_rgba(255,255,255,0.08)] pointer-events-none" />
                  <div className="absolute top-[72px] right-11 w-8 h-8 rounded-full bg-[#2f180e] shadow-[inset_3px_3px_0_rgba(255,255,255,0.08)] pointer-events-none" />
                  <div className="absolute bottom-12 left-[58px] w-7 h-7 rounded-full bg-[#351b10] shadow-[inset_3px_3px_0_rgba(255,255,255,0.08)] pointer-events-none" />
                  <div className="absolute bottom-10 right-14 w-5 h-5 rounded-full bg-[#2f180e] shadow-[inset_3px_3px_0_rgba(255,255,255,0.08)] pointer-events-none" />
                  <div className="absolute top-[98px] left-[88px] w-5 h-5 rounded-full bg-[#3b1f12] shadow-[inset_3px_3px_0_rgba(255,255,255,0.08)] pointer-events-none" />
                  <div className="absolute top-14 left-[92px] w-4 h-4 rounded-full bg-[#2b160c] shadow-[inset_2px_2px_0_rgba(255,255,255,0.08)] pointer-events-none" />
                </>
              )}
            </motion.div>

            {isBoss && (state.activeEvent?.metadata?.hp ?? 0) > 0 && (
              <div className="absolute -bottom-14 left-1/2 -translate-x-1/2 w-52 z-30">
                <Progress
                  value={((state.activeEvent?.metadata?.hp ?? 0) / (state.activeEvent?.metadata?.maxHp ?? 1)) * 100}
                  className="h-4 bg-red-950 [&>div]:bg-red-500 border border-red-800"
                />
                <div className="text-center mt-1 text-xs font-mono text-red-400 font-bold">
                  {state.activeEvent?.metadata?.hp} / {state.activeEvent?.metadata?.maxHp} HP
                </div>
              </div>
            )}

            <AnimatePresence>
              {clicks.map(click => (
                <motion.div
                  key={click.id}
                  initial={{ opacity: 1, x: click.x - 20, y: click.y - 30 }}
                  animate={{ opacity: 0, y: click.y - 110 }}
                  exit={{ opacity: 0 }}
                  className="absolute pointer-events-none z-40 font-display text-2xl text-white drop-shadow-[0_3px_3px_rgba(0,0,0,0.9)]"
                >
                  +{formatNum(click.val)}
                </motion.div>
              ))}
            </AnimatePresence>

            {isArmy && Array.from({ length: 8 }).map((_, i) => (
              <motion.div
                key={i}
                className="absolute z-20 pointer-events-none"
                style={{ top: '50%', left: '50%', transform: `rotate(${i * 45}deg) translateY(-155px)` }}
              >
                <motion.div
                  className="w-0 h-0 border-l-[8px] border-r-[8px] border-b-[14px] border-l-transparent border-r-transparent border-b-white/80"
                  animate={{ scale: [1, 0.7, 1] }}
                  transition={{ repeat: Infinity, duration: 0.5, delay: i * 0.06 }}
                />
              </motion.div>
            ))}

            {/* â”€â”€ UPGRADE AURAS â”€â”€ */}
            {(() => {
              const cursorOwned   = state.upgradeCounts['cursor']      || 0;
              const grandmaOwned  = state.upgradeCounts['grandma']     || 0;
              const farmOwned     = state.upgradeCounts['farm']        || 0;
              const factoryOwned  = state.upgradeCounts['factory']     || 0;
              const labOwned      = state.upgradeCounts['lab']         || 0;
              const portalOwned   = state.upgradeCounts['portal']      || 0;
              const timeMachOwned = state.upgradeCounts['timemachine'] || 0;
              const visibleCursors = Math.min(cursorOwned, 8);
              const visibleGrandmas = Math.min(grandmaOwned, 4);

              return (
                <>
                  {/* Cursor orbit ring â€” shown whenever cursors owned & not during army */}
                  {visibleCursors > 0 && !isArmy && (
                    <div
                      className="absolute inset-0 pointer-events-none z-15"
                      style={{ animation: `orbit ${Math.max(5, 12 - visibleCursors)}s linear infinite` }}
                    >
                      {Array.from({ length: visibleCursors }).map((_, i) => (
                        <div
                          key={i}
                          className="absolute top-1/2 left-1/2"
                          style={{ transform: `rotate(${i * (360 / visibleCursors)}deg) translateY(-148px) translateX(-6px)` }}
                        >
                          <MousePointerClick
                            size={13}
                            style={{ color: '#3b82f6', filter: 'drop-shadow(0 0 5px #3b82f6)' }}
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Grandma hearts â€” static positions, pulse */}
                  {visibleGrandmas > 0 && Array.from({ length: visibleGrandmas }).map((_, i) => {
                    const angle = (i / visibleGrandmas) * 360 + 45;
                    const rad = (angle * Math.PI) / 180;
                    const r = 138;
                    return (
                      <motion.div
                        key={`gma-${i}`}
                        className="absolute pointer-events-none z-10"
                        style={{
                          top: '50%',
                          left: '50%',
                          marginTop: -8,
                          marginLeft: -8,
                          transform: `translate(${Math.cos(rad) * r}px, ${Math.sin(rad) * r}px)`,
                        }}
                        animate={{ scale: [1, 1.4, 1], opacity: [0.6, 1, 0.6] }}
                        transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.45 }}
                      >
                        <Heart size={14} style={{ color: '#ec4899', filter: 'drop-shadow(0 0 4px #ec4899)' }} fill="#ec4899" />
                      </motion.div>
                    );
                  })}

                  {/* Farm â€” leaves drift upward */}
                  {farmOwned > 0 && [0, 1, 2].map(i => (
                    <motion.div
                      key={`leaf-${i}`}
                      className="absolute pointer-events-none z-10"
                      style={{ bottom: '50%', left: `calc(50% + ${(i - 1) * 48}px)`, marginLeft: -6 }}
                      animate={{ y: [0, -90], opacity: [0, 0.9, 0], rotate: [0, i % 2 === 0 ? 25 : -25] }}
                      transition={{ duration: 2.2, repeat: Infinity, delay: i * 1.1, repeatDelay: 2.5 }}
                    >
                      <Leaf size={12} style={{ color: '#22c55e', filter: 'drop-shadow(0 0 3px #22c55e)' }} />
                    </motion.div>
                  ))}

                  {/* Factory â€” cog slowly spins behind cookie (outer glow only, non-intrusive) */}
                  {factoryOwned > 0 && (
                    <motion.div
                      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-5"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                    >
                      <Cog size={300} strokeWidth={0.3} style={{ color: '#f97316', opacity: 0.08 }} />
                    </motion.div>
                  )}

                  {/* Lab â€” zap sparks shoot out periodically */}
                  {labOwned > 0 && [0, 1].map(i => (
                    <motion.div
                      key={`zap-${i}`}
                      className="absolute pointer-events-none z-10"
                      style={{ top: '50%', left: '50%', marginTop: -8, marginLeft: -8 }}
                      animate={{
                        x: [0, (i === 0 ? 1 : -1) * (90 + Math.random() * 30)],
                        y: [0, -60 - i * 20],
                        opacity: [0, 1, 0],
                        scale: [0.5, 1.2, 0],
                      }}
                      transition={{ duration: 0.6, repeat: Infinity, delay: i * 1.3 + 0.5, repeatDelay: 2 }}
                    >
                      <Zap size={12} style={{ color: '#06b6d4', filter: 'drop-shadow(0 0 5px #06b6d4)' }} fill="#06b6d4" />
                    </motion.div>
                  ))}

                  {/* Portal â€” ring orbits counter-clockwise */}
                  {portalOwned > 0 && (
                    <div
                      className="absolute inset-0 pointer-events-none z-10"
                      style={{ animation: 'orbitReverse 4s linear infinite' }}
                    >
                      {[0, 1, 2].map(i => (
                        <div
                          key={i}
                          className="absolute top-1/2 left-1/2"
                          style={{ transform: `rotate(${i * 120}deg) translateY(-162px) translateX(-6px)` }}
                        >
                          <Globe size={11} style={{ color: '#a855f7', filter: 'drop-shadow(0 0 5px #a855f7)' }} />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Time Machine â€” clock pulses at center, subtle glow ring */}
                  {timeMachOwned > 0 && (
                    <motion.div
                      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-5 rounded-full"
                      animate={{ opacity: [0.05, 0.18, 0.05], scale: [0.95, 1.08, 0.95] }}
                      transition={{ duration: 3, repeat: Infinity }}
                      style={{ width: 260, height: 260, background: 'radial-gradient(circle, #eab308 0%, transparent 70%)' }}
                    />
                  )}
                </>
              );
            })()}
          </div>
        </div>

        {/* UPGRADES GRID */}
        <div className="shrink-0 w-full px-3 pt-3 pb-2 border-t border-border/40 bg-sidebar/30">
          <div className="text-[9px] text-muted-foreground uppercase tracking-widest font-bold mb-2 px-0.5">Upgrades</div>
          <div className="grid grid-cols-4 gap-2">
            {UPGRADES.map(def => {
              const owned  = state.upgradeCounts[def.id] || 0;
              const cost   = getUpgradeCost(def, owned);
              const canBuy = state.cookies >= cost;
              const Icon   = ICON_MAP[def.iconName] ?? Cog;
              const isBoughtFlash = lastBought === def.id;

              return (
                <motion.button
                  key={def.id}
                  onClick={() => handleBuyUpgrade(def.id)}
                  disabled={!canBuy}
                  data-testid={`upgrade-${def.id}`}
                  animate={isBoughtFlash ? { scale: [1, 1.15, 1] } : {}}
                  transition={{ duration: 0.25 }}
                  className={`
                    relative flex flex-col rounded-lg overflow-hidden border transition-all duration-150 select-none
                    ${canBuy
                      ? 'border-transparent cursor-pointer active:scale-95'
                      : 'border-border/30 opacity-40 cursor-not-allowed'}
                  `}
                  style={canBuy ? {
                    boxShadow: `0 0 12px ${def.color}55, 0 0 0 1.5px ${def.color}88`,
                  } : {}}
                >
                  {/* Icon zone */}
                  <div
                    className="w-full flex items-center justify-center py-3"
                    style={{ background: `${def.color}22` }}
                  >
                    <Icon size={26} style={{ color: def.color }} strokeWidth={1.5} />
                  </div>

                  {/* Info zone */}
                  <div className="flex flex-col items-center px-1 py-1.5 bg-black/30 gap-0.5">
                    <div className="text-[10px] font-bold text-white/90 leading-none truncate w-full text-center">
                      {def.name}
                    </div>
                    <div className="text-[9px] font-mono text-muted-foreground leading-none">
                      +{def.cpsPerUnit}/s
                    </div>
                    <div className={`text-[11px] font-display leading-none mt-0.5 ${canBuy ? 'text-white' : 'text-muted-foreground'}`}>
                      {formatNum(cost)}
                    </div>
                  </div>

                  {/* Owned badge */}
                  {owned > 0 && (
                    <div
                      className="absolute top-1 right-1 min-w-[18px] h-[18px] rounded-full flex items-center justify-center text-[9px] font-bold text-white px-1"
                      style={{ backgroundColor: def.color }}
                    >
                      {owned}
                    </div>
                  )}
                </motion.button>
              );
            })}
          </div>
        </div>


        {/* STREAM TEST PANEL */}
        <div className="absolute bottom-0 left-0 w-full z-50">
          <div className="bg-card border-t border-border shadow-[0_-8px_30px_rgba(0,0,0,0.6)]">

            {/* LATEST EVENT TICKER */}
            <div className="px-3 pt-2 pb-1.5 border-b border-border/40 h-8 flex items-center">
              {state.eventFeed[0] ? (
                <motion.div
                  key={state.eventFeed[0].id}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-1.5 w-full"
                >
                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    state.eventFeed[0].tier === 'HIGH' ? 'bg-red-500 shadow-[0_0_4px_red]' :
                    state.eventFeed[0].tier === 'MID'  ? 'bg-purple-500 shadow-[0_0_4px_purple]' :
                                                          'bg-amber-400 shadow-[0_0_4px_orange]'
                  }`} />
                  <span className="text-[9px] font-bold text-white/70 truncate">{state.eventFeed[0].name}</span>
                  {state.eventFeed[0].message && (
                    <span className="text-[8px] text-white/30 truncate">Â· {state.eventFeed[0].message}</span>
                  )}
                </motion.div>
              ) : (
                <span className="text-[8px] text-white/20 italic">No events yet</span>
              )}
            </div>

            {/* Tab bar */}
            <div className="flex border-b border-border/50">
              <button
                onClick={() => setPanelTab(t => t === 'gifts' ? 'closed' : 'gifts')}
                className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-colors ${panelTab === 'gifts' ? 'text-amber-400 bg-amber-500/10' : 'text-muted-foreground hover:text-white'}`}
              >
                {panelTab === 'gifts' ? 'â–¼' : 'â–²'} Simulator
              </button>
              <div className="w-px bg-border/50" />
              <button
                onClick={() => setPanelTab(t => t === 'upgrades' ? 'closed' : 'upgrades')}
                className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-colors ${panelTab === 'upgrades' ? 'text-purple-400 bg-purple-500/10' : 'text-muted-foreground hover:text-white'}`}
              >
                {panelTab === 'upgrades' ? 'â–¼' : 'â–²'} Events
              </button>
            </div>

            <AnimatePresence>
              {panelTab === 'gifts' && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="p-3 space-y-2">
                    <label className="block">
                      <span className="text-[9px] text-muted-foreground uppercase tracking-widest font-bold">Viewer name</span>
                      <input
                        value={simName}
                        onChange={(event) => setSimName(event.target.value)}
                        className="mt-1 w-full rounded bg-black/50 border border-white/10 px-2 py-1.5 text-xs text-white outline-none focus:border-red-400"
                        placeholder="Viewer"
                      />
                    </label>

                    {/* Chat spam */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => triggerEvent('CHAT')}
                        className="shrink-0 px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white text-[10px] font-bold rounded transition-colors"
                      >
                        Chat Msg
                      </button>
                      <span className="text-[9px] text-muted-foreground">Simulates one chat message clicking the cookie</span>
                    </div>

                    <div className="h-px bg-border/40" />

                    {/* Super chat presets */}
                    <div className="text-[9px] text-muted-foreground uppercase tracking-widest font-bold">YouTube Super Chat Tiers</div>
                    {GIFT_PRESETS.map(preset => (
                      <div key={preset.amount} className="flex items-center gap-2">
                        <button
                          onClick={() => triggerEvent(preset.event)}
                          className="shrink-0 w-14 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/40 text-[10px] font-bold rounded transition-colors"
                        >
                          {preset.label}
                        </button>
                        <span className="text-[10px] text-white/70 font-bold">{preset.desc}</span>
                      </div>
                    ))}

                    <div className="h-px bg-border/40" />

                    {/* Membership / gift subs */}
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => {
                          const username = simName.trim() || 'Viewer';
                          triggerEvent('SUBSCRIBER', username);
                          setHypeEvent({ username, eventType: 'SUBSCRIBER' });
                          setTimeout(() => setHypeEvent(null), 5000);
                        }}
                        className="py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 text-[10px] font-bold rounded transition-colors"
                      >
                        Subscriber
                      </button>
                      <button
                        onClick={() => {
                          const username = simName.trim() || 'Viewer';
                          triggerEvent('MEMBERSHIP', username);
                          setHypeEvent({ username, eventType: 'MEMBERSHIP' });
                          setTimeout(() => setHypeEvent(null), 5000);
                        }}
                        className="py-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/40 text-[10px] font-bold rounded transition-colors"
                      >
                        Channel Member
                      </button>
                      <button
                        onClick={() => {
                          const username = simName.trim() || 'Viewer';
                          triggerEvent('ARMY', username);
                          setHypeEvent({ username, eventType: 'ARMY' });
                          setTimeout(() => setHypeEvent(null), 5000);
                        }}
                        className="py-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/40 text-[10px] font-bold rounded transition-colors"
                      >
                        Gifted Members
                      </button>
                    </div>

                    <div className="h-px bg-border/40" />

                    {/* Jewel gifts */}
                    <div className="text-[9px] text-muted-foreground uppercase tracking-widest font-bold">Jewel Gifts</div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {JEWEL_PRESETS.map(p => (
                        <button
                          key={p.label}
                          onClick={() => triggerEvent(p.event)}
                          className="flex flex-col items-center py-1.5 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[9px] font-bold rounded transition-colors"
                        >
                          <span className="text-[10px]">{p.label}</span>
                          <span className="text-[8px] text-purple-500 font-normal leading-tight text-center">{p.desc}</span>
                        </button>
                      ))}
                    </div>

                  </div>
                </motion.div>
              )}

              {panelTab === 'upgrades' && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="p-3 grid grid-cols-2 gap-2">
                    <button onClick={() => triggerEvent('COOKIE_RAIN')} className="py-2 bg-amber-500/20 text-amber-400 border border-amber-500/40 text-[10px] font-bold rounded hover:bg-amber-500/30">
                      Cookie Rain
                      <div className="text-[8px] text-amber-600 font-normal mt-0.5">+250 cookies instantly</div>
                    </button>
                    <button onClick={() => triggerEvent('GOLDEN_RAIN')} className="py-2 bg-amber-500/20 text-amber-400 border border-amber-500/40 text-[10px] font-bold rounded hover:bg-amber-500/30">
                      Auto-Click Storm
                      <div className="text-[8px] text-amber-600 font-normal mt-0.5">15 second auto-clicks</div>
                    </button>
                    <button onClick={() => triggerEvent('CLICK_FRENZY')} className="py-2 bg-purple-500/20 text-purple-400 border border-purple-500/40 text-[10px] font-bold rounded hover:bg-purple-500/30">
                      Frenzy x3
                      <div className="text-[8px] text-purple-600 font-normal mt-0.5">3x multiplier Â· 8s</div>
                    </button>
                    <button onClick={() => triggerEvent('CHAOS_MODE')} className="py-2 bg-purple-500/20 text-purple-400 border border-purple-500/40 text-[10px] font-bold rounded hover:bg-purple-500/30">
                      Chaos Mode
                      <div className="text-[8px] text-purple-600 font-normal mt-0.5">Random mult Â· 20s</div>
                    </button>
                    <button onClick={() => triggerEvent('BOSS')} className="py-2 bg-red-500/20 text-red-400 border border-red-500/40 text-[10px] font-bold rounded hover:bg-red-500/30">
                      Boss Cookie
                      <div className="text-[8px] text-red-600 font-normal mt-0.5">200 HP Â· defeat for reward</div>
                    </button>
                    <button onClick={() => triggerEvent('WORLD_RESET')} className="py-2 bg-red-500/20 text-red-400 border border-red-500/40 text-[10px] font-bold rounded hover:bg-red-500/30">
                      World Reset
                      <div className="text-[8px] text-red-600 font-normal mt-0.5">+0.5x mult Â· CPS x2</div>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

      </div>
    </div>
  );
}
