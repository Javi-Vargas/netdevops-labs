import React from 'react';

// Patterns for VyOS-flavored syntax highlighting.
const PATTERNS = [
  // Errors / warnings
  { regex: /(Invalid command.*|Incomplete command.*|Nothing to delete.*|Cannot exit.*|.*does not exist.*|.*failed.*)/gi, className: 'text-red-400' },
  // compare/diff markers at line start
  { regex: /^(\+.*)$/g, className: 'text-emerald-400' },
  { regex: /^(-\s.*)$/g, className: 'text-red-400' },
  // up / active states
  { regex: /\b(up|UP|Up|active|accept|connected|received|Done|OK)\b/g, className: 'text-emerald-400' },
  // down / drop / loss states
  { regex: /\b(down|DOWN|Down|drop|reject|timeout|Timeout|disable|disabled|blackhole|100% packet loss)\b/g, className: 'text-red-400' },
  // interface names
  { regex: /\b(eth\d+|lo\b|wg\d+|br\d+|bond\d+|dum\d+|vif\s*\d+)\b/g, className: 'text-cyan-400' },
  // CIDR / IP addresses
  { regex: /\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(?:\/\d{1,2})?)\b/g, className: 'text-blue-300' },
  // config keywords
  { regex: /\b(set|delete|commit|save|discard|compare|masquerade|next-hop|source|destination|address|action|protocol)\b/g, className: 'text-amber-400' },
  // standalone numbers
  { regex: /\b(\d+)\b/g, className: 'text-slate-300' },
];

function highlightLine(text) {
  const segments = [{ text, className: null }];
  for (const { regex, className } of PATTERNS) {
    const next = [];
    for (const seg of segments) {
      if (seg.className !== null) { next.push(seg); continue; }
      let lastIndex = 0;
      const str = seg.text;
      regex.lastIndex = 0;
      let match;
      while ((match = regex.exec(str)) !== null) {
        if (match.index > lastIndex) next.push({ text: str.slice(lastIndex, match.index), className: null });
        next.push({ text: match[0], className });
        lastIndex = match.index + match[0].length;
        if (match[0].length === 0) regex.lastIndex++;
      }
      if (lastIndex < str.length) next.push({ text: str.slice(lastIndex), className: null });
    }
    segments.length = 0;
    segments.push(...next);
  }
  return segments;
}

export default function TerminalOutput({ lines }) {
  return (
    <div className="whitespace-pre-wrap">
      {lines.filter(Boolean).map((line, i) => (
        <div key={i} className="leading-5">
          {line.type === 'input' ? (
            <span>
              <span className="text-primary">{line.prompt}</span>
              <span className="text-primary">{line.text}</span>
            </span>
          ) : line.type === 'boot' ? (
            <span className="text-primary/70">{line.text}</span>
          ) : (
            <span>
              {highlightLine(line.text || '').map((seg, j) => (
                <span key={j} className={seg.className || 'text-primary/90'}>{seg.text}</span>
              ))}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
