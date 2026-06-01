import React, { useState } from 'react';
import { renderCommands } from '@/lib/vyosEngine';
import { ChevronDown, ChevronUp, FileCode, AlertCircle } from 'lucide-react';

export default function ConfigTreePanel({ engineState }) {
  const [open, setOpen] = useState(true);
  if (!engineState) return null;

  const commands = renderCommands(engineState.running);
  const modified = engineState.modified;

  return (
    <div className="border-t border-slate-800/80">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-2 text-[11px] text-slate-400 hover:text-slate-200 transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <FileCode className="w-3.5 h-3.5" />
          Running config ({commands.length})
          {modified && <span className="flex items-center gap-1 text-amber-400 ml-1"><AlertCircle className="w-3 h-3" /> uncommitted</span>}
        </span>
        {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>
      {open && (
        <div className="max-h-44 overflow-y-auto terminal-scroll px-4 pb-2">
          {commands.length === 0 ? (
            <p className="text-[10px] text-slate-600">(empty configuration)</p>
          ) : (
            <pre className="text-[10px] leading-4 text-emerald-400/80 font-mono whitespace-pre-wrap">{commands.join('\n')}</pre>
          )}
        </div>
      )}
    </div>
  );
}
