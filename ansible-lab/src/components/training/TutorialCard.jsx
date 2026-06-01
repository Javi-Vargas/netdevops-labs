import React from 'react';
import { Clock, ChevronRight, Wrench, GraduationCap } from 'lucide-react';

const diffColors = {
  beginner: 'text-emerald-400 bg-emerald-500/10',
  intermediate: 'text-amber-400 bg-amber-500/10',
  advanced: 'text-red-400 bg-red-500/10',
};

export default function TutorialCard({ scenario, onClick }) {
  const Icon = scenario.category === 'troubleshoot' ? Wrench : GraduationCap;
  return (
    <button
      onClick={onClick}
      className="w-full text-left p-3 rounded-lg border border-neutral-800 hover:border-neutral-600 hover:bg-neutral-800/40 transition-all duration-200 group"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <Icon className={`w-3.5 h-3.5 shrink-0 ${scenario.category === 'troubleshoot' ? 'text-amber-400' : 'text-primary'}`} />
            <h3 className="text-sm font-medium text-neutral-200 group-hover:text-white truncate">{scenario.title}</h3>
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            {scenario.difficulty && (
              <span className={`text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded ${diffColors[scenario.difficulty] || 'text-neutral-400 bg-neutral-700/40'}`}>
                {scenario.difficulty}
              </span>
            )}
            <span className="flex items-center gap-1 text-[10px] text-neutral-500"><Clock className="w-3 h-3" />{scenario.duration}</span>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 mt-1 shrink-0 text-neutral-600 group-hover:text-neutral-400" />
      </div>
    </button>
  );
}
