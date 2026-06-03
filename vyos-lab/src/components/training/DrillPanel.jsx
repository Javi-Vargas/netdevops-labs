import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { drillTopics, generateDrill } from '@/lib/drills';
import { stateFromCommands } from '@/lib/vyosEngine';
import { Zap, Flame, ChevronRight, Eye, RotateCcw, CheckCircle2, Terminal } from 'lucide-react';

export default function DrillPanel({ engineState, onLoadScenario }) {
  const [topicId, setTopicId] = useState('interfaces');
  const [current, setCurrent] = useState(null);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);
  const [solved, setSolved] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const load = (tid) => {
    const drill = generateDrill(tid);
    setCurrent(drill);
    setSolved(false);
    setRevealed(false);
    onLoadScenario(stateFromCommands(drill.initialCommands || []));
  };

  // Auto-grade against the committed running config whenever it changes.
  useEffect(() => {
    if (!current || solved || !engineState) return;
    let pass = false;
    try { pass = current.check(engineState); } catch { pass = false; }
    if (pass) {
      setSolved(true);
      setStreak(s => { const n = s + 1; setBest(b => Math.max(b, n)); return n; });
    }
  }, [engineState, current, solved]);

  const next = () => load(topicId);
  const showAnswer = () => { setRevealed(true); setStreak(0); };
  const selectTopic = (tid) => { setTopicId(tid); load(tid); };

  return (
    <div className="p-3 space-y-3">
      {/* Topic selector */}
      <div className="grid grid-cols-4 gap-1">
        {drillTopics.map(t => (
          <button
            key={t.id}
            onClick={() => selectTopic(t.id)}
            className={`py-1 text-[10px] rounded font-medium transition-colors ${topicId === t.id ? 'bg-accent/20 text-accent' : 'bg-slate-800/50 text-slate-400 hover:text-slate-200'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Streak */}
      <div className="flex items-center justify-between text-[10px]">
        <span className="flex items-center gap-1 text-amber-400"><Flame className="w-3.5 h-3.5" /> Streak: {streak}</span>
        <span className="text-slate-500">Best: {best}</span>
      </div>

      {!current ? (
        <div className="text-center py-6">
          <Zap className="w-6 h-6 text-accent mx-auto mb-2" />
          <p className="text-xs text-slate-400 mb-3">Rapid-fire practice. Type the commands in the terminal and <code className="text-primary">commit</code> — the drill auto-checks.</p>
          <Button size="sm" onClick={() => load(topicId)} className="bg-accent hover:bg-accent/80 text-white text-xs h-7">
            Start drilling
          </Button>
        </div>
      ) : (
        <>
          {/* Task */}
          <div className={`rounded-lg border p-3 ${solved ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-accent/20 bg-accent/5'}`}>
            <div className="flex items-start gap-2">
              {solved
                ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                : <Terminal className="w-4 h-4 text-accent shrink-0 mt-0.5" />}
              <p className="text-xs text-slate-200 leading-relaxed">{current.prompt}</p>
            </div>
            <p className="text-[10px] text-slate-500 mt-2 pl-6">Hint: <code className="text-slate-400">{current.hint}</code></p>
            {current.verifyWith && (
              <p className="text-[10px] text-slate-500 mt-1 pl-6">Verify: <code className="text-slate-400">{current.verifyWith}</code></p>
            )}
          </div>

          {solved && (
            <div className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
              ✓ Correct! Streak {streak}.
            </div>
          )}

          {revealed && (
            <div className="rounded border border-slate-800 bg-slate-900/60 p-2">
              <p className="text-[10px] text-slate-500 mb-1">Answer:</p>
              {current.solution.map((c, i) => (
                <code key={i} className="block text-[11px] text-primary font-mono">{c}</code>
              ))}
              <code className="block text-[11px] text-slate-500 font-mono mt-1">commit</code>
            </div>
          )}

          {/* Controls */}
          <div className="flex gap-2">
            <Button size="sm" onClick={next} className="bg-accent hover:bg-accent/80 text-white text-xs h-7 flex-1">
              {solved ? 'Next question' : 'Skip'} <ChevronRight className="w-3 h-3 ml-1" />
            </Button>
            {!solved && (
              <Button size="sm" variant="outline" onClick={showAnswer} className="text-xs h-7 border-slate-700 text-slate-400 hover:text-white">
                <Eye className="w-3 h-3 mr-1" /> Answer
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => { setStreak(0); load(topicId); }} className="text-xs h-7 border-slate-700 text-slate-400 hover:text-white" title="Reset board">
              <RotateCcw className="w-3 h-3" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
