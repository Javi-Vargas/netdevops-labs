import React, { useState, useMemo } from 'react';
import { buildScenarios, troubleshootScenarios } from '@/lib/scenarios';
import { referenceGuides } from '@/lib/guides';
import { stateFromCommands } from '@/lib/vyosEngine';
import ScenarioCard from './ScenarioCard';
import ScenarioDetail from './ScenarioDetail';
import CommandGuide from './CommandGuide';
import ConfigTreePanel from './ConfigTreePanel';
import DrillPanel from './DrillPanel';
import { BookOpen, Wrench, Library, Network, Zap } from 'lucide-react';

const allScenarios = [...buildScenarios, ...troubleshootScenarios];

export default function TrainingPanel({ engineState, onLoadScenario }) {
  const [tab, setTab] = useState('build');
  const [activeScenarioId, setActiveScenarioId] = useState(null);
  const [labStarted, setLabStarted] = useState(false);

  const activeScenario = allScenarios.find(s => s.id === activeScenarioId);

  const validationResults = useMemo(() => {
    if (!activeScenario || !engineState || !labStarted) return null;
    try { return activeScenario.validation(engineState); } catch { return null; }
  }, [activeScenario, engineState, labStarted]);

  const handleStart = () => {
    if (!activeScenario) return;
    onLoadScenario(stateFromCommands(activeScenario.initialCommands || []));
    setLabStarted(true);
  };

  const handleReset = () => {
    onLoadScenario(stateFromCommands([]));
    setActiveScenarioId(null);
    setLabStarted(false);
  };

  const handleSelect = (id) => { setActiveScenarioId(id); setLabStarted(false); };

  return (
    <div className="h-full flex flex-col" style={{ backgroundColor: '#0a0f1a' }}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <Network className="w-4 h-4 text-accent" />
          <h2 className="text-sm font-semibold text-slate-200">VyOS Training</h2>
        </div>
        <p className="text-[10px] text-slate-500 mt-1">Practice VyOS configuration, fix broken setups, and look up commands.</p>
        {!activeScenario && (
          <div className="flex mt-2 gap-1">
            <TabButton active={tab === 'build'} onClick={() => setTab('build')} icon={BookOpen} label="Build" color="accent" />
            <TabButton active={tab === 'drill'} onClick={() => setTab('drill')} icon={Zap} label="Drill" color="sky" />
            <TabButton active={tab === 'troubleshoot'} onClick={() => setTab('troubleshoot')} icon={Wrench} label="Fix" color="amber" />
            <TabButton active={tab === 'reference'} onClick={() => setTab('reference')} icon={Library} label="Ref" color="emerald" />
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto terminal-scroll">
        {!activeScenario && tab === 'build' && (
          <div className="p-3 space-y-2">
            {buildScenarios.map(s => (
              <ScenarioCard key={s.id} scenario={s} isActive={false} onClick={() => handleSelect(s.id)} />
            ))}
          </div>
        )}

        {!activeScenario && tab === 'drill' && (
          <DrillPanel engineState={engineState} onLoadScenario={onLoadScenario} />
        )}

        {!activeScenario && tab === 'troubleshoot' && (
          <div className="p-3 space-y-2">
            <div className="text-[10px] text-amber-400/70 bg-amber-500/5 border border-amber-500/10 rounded p-2 leading-relaxed">
              Each lab boots with a broken configuration. Diagnose with <code className="text-primary">show</code> commands and fix it.
            </div>
            {troubleshootScenarios.map(s => (
              <ScenarioCard key={s.id} scenario={s} isActive={false} onClick={() => handleSelect(s.id)} />
            ))}
          </div>
        )}

        {!activeScenario && tab === 'reference' && (
          <div className="p-3 space-y-4">
            {referenceGuides.map((g, i) => (
              <div key={i}>
                <h3 className="text-xs font-semibold text-slate-300 mb-1">{g.topic}</h3>
                <p className="text-[10px] text-slate-500 mb-2 leading-relaxed">{g.intro}</p>
                <CommandGuide commands={g.commands} label="Show commands" defaultOpen={i === 0} />
              </div>
            ))}
          </div>
        )}

        {activeScenario && (
          <div className="p-4">
            <button
              onClick={() => { setActiveScenarioId(null); setLabStarted(false); }}
              className="text-[10px] text-slate-500 hover:text-slate-300 mb-3 flex items-center gap-1"
            >
              ← Back to labs
            </button>
            <ScenarioDetail
              scenario={activeScenario}
              validationResults={validationResults}
              labStarted={labStarted}
              onStart={handleStart}
              onReset={handleReset}
            />
          </div>
        )}
      </div>

      <ConfigTreePanel engineState={engineState} />

      <div className="px-4 py-2 border-t border-slate-800/80">
        <div className="flex items-center gap-1.5 text-[10px] text-slate-600">
          <Network className="w-3 h-3" />
          <span>VyOS Lab Simulator v1.0</span>
        </div>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, label, color }) {
  const colorMap = {
    accent: 'bg-accent/20 text-accent',
    sky: 'bg-sky-500/20 text-sky-400',
    amber: 'bg-amber-500/20 text-amber-400',
    emerald: 'bg-emerald-500/20 text-emerald-400',
  };
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-1 py-1 text-[10px] rounded font-medium transition-colors ${active ? colorMap[color] : 'text-slate-500 hover:text-slate-300'}`}
    >
      <Icon className="w-3 h-3" /> {label}
    </button>
  );
}
