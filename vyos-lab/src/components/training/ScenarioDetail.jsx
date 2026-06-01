import React from 'react';
import { Button } from '@/components/ui/button';
import { RotateCcw, Play, CheckCircle2, Circle, Wrench } from 'lucide-react';
import CommandGuide from './CommandGuide';

export default function ScenarioDetail({ scenario, validationResults, labStarted, onStart, onReset }) {
  const allPassed = validationResults?.length > 0 && validationResults.every(r => r.pass);
  const isTrouble = scenario.category === 'troubleshoot';

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2">
          {isTrouble && <Wrench className="w-4 h-4 text-amber-400 shrink-0" />}
          <h2 className="text-base font-semibold text-white">{scenario.title}</h2>
        </div>
        <p className="text-xs text-slate-400 mt-1 leading-relaxed">{scenario.description}</p>
      </div>

      {scenario.brief && (
        <div className={`text-[11px] leading-relaxed rounded p-2 border ${isTrouble ? 'text-amber-300/90 bg-amber-500/5 border-amber-500/15' : 'text-accent/90 bg-accent/5 border-accent/15'}`}>
          {scenario.brief}
        </div>
      )}

      <div className="flex gap-2">
        <Button size="sm" onClick={onStart} className="bg-accent hover:bg-accent/80 text-white text-xs h-7">
          <Play className="w-3 h-3 mr-1" /> {labStarted ? 'Restart Lab' : 'Start Lab'}
        </Button>
        <Button size="sm" variant="outline" onClick={onReset} className="text-xs h-7 border-border/50 text-slate-400 hover:text-white">
          <RotateCcw className="w-3 h-3 mr-1" /> Reset
        </Button>
      </div>

      <div>
        <h3 className="text-xs font-medium text-slate-300 uppercase tracking-wider mb-2">Objectives</h3>
        <div className="space-y-1.5">
          {scenario.objectives.map((obj, i) => {
            const passed = validationResults?.[i]?.pass;
            return (
              <div key={i} className="flex items-start gap-2">
                {labStarted
                  ? (passed ? <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0 text-emerald-400" /> : <Circle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-slate-600" />)
                  : <Circle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-slate-700" />}
                <span className={`text-xs leading-relaxed ${passed ? 'text-emerald-400' : 'text-slate-400'}`}>{obj}</span>
              </div>
            );
          })}
        </div>
        {labStarted && !allPassed && (
          <p className="text-[10px] text-slate-500 mt-2">Tip: objectives check the committed config — run <code className="text-primary">commit</code> after your <code className="text-primary">set</code> commands.</p>
        )}
      </div>

      {allPassed && (
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
          <p className="text-xs text-emerald-400 font-medium">✓ Lab Complete! All objectives achieved.</p>
        </div>
      )}

      <CommandGuide commands={scenario.commands} label={isTrouble ? 'Hints / Fix Guide' : 'Command Guide'} />
    </div>
  );
}
