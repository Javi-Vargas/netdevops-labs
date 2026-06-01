import React from 'react';
import { Clock, ChevronRight, Wrench, BookOpen } from 'lucide-react';

const diffColors = {
  beginner: 'text-emerald-400 bg-emerald-500/10',
  intermediate: 'text-amber-400 bg-amber-500/10',
  advanced: 'text-red-400 bg-red-500/10',
};

export default function ScenarioCard({ scenario, isActive, onClick }) {
  const Icon = scenario.category === 'troubleshoot' ? Wrench : BookOpen;
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 rounded-lg border transition-all duration-200 group ${
        isActive ? 'border-accent bg-accent/10' : 'border-border/50 hover:border-border hover:bg-secondary/30'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <Icon className={`w-3.5 h-3.5 shrink-0 ${scenario.category === 'troubleshoot' ? 'text-amber-400' : 'text-accent'}`} />
            <h3 className="text-sm font-medium text-slate-200 group-hover:text-white truncate">{scenario.title}</h3>
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            {scenario.difficulty && (
              <span className={`text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded ${diffColors[scenario.difficulty] || 'text-slate-400 bg-slate-700/40'}`}>
                {scenario.difficulty}
              </span>
            )}
            <span className="flex items-center gap-1 text-[10px] text-slate-500">
              <Clock className="w-3 h-3" />{scenario.duration}
            </span>
          </div>
        </div>
        <ChevronRight className={`w-4 h-4 mt-1 shrink-0 transition-transform ${isActive ? 'text-accent rotate-90' : 'text-slate-600'}`} />
      </div>
    </button>
  );
}
