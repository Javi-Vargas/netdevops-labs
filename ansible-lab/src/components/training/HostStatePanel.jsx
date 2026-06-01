import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Boxes, Package, Cog, CircleDot } from 'lucide-react';

export default function HostStatePanel({ hosts }) {
  const [open, setOpen] = useState(true);
  const list = hosts ? Object.values(hosts) : [];

  return (
    <div className="border-t border-neutral-800">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-4 py-2 text-[11px] text-neutral-400 hover:text-neutral-200 transition-colors">
        <span className="flex items-center gap-1.5"><Boxes className="w-3.5 h-3.5" /> Managed Hosts ({list.length})</span>
        {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>
      {open && (
        <div className="max-h-52 overflow-y-auto terminal-scroll px-3 pb-2 space-y-2">
          {list.map(h => {
            const running = Object.entries(h.services || {}).filter(([, s]) => s === 'started').map(([n]) => n);
            return (
              <div key={h.name} className="rounded border border-neutral-800 bg-neutral-900/50 p-2">
                <div className="flex items-center gap-1.5 mb-1">
                  <CircleDot className={`w-3 h-3 ${h.reachable === false ? 'text-red-400' : 'text-emerald-400'}`} />
                  <span className="text-[11px] font-mono text-neutral-200">{h.name}</span>
                  <span className="text-[9px] text-neutral-500">{h.facts?.ansible_distribution} {h.facts?.ansible_distribution_version}</span>
                  {h.reachable === false && <span className="text-[9px] text-red-400 ml-auto">unreachable</span>}
                </div>
                <div className="flex items-start gap-1.5 text-[10px] text-neutral-400">
                  <Package className="w-3 h-3 mt-0.5 shrink-0 text-neutral-600" />
                  <span className="break-all">{h.packages?.length ? h.packages.join(', ') : '—'}</span>
                </div>
                <div className="flex items-start gap-1.5 text-[10px] text-neutral-400 mt-0.5">
                  <Cog className="w-3 h-3 mt-0.5 shrink-0 text-neutral-600" />
                  <span className="break-all">{running.length ? running.map(s => `${s} ✓`).join(', ') : '—'}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
