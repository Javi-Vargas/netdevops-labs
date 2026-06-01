import React, { useState, useCallback } from 'react';
import Terminal from '@/components/terminal/Terminal';
import StatusBar from '@/components/terminal/StatusBar';
import TrainingPanel from '@/components/training/TrainingPanel';
import { createDefaultState } from '@/lib/vyosEngine';
import { PanelRightClose, PanelRightOpen, Network } from 'lucide-react';

export default function Simulator() {
  const [engineState, setEngineState] = useState(createDefaultState);
  const [externalState, setExternalState] = useState(null);
  const [panelOpen, setPanelOpen] = useState(true);

  const handleStateChange = useCallback((s) => setEngineState(s), []);
  const handleLoadScenario = useCallback((s) => setExternalState({ ...s, _ts: Date.now() }), []);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden" style={{ backgroundColor: '#0b0f17' }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800/60" style={{ backgroundColor: '#070b12' }}>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/80" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
            <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
          </div>
          <div className="h-4 w-px bg-slate-700/50" />
          <span className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
            <Network className="w-3.5 h-3.5 text-accent" /> VyOS Lab — Router Simulator
          </span>
        </div>
        <button
          onClick={() => setPanelOpen(!panelOpen)}
          className="text-slate-500 hover:text-slate-300 transition-colors p-1"
          title={panelOpen ? 'Hide training panel' : 'Show training panel'}
        >
          {panelOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        <div className={`flex flex-col transition-all duration-300 relative ${panelOpen ? 'w-[68%]' : 'w-full'}`}>
          <div className="flex-1 overflow-hidden relative z-10">
            <Terminal onStateChange={handleStateChange} externalState={externalState} />
          </div>
          <StatusBar
            hostname={engineState.hostname}
            mode={engineState.mode}
            modified={engineState.modified}
            editLevel={engineState.editLevel}
          />
        </div>

        {panelOpen && (
          <div className="w-[32%] border-l border-slate-800/60 overflow-hidden">
            <TrainingPanel engineState={engineState} onLoadScenario={handleLoadScenario} />
          </div>
        )}
      </div>
    </div>
  );
}
