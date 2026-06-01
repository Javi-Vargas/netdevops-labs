import React, { useState, useRef, useEffect, useCallback } from 'react';
import TerminalOutput from './TerminalOutput';
import TerminalInput from './TerminalInput';
import { execute, getPrompt } from '@/lib/ansibleEngine';

const WELCOME = [
  { type: 'output', text: 'Ansible Lab — simulated control node (ansible-core 2.16)' },
  { type: 'output', text: "Managed hosts: web1, web2, db1.  Type 'help' to get started, or open a Tutorial on the right." },
  { type: 'output', text: '' },
];

const COMMANDS = ['ansible', 'ansible-playbook', 'ansible-inventory', 'ansible-doc', 'ansible-galaxy', 'ansible-vault', 'cat', 'ls', 'echo', 'pwd', 'help', 'clear', 'reset'];

export default function Terminal({ engineState, onStateChange, resetSignal }) {
  const [outputLines, setOutputLines] = useState(WELCOME);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const scrollRef = useRef(null);
  const firstReset = useRef(true);

  // Scenario load / external reset: clear the screen with a banner.
  useEffect(() => {
    if (firstReset.current) { firstReset.current = false; return; }
    setOutputLines([{ type: 'output', text: '--- Lab loaded: managed hosts and files reset for this scenario. ---' }, { type: 'output', text: '' }]);
    setHistory([]); setHistoryIndex(-1);
  }, [resetSignal]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [outputLines, input]);

  const prompt = getPrompt();

  const handleSubmit = useCallback(() => {
    const line = input;
    const next = [...outputLines, { type: 'input', prompt, text: line }];

    if (line.trim()) {
      setHistory(prev => [...prev, line]);
      setHistoryIndex(-1);
      const result = execute(line, engineState) || {};
      if (result.clear) {
        setOutputLines([]);
      } else {
        if (result.output != null && result.output !== '') {
          for (const t of String(result.output).split('\n')) next.push({ type: 'output', text: t });
        }
        setOutputLines(next);
      }
      if (result.state) onStateChange(result.state, result.persist);
    } else {
      setOutputLines(next);
    }
    setInput('');
  }, [input, outputLines, engineState, prompt, onStateChange]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length) {
        const idx = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1);
        setHistoryIndex(idx); setInput(history[idx]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex >= 0) {
        const idx = historyIndex + 1;
        if (idx >= history.length) { setHistoryIndex(-1); setInput(''); }
        else { setHistoryIndex(idx); setInput(history[idx]); }
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      const parts = input.split(/\s+/);
      if (parts.length === 1 && parts[0]) {
        const matches = COMMANDS.filter(c => c.startsWith(parts[0]));
        if (matches.length === 1) setInput(matches[0] + ' ');
      }
    }
  }, [history, historyIndex, input]);

  return (
    <div
      ref={scrollRef}
      onClick={() => scrollRef.current?.querySelector('input')?.focus()}
      className="h-full overflow-y-auto terminal-scroll p-4 font-mono text-sm cursor-text"
    >
      <TerminalOutput lines={outputLines} />
      <TerminalInput prompt={prompt} value={input} onChange={setInput} onSubmit={handleSubmit} onKeyDown={handleKeyDown} />
    </div>
  );
}
