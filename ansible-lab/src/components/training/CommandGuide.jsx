import React, { useState } from 'react';
import { Terminal, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';

export default function CommandGuide({ commands, label = 'Command Guide', defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const [copied, setCopied] = useState(null);
  if (!commands?.length) return null;

  const copy = (cmd, i) => {
    navigator.clipboard?.writeText(cmd);
    setCopied(i); setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div>
      <button onClick={() => setOpen(!open)} className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-300 transition-colors">
        <Terminal className="w-3 h-3" />
        <span>{label}</span>
        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          {commands.map((step, i) => (
            <div key={i} className="rounded border border-neutral-800 bg-neutral-900/60 p-2">
              <div className="flex items-center justify-between gap-2 mb-1">
                <code className="text-[11px] text-primary font-mono break-all">{step.cmd}</code>
                <button onClick={() => copy(step.cmd, i)} className="shrink-0 text-neutral-600 hover:text-neutral-300" title="Copy">
                  {copied === i ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
              <p className="text-[10px] text-neutral-400 leading-relaxed">{step.why}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
