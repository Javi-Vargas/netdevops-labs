import React, { useState, useEffect } from 'react';
import { Server, Boxes, Wifi, Clock } from 'lucide-react';

export default function StatusBar({ hosts }) {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const list = hosts ? Object.values(hosts) : [];
  const reachable = list.filter(h => h.reachable !== false).length;

  return (
    <div className="flex items-center justify-between px-4 py-1.5 border-t border-neutral-800 text-[10px]" style={{ backgroundColor: '#111' }}>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-neutral-400">control node</span>
        </div>
        <div className="flex items-center gap-1.5 text-neutral-400">
          <Boxes className="w-3 h-3" />
          <span>{list.length} managed hosts</span>
        </div>
        <div className="flex items-center gap-1.5 text-emerald-400/80">
          <Wifi className="w-3 h-3" />
          <span>{reachable} reachable</span>
        </div>
        <div className="flex items-center gap-1.5 text-primary">
          <Server className="w-3 h-3" />
          <span>ansible-core 2.16</span>
        </div>
      </div>
      <div className="flex items-center gap-1.5 text-neutral-500">
        <Clock className="w-3 h-3" />
        <span>{time.toLocaleTimeString()}</span>
      </div>
    </div>
  );
}
