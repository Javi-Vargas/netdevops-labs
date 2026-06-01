import React, { useState, useEffect, useRef, useCallback } from 'react';
import Terminal from '@/components/terminal/Terminal';
import StatusBar from '@/components/terminal/StatusBar';
import FileEditor from '@/components/editor/FileEditor';
import TrainingPanel from '@/components/training/TrainingPanel';
import { createDefaultState } from '@/lib/ansibleEngine';
import { writeFile } from '@/lib/vfs';
import { TerminalSquare, Files, PanelRightClose, PanelRightOpen, Boxes } from 'lucide-react';

const STORAGE_KEY = 'ansible-lab-state';

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const s = JSON.parse(saved);
      if (s && s.hosts && s.vfs) return s;
    }
  } catch { /* ignore */ }
  return createDefaultState();
}

export default function Simulator() {
  const [engineState, setEngineState] = useState(loadState);
  const [leftTab, setLeftTab] = useState('terminal');
  const [panelOpen, setPanelOpen] = useState(true);
  const [resetSignal, setResetSignal] = useState(0);
  const skipPersist = useRef(false);

  useEffect(() => {
    if (skipPersist.current) { skipPersist.current = false; return; }
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(engineState)); } catch { /* ignore */ }
  }, [engineState]);

  const handleStateChange = useCallback((state) => setEngineState(state), []);

  const handleSaveFile = useCallback((path, content) => {
    setEngineState(s => ({ ...s, vfs: writeFile(s.vfs, path, content) }));
  }, []);

  const handleLoadScenario = useCallback((setupState) => {
    setEngineState(setupState || createDefaultState());
    setResetSignal(n => n + 1);
  }, []);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden" style={{ backgroundColor: '#0a0a0a' }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-neutral-800" style={{ backgroundColor: '#111' }}>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/80" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
            <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
          </div>
          <div className="h-4 w-px bg-neutral-700" />
          <span className="flex items-center gap-1.5 text-xs text-neutral-400 font-mono">
            <Boxes className="w-3.5 h-3.5 text-primary" /> Ansible Lab — Control Node Simulator
          </span>
        </div>
        <button onClick={() => setPanelOpen(!panelOpen)} className="text-neutral-500 hover:text-neutral-300 transition-colors p-1" title={panelOpen ? 'Hide training panel' : 'Show training panel'}>
          {panelOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className={`flex flex-col transition-all duration-300 ${panelOpen ? 'w-[66%]' : 'w-full'}`}>
          {/* Left tabs */}
          <div className="flex items-center gap-1 px-3 py-1.5 border-b border-neutral-800" style={{ backgroundColor: '#0d0d0d' }}>
            <LeftTab active={leftTab === 'terminal'} onClick={() => setLeftTab('terminal')} icon={TerminalSquare} label="Terminal" />
            <LeftTab active={leftTab === 'files'} onClick={() => setLeftTab('files')} icon={Files} label="Files" />
          </div>
          <div className="flex-1 overflow-hidden">
            {leftTab === 'terminal'
              ? <Terminal engineState={engineState} onStateChange={handleStateChange} resetSignal={resetSignal} />
              : <FileEditor vfs={engineState.vfs} onSave={handleSaveFile} />}
          </div>
          <StatusBar hosts={engineState.hosts} />
        </div>

        {panelOpen && (
          <div className="w-[34%] border-l border-neutral-800 overflow-hidden">
            <TrainingPanel engineState={engineState} onLoadScenario={handleLoadScenario} />
          </div>
        )}
      </div>
    </div>
  );
}

function LeftTab({ active, onClick, icon: Icon, label }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-1.5 px-3 py-1 text-[11px] rounded font-medium transition-colors ${active ? 'bg-primary/15 text-primary' : 'text-neutral-500 hover:text-neutral-300'}`}>
      <Icon className="w-3.5 h-3.5" /> {label}
    </button>
  );
}
