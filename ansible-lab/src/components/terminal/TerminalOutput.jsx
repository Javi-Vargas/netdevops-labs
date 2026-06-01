import React from 'react';

// Classify a whole output line into an Ansible-style color.
function classify(text) {
  if (/^(PLAY RECAP|PLAY \[|TASK \[|RUNNING HANDLER)/.test(text)) return 'text-sky-400 font-semibold';
  if (/UNREACHABLE|^fatal:|^failed:|\| FAILED|\| UNREACHABLE|^ERROR!/.test(text)) return 'text-red-400';
  if (/^ok:|\| SUCCESS/.test(text)) return 'text-emerald-400';
  if (/^changed:|\| CHANGED/.test(text)) return 'text-amber-400';
  if (/^skipping:/.test(text)) return 'text-slate-500';
  if (/^\[WARNING\]/.test(text)) return 'text-amber-300/80';
  if (/: ok=\d/.test(text)) {
    return /failed=[1-9]|unreachable=[1-9]/.test(text) ? 'text-red-300' : 'text-slate-300';
  }
  if (/^\$ANSIBLE_VAULT|^\d{4}[0-9a-f]/.test(text)) return 'text-purple-400/70';
  return null;
}

export default function TerminalOutput({ lines }) {
  return (
    <div className="whitespace-pre-wrap">
      {lines.filter(Boolean).map((line, i) => {
        if (line.type === 'input') {
          return (
            <div key={i} className="leading-5">
              <span className="text-primary font-semibold">{line.prompt}</span>
              <span className="text-foreground">{line.text}</span>
            </div>
          );
        }
        const cls = classify(line.text || '');
        return (
          <div key={i} className={`leading-5 ${cls || 'text-foreground/90'}`}>{line.text || ' '}</div>
        );
      })}
    </div>
  );
}
