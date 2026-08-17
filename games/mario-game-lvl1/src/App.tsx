import { useEffect, useMemo, useRef, useState } from "react";
import { Game, type GameState, type StatePayload } from "./game/game";
import { AudioEngine } from "./game/audio";
import type { TouchControl } from "./game/input";

/* ---------------- local high scores ---------------- */
interface ScoreEntry {
  name: string;
  score: number;
  date: number;
}
const SCORES_KEY = "spp-highscores-v1";
const NAME_KEY = "spp-name";

function loadScores(): ScoreEntry[] {
  try {
    const raw = localStorage.getItem(SCORES_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as ScoreEntry[];
    return Array.isArray(arr) ? arr.filter((e) => typeof e?.score === "number") : [];
  } catch {
    return [];
  }
}

function saveScore(name: string, score: number): ScoreEntry[] {
  const list = [...loadScores(), { name, score, date: Date.now() }]
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
  try {
    localStorage.setItem(SCORES_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
  return list;
}

function qualifies(score: number): boolean {
  if (score <= 0) return false;
  const list = loadScores();
  return list.length < 8 || score > list[list.length - 1].score;
}

const pad = (n: number) => String(n).padStart(7, "0");

/* ---------------- small components ---------------- */

function ScoreTable({
  scores,
  highlight,
}: {
  scores: ScoreEntry[];
  highlight?: { name: string; score: number } | null;
}) {
  if (scores.length === 0) {
    return (
      <p className="text-[9px] text-white/50 text-center py-2">
        NO SCORES YET — SET THE FIRST ONE!
      </p>
    );
  }
  return (
    <div className="w-full">
      <div className="flex justify-between text-[8px] text-sky-300/80 pb-1 border-b-2 border-white/10 mb-1">
        <span>#</span>
        <span className="flex-1 text-center">NAME</span>
        <span>SCORE</span>
      </div>
      {scores.map((s, i) => {
        const isNew = highlight && s.name === highlight.name && s.score === highlight.score;
        return (
          <div
            key={i}
            className={`flex justify-between text-[9px] py-1 ${isNew ? "text-yellow-300 anim-blink" : "text-white/85"}`}
          >
            <span className="w-6">{i + 1}.</span>
            <span className="flex-1 text-center">{s.name}</span>
            <span>{pad(s.score)}</span>
          </div>
        );
      })}
    </div>
  );
}

function SaveScoreBox({
  score,
  onSaved,
}: {
  score: number;
  onSaved: (entries: ScoreEntry[]) => void;
}) {
  const [name, setName] = useState(() => {
    try {
      return localStorage.getItem(NAME_KEY) || "ACE";
    } catch {
      return "ACE";
    }
  });
  const save = () => {
    const nm = (name.trim().toUpperCase() || "ACE").slice(0, 8);
    try {
      localStorage.setItem(NAME_KEY, nm);
    } catch {
      /* ignore */
    }
    onSaved(saveScore(nm, score));
  };
  return (
    <div className="flex flex-col items-center gap-2 my-2">
      <p className="text-[11px] text-yellow-300 anim-blink">★ NEW HIGH SCORE! ★</p>
      <div className="flex gap-2 w-full justify-center">
        <input
          value={name}
          maxLength={8}
          autoFocus
          onChange={(e) =>
            setName(e.target.value.toUpperCase().replace(/[^A-Z0-9 !?.'\-]/g, ""))
          }
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              save();
            }
          }}
          className="w-36 bg-black/40 border-[3px] border-sky-500/60 text-center text-[11px] text-white px-2 py-2 outline-none focus:border-yellow-300 uppercase"
          placeholder="NAME"
        />
        <button className="pxbtn" onClick={save}>
          SAVE
        </button>
      </div>
    </div>
  );
}

function CountUp({ value, duration = 1.1 }: { value: number; duration?: number }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / (duration * 1000));
      setN(Math.round(value * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <>{pad(n)}</>;
}

function KeyChip({ label }: { label: string }) {
  return (
    <span className="inline-block px-1.5 py-1 bg-white/10 border-2 border-white/25 text-[8px] text-white/90">
      {label}
    </span>
  );
}

/* ---------------- touch controls ---------------- */
function TouchControls({
  onControl,
  onEnsureAudio,
}: {
  onControl: (c: TouchControl, active: boolean) => void;
  onEnsureAudio: () => void;
}) {
  const bind = (c: TouchControl) => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      onEnsureAudio();
      onControl(c, true);
    },
    onPointerUp: () => onControl(c, false),
    onPointerCancel: () => onControl(c, false),
    onPointerLeave: () => onControl(c, false),
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  });
  return (
    <div className="absolute inset-x-0 bottom-0 z-20 flex items-end justify-between p-2 sm:p-3 pointer-events-none select-none">
      <div className="flex gap-2 sm:gap-3 pointer-events-auto">
        <button
          className="touchbtn w-14 h-14 sm:w-16 sm:h-16 text-base"
          aria-label="Move left"
          {...bind("left")}
        >
          ◀
        </button>
        <button
          className="touchbtn w-14 h-14 sm:w-16 sm:h-16 text-base"
          aria-label="Move right"
          {...bind("right")}
        >
          ▶
        </button>
      </div>
      <div className="flex items-end gap-2 sm:gap-3 pointer-events-auto">
        <button
          className="touchbtn w-11 h-11 sm:w-13 sm:h-13 text-[10px] mb-2"
          aria-label="Run"
          {...bind("run")}
        >
          B
        </button>
        <button
          className="touchbtn w-16 h-16 sm:w-20 sm:h-20 text-xs"
          aria-label="Jump"
          {...bind("jump")}
        >
          A
        </button>
      </div>
    </div>
  );
}

/* ---------------- app ---------------- */
export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const audioRef = useRef<AudioEngine | null>(null);
  const [screen, setScreen] = useState<GameState>("menu");
  const [payload, setPayload] = useState<StatePayload | null>(null);
  const [muted, setMuted] = useState(false);
  const [scores, setScores] = useState<ScoreEntry[]>(() => loadScores());
  const [saved, setSaved] = useState(false);
  const [savedEntry, setSavedEntry] = useState<{ name: string; score: number } | null>(null);

  const isTouch = useMemo(
    () =>
      typeof window !== "undefined" &&
      ("ontouchstart" in window || navigator.maxTouchPoints > 0),
    []
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const audio = new AudioEngine();
    audioRef.current = audio;
    setMuted(audio.muted);
    const game = new Game(
      canvas,
      {
        onState: (s, p) => {
          setScreen(s);
          if (p) setPayload(p);
          if (s === "gameover" || s === "victory") {
            setSaved(false);
            setSavedEntry(null);
          }
        },
        onMute: setMuted,
      },
      audio,
      isTouch
    );
    gameRef.current = game;
    if (document.fonts?.load) {
      document.fonts.load('8px "Press Start 2P"').catch(() => {});
      document.fonts.load('16px "Press Start 2P"').catch(() => {});
    }
    const unlock = () => audio.ensure();
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    const onVis = () => {
      if (document.hidden) game.pause();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      document.removeEventListener("visibilitychange", onVis);
      game.destroy();
      gameRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* overlay keyboard shortcuts */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const g = gameRef.current;
      if (!g) return;
      if ((e.target as HTMLElement)?.tagName === "INPUT") return;
      if (screen === "menu" && (e.code === "Enter" || e.code === "Space")) {
        e.preventDefault();
        g.start();
      } else if (
        screen === "paused" &&
        (e.code === "KeyP" || e.code === "Escape" || e.code === "Enter")
      ) {
        g.resume();
      } else if (screen === "gameover" && (e.code === "KeyR" || e.code === "Enter")) {
        g.start();
      } else if (screen === "victory" && e.code === "Enter") {
        g.start();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [screen]);

  const start = () => gameRef.current?.start();
  const resume = () => gameRef.current?.resume();
  const quit = () => gameRef.current?.quitToMenu();
  const toggleMute = () => {
    const a = audioRef.current;
    if (!a) return;
    a.ensure();
    setMuted(a.toggleMuted());
  };
  const onControl = (c: TouchControl, active: boolean) =>
    gameRef.current?.input.setTouch(c, active);

  const canSave =
    payload !== null && !saved && qualifies(payload.score);

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center gap-2 px-2 py-3 bg-[radial-gradient(ellipse_at_top,#1b2b66_0%,#0a1029_55%,#05081a_100%)]">
      {/* header */}
      <div className="w-full flex items-center justify-between pb-1" style={{ width: "min(100%, 960px, calc(72vh * 1.7778))" }}>
        <span className="text-[8px] sm:text-[9px] text-sky-300/70 tracking-widest">
          SUPER PIXEL PLUMBER
        </span>
        <button
          onClick={toggleMute}
          className="text-[8px] sm:text-[9px] text-sky-300/70 hover:text-white tracking-widest cursor-pointer"
          aria-label="Toggle sound"
        >
          SOUND: {muted ? "OFF" : "ON"}
        </button>
      </div>

      {/* game frame */}
      <div
        className="relative rounded-md overflow-hidden border-4 border-[#0c1436] shadow-[0_0_0_3px_#2b4bce,0_18px_50px_rgba(0,0,0,0.6)]"
        style={{ width: "min(100%, 960px, calc(72vh * 1.7778))", aspectRatio: "480 / 270" }}
      >
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full [image-rendering:pixelated] bg-[#5c94fc]"
        />
        <div className="scanlines absolute inset-0" />
        <div className="vignette absolute inset-0" />

        {/* in-game top buttons */}
        {screen === "playing" && (
          <div className="absolute top-2 right-2 z-20 flex gap-2">
            <button
              onClick={() => gameRef.current?.pause()}
              className="w-8 h-8 sm:w-9 sm:h-9 bg-black/35 border-2 border-white/30 text-white/90 text-[9px] hover:bg-black/55 cursor-pointer"
              aria-label="Pause"
            >
              ❚❚
            </button>
          </div>
        )}

        {/* touch controls */}
        {isTouch && (screen === "playing" || screen === "flag") && (
          <TouchControls onControl={onControl} onEnsureAudio={() => audioRef.current?.ensure()} />
        )}

        {/* ---------- START SCREEN ---------- */}
        {screen === "menu" && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#04081c]/55 anim-fade-in overflow-y-auto">
            <div className="pixel-panel anim-pop-in w-[min(94%,430px)] max-h-full overflow-y-auto scroll-thin text-center px-4 py-5 sm:px-7 sm:py-6">
              <h1 className="game-title text-[clamp(18px,4.6vw,30px)] leading-snug">
                SUPER
                <br />
                PIXEL
                <br />
                PLUMBER
              </h1>
              <p className="text-[9px] sm:text-[10px] text-sky-300 mt-3 tracking-widest">
                ★ WORLD 1-1 ★
              </p>

              <button className="pxbtn mt-5 w-full sm:w-auto" onClick={start}>
                ▶ START GAME
              </button>
              <p className="text-[7px] text-white/45 mt-2">
                {isTouch ? "OR TAP A ON THE GAME PAD" : "PRESS ENTER"}
              </p>

              <div className="mt-4 text-[8px] text-white/70 leading-5">
                {isTouch ? (
                  <p>
                    <KeyChip label="◀ ▶" /> MOVE · <KeyChip label="B" /> RUN · <KeyChip label="A" /> JUMP
                  </p>
                ) : (
                  <p>
                    <KeyChip label="←→" /> MOVE · <KeyChip label="SPACE" /> JUMP ·{" "}
                    <KeyChip label="SHIFT" /> RUN
                    <br />
                    <KeyChip label="P" /> PAUSE · <KeyChip label="M" /> MUTE
                  </p>
                )}
                <p className="mt-2 text-white/50">
                  STOMP BADDIES · GRAB MUSHROOMS · REACH THE FLAG!
                </p>
              </div>

              <div className="mt-4 border-t-2 border-white/10 pt-3">
                <p className="text-[9px] text-yellow-300 mb-2 tracking-widest">HIGH SCORES</p>
                <ScoreTable scores={scores.slice(0, 5)} />
              </div>
            </div>
          </div>
        )}

        {/* ---------- PAUSE ---------- */}
        {screen === "paused" && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#04081c]/70 anim-fade-in overflow-y-auto">
            <div className="pixel-panel anim-pop-in w-[min(90%,360px)] max-h-full overflow-y-auto scroll-thin text-center px-6 py-6">
              <h2 className="text-[16px] text-sky-300 mb-4 tracking-widest">PAUSED</h2>
              {payload && (
                <p className="text-[9px] text-white/70 leading-6 mb-3">
                  SCORE {pad(payload.score)}
                  <br />× {payload.coins} COINS
                </p>
              )}
              <div className="flex flex-col gap-3">
                <button className="pxbtn" onClick={resume}>
                  ▶ RESUME
                </button>
                <button className="pxbtn pxbtn-blue" onClick={start}>
                  ↻ RESTART
                </button>
                <button className="pxbtn pxbtn-ghost" onClick={quit}>
                  ☰ MENU
                </button>
                <button className="pxbtn pxbtn-ghost" onClick={toggleMute}>
                  {muted ? "🔇 SOUND OFF" : "🔊 SOUND ON"}
                </button>
              </div>
              <p className="text-[7px] text-white/40 mt-4">PRESS ESC / P TO RESUME</p>
            </div>
          </div>
        )}

        {/* ---------- GAME OVER ---------- */}
        {screen === "gameover" && payload && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#0a0208]/75 anim-fade-in overflow-y-auto">
            <div className="pixel-panel anim-pop-in w-[min(92%,430px)] max-h-full overflow-y-auto scroll-thin text-center px-5 py-6">
              <h2 className="text-[clamp(16px,4vw,24px)] text-red-400 mb-3 [text-shadow:0_3px_0_#5a0000]">
                GAME OVER
              </h2>
              <p className="text-[10px] text-white/80">
                SCORE <span className="text-yellow-300">{pad(payload.score)}</span>
              </p>
              <p className="text-[8px] text-white/50 mt-1">× {payload.coins} COINS</p>

              {canSave ? (
                <SaveScoreBox
                  score={payload.score}
                  onSaved={(entries) => {
                    setScores(entries);
                    setSaved(true);
                    const newest = entries.reduce((a, b) => (b.date > a.date ? b : a), entries[0]);
                    setSavedEntry({ name: newest.name, score: newest.score });
                  }}
                />
              ) : (
                <div className="mt-3 border-t-2 border-white/10 pt-3">
                  <p className="text-[9px] text-yellow-300 mb-2 tracking-widest">HIGH SCORES</p>
                  <ScoreTable scores={scores} highlight={savedEntry} />
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 mt-4 justify-center">
                <button className="pxbtn" onClick={start}>
                  ↻ PLAY AGAIN
                </button>
                <button className="pxbtn pxbtn-ghost" onClick={quit}>
                  ☰ MENU
                </button>
              </div>
              {!isTouch && <p className="text-[7px] text-white/40 mt-3">PRESS R FOR INSTANT RESTART</p>}
            </div>
          </div>
        )}

        {/* ---------- VICTORY ---------- */}
        {screen === "victory" && payload && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#04081c]/45 anim-fade-in overflow-y-auto">
            <div className="pixel-panel anim-pop-in w-[min(92%,450px)] max-h-full overflow-y-auto scroll-thin text-center px-5 py-6">
              <h2 className="text-[clamp(14px,3.6vw,22px)] text-yellow-300 mb-3 [text-shadow:0_3px_0_#7a3d00]">
                ★ COURSE CLEAR! ★
              </h2>
              <div className="text-[10px] leading-7 text-white/90 mb-3">
                <p>
                  SCORE <span className="text-white"><CountUp value={payload.baseScore} /></span>
                </p>
                <p>
                  TIME BONUS{" "}
                  <span className="text-sky-300">
                    +{pad(payload.timeBonus)}
                  </span>
                </p>
                <p className="text-yellow-300 text-[12px]">
                  TOTAL <CountUp value={payload.score} duration={1.6} />
                </p>
              </div>

              {canSave ? (
                <SaveScoreBox
                  score={payload.score}
                  onSaved={(entries) => {
                    setScores(entries);
                    setSaved(true);
                    const newest = entries.reduce((a, b) => (b.date > a.date ? b : a), entries[0]);
                    setSavedEntry({ name: newest.name, score: newest.score });
                  }}
                />
              ) : (
                <div className="mt-2 border-t-2 border-white/10 pt-3">
                  <p className="text-[9px] text-yellow-300 mb-2 tracking-widest">HIGH SCORES</p>
                  <ScoreTable scores={scores} highlight={savedEntry} />
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3 mt-4 justify-center">
                <button className="pxbtn" onClick={start}>
                  ↻ PLAY AGAIN
                </button>
                <button className="pxbtn pxbtn-ghost" onClick={quit}>
                  ☰ MENU
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* footer */}
      <p className="text-[7px] sm:text-[8px] text-white/35 text-center leading-relaxed pt-1">
        {isTouch
          ? "TOUCH: ◀ ▶ MOVE · A JUMP (HOLD = HIGHER) · B RUN — STOMP ENEMIES FOR COMBOS!"
          : "ARROWS / WASD MOVE · SPACE JUMP · SHIFT RUN · P PAUSE · M MUTE — CHAIN STOMPS FOR COMBOS!"}
      </p>
    </div>
  );
}
