import React, { useState, useEffect } from 'react';
import { Server, GitBranch, Clock, AlertCircle } from 'lucide-react';

export default function StatusBar({ hostname, mode, modified, editLevel }) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const modeLabel = mode === 'configuration' ? 'Configuration' : 'Operational';

  return (
    <div className="flex items-center justify-between px-4 py-1.5 border-t border-slate-800/80 text-[10px]" style={{ backgroundColor: '#070b12' }}>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-slate-400">{hostname}</span>
        </div>
        <div className={`flex items-center gap-1.5 ${mode === 'configuration' ? 'text-accent' : 'text-slate-400'}`}>
          <Server className="w-3 h-3" />
          <span>{modeLabel}</span>
        </div>
        {editLevel?.length > 0 && (
          <div className="flex items-center gap-1.5 text-cyan-400">
            <GitBranch className="w-3 h-3" />
            <span>[edit {editLevel.join(' ')}]</span>
          </div>
        )}
        {modified && (
          <div className="flex items-center gap-1.5 text-amber-400">
            <AlertCircle className="w-3 h-3" />
            <span>uncommitted changes</span>
          </div>
        )}
      </div>
      <div className="flex items-center gap-1.5 text-slate-500">
        <Clock className="w-3 h-3" />
        <span>{time.toLocaleTimeString()}</span>
      </div>
    </div>
  );
}
