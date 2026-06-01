import React, { useState, useMemo } from 'react';
import { tutorials } from '@/lib/tutorials';
import { troubleshootLabs } from '@/lib/troubleshoot';
import { referenceGuides } from '@/lib/reference';
import TutorialCard from './TutorialCard';
import TutorialDetail from './TutorialDetail';
import CommandGuide from './CommandGuide';
import HostStatePanel from './HostStatePanel';
import { GraduationCap, Wrench, Library, Boxes } from 'lucide-react';

const all = [...tutorials, ...troubleshootLabs];

export default function TrainingPanel({ engineState, onLoadScenario }) {
  const [tab, setTab] = useState('tutorials');
  const [activeId, setActiveId] = useState(null);
  const [labStarted, setLabStarted] = useState(false);

  const active = all.find(s => s.id === activeId);

  const validationResults = useMemo(() => {
    if (!active || !engineState || !labStarted) return null;
    try { return active.validation(engineState); } catch { return null; }
  }, [active, engineState, labStarted]);

  const start = () => { if (active) { onLoadScenario(active.setup()); setLabStarted(true); } };
  const reset = () => { onLoadScenario(null); setActiveId(null); setLabStarted(false); };
  const select = (id) => { setActiveId(id); setLabStarted(false); };

  return (
    <div className="h-full flex flex-col" style={{ backgroundColor: '#0d0d0d' }}>
      <div className="px-4 py-3 border-b border-neutral-800">
        <div className="flex items-center gap-2">
          <GraduationCap className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-neutral-200">Ansible Training</h2>
        </div>
        <p className="text-[10px] text-neutral-500 mt-1">Learn by doing: tutorials, troubleshooting, and a command reference.</p>
        {!active && (
          <div className="flex mt-2 gap-1">
            <Tab active={tab === 'tutorials'} onClick={() => setTab('tutorials')} icon={GraduationCap} label="Tutorials" />
            <Tab active={tab === 'troubleshoot'} onClick={() => setTab('troubleshoot')} icon={Wrench} label="Troubleshoot" />
            <Tab active={tab === 'reference'} onClick={() => setTab('reference')} icon={Library} label="Reference" />
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto terminal-scroll">
        {!active && tab === 'tutorials' && (
          <div className="p-3 space-y-2">
            {tutorials.map(s => <TutorialCard key={s.id} scenario={s} onClick={() => select(s.id)} />)}
          </div>
        )}
        {!active && tab === 'troubleshoot' && (
          <div className="p-3 space-y-2">
            <div className="text-[10px] text-amber-400/70 bg-amber-500/5 border border-amber-500/10 rounded p-2 leading-relaxed">
              Each lab boots a broken setup. Diagnose with ad-hoc commands and <code className="text-primary">--check</code>, fix it (often by editing files), and re-run.
            </div>
            {troubleshootLabs.map(s => <TutorialCard key={s.id} scenario={s} onClick={() => select(s.id)} />)}
          </div>
        )}
        {!active && tab === 'reference' && (
          <div className="p-3 space-y-4">
            {referenceGuides.map((g, i) => (
              <div key={i}>
                <h3 className="text-xs font-semibold text-neutral-300 mb-1">{g.topic}</h3>
                <p className="text-[10px] text-neutral-500 mb-2 leading-relaxed">{g.intro}</p>
                <CommandGuide commands={g.commands} label="Commands" defaultOpen={i === 0} />
              </div>
            ))}
          </div>
        )}
        {active && (
          <div className="p-4">
            <button onClick={() => { setActiveId(null); setLabStarted(false); }} className="text-[10px] text-neutral-500 hover:text-neutral-300 mb-3 flex items-center gap-1">
              ← Back to labs
            </button>
            <TutorialDetail scenario={active} validationResults={validationResults} labStarted={labStarted} onStart={start} onReset={reset} />
          </div>
        )}
      </div>

      <HostStatePanel hosts={engineState?.hosts} />

      <div className="px-4 py-2 border-t border-neutral-800">
        <div className="flex items-center gap-1.5 text-[10px] text-neutral-600">
          <Boxes className="w-3 h-3" /><span>Ansible Lab Simulator v1.0</span>
        </div>
      </div>
    </div>
  );
}

function Tab({ active, onClick, icon: Icon, label }) {
  return (
    <button onClick={onClick} className={`flex-1 flex items-center justify-center gap-1 py-1 text-[10px] rounded font-medium transition-colors ${active ? 'bg-primary/20 text-primary' : 'text-neutral-500 hover:text-neutral-300'}`}>
      <Icon className="w-3 h-3" /> {label}
    </button>
  );
}
