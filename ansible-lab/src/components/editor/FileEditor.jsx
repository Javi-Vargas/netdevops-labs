import React, { useState, useEffect } from 'react';
import { listFiles, readFile } from '@/lib/vfs';
import { Button } from '@/components/ui/button';
import { File, Save, RotateCcw, FolderTree } from 'lucide-react';

export default function FileEditor({ vfs, onSave }) {
  const files = listFiles(vfs).filter(p => !p.endsWith('/.keep'));
  const [active, setActive] = useState(files[0] || null);
  const [draft, setDraft] = useState('');

  // Load the active file's content when selection changes or the file's stored
  // content changes underneath us (e.g. after running a playbook or scenario load).
  const stored = active ? readFile(vfs, active) : null;
  useEffect(() => {
    if (active && stored !== null) setDraft(stored);
    else if (active && stored === null) { setActive(files[0] || null); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, stored]);

  const dirty = active && draft !== stored;

  return (
    <div className="h-full flex" style={{ backgroundColor: '#0d0d0d' }}>
      {/* File tree */}
      <div className="w-48 shrink-0 border-r border-neutral-800 overflow-y-auto terminal-scroll">
        <div className="px-3 py-2 text-[10px] uppercase tracking-wider text-neutral-500 flex items-center gap-1.5">
          <FolderTree className="w-3 h-3" /> Files
        </div>
        {files.map(path => (
          <button
            key={path}
            onClick={() => setActive(path)}
            className={`w-full text-left px-3 py-1 text-[11px] font-mono truncate flex items-center gap-1.5 transition-colors ${active === path ? 'bg-primary/15 text-primary' : 'text-neutral-400 hover:bg-neutral-800/60'}`}
            title={path}
          >
            <File className="w-3 h-3 shrink-0 opacity-60" />
            {path}
          </button>
        ))}
      </div>

      {/* Editor */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-neutral-800">
          <span className="text-[11px] font-mono text-neutral-400 truncate">
            {active || 'no file selected'}{dirty ? <span className="text-amber-400"> ●</span> : null}
          </span>
          <div className="flex gap-1.5">
            <Button size="sm" variant="outline" className="h-6 text-[10px] px-2 border-neutral-700 text-neutral-400"
              onClick={() => stored !== null && setDraft(stored)} disabled={!dirty}>
              <RotateCcw className="w-3 h-3 mr-1" /> Revert
            </Button>
            <Button size="sm" className="h-6 text-[10px] px-2 bg-primary hover:bg-primary/90 text-white"
              onClick={() => active && onSave(active, draft)} disabled={!dirty}>
              <Save className="w-3 h-3 mr-1" /> Save
            </Button>
          </div>
        </div>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          spellCheck={false}
          className="flex-1 w-full bg-transparent text-foreground/90 font-mono text-[12px] leading-5 p-3 outline-none resize-none terminal-scroll"
          placeholder={active ? '' : 'Select a file from the list to edit it.'}
        />
      </div>
    </div>
  );
}
