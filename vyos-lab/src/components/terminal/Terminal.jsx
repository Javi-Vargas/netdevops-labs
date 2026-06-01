import React, { useState, useRef, useEffect, useCallback } from 'react';
import TerminalOutput from './TerminalOutput';
import TerminalInput from './TerminalInput';
import { bootLines } from '@/lib/bootBanner';
import { execute, getPrompt, getHostname, createDefaultState, tabComplete } from '@/lib/vyosEngine';

const STORAGE_KEY = 'vyos-sim-saved-config';

function loadSavedState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const running = JSON.parse(saved);
      return {
        hostname: getHostname(running),
        mode: 'operational',
        running,
        candidate: running,
        modified: false,
        editLevel: [],
      };
    }
  } catch { /* ignore */ }
  return null;
}

export default function Terminal({ onStateChange, externalState }) {
  const [outputLines, setOutputLines] = useState([]);
  const [currentInput, setCurrentInput] = useState('');
  const [engineState, setEngineState] = useState(() => loadSavedState() || createDefaultState());
  const [commandHistory, setCommandHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [booted, setBooted] = useState(false);
  const scrollRef = useRef(null);

  // Boot sequence
  useEffect(() => {
    const lines = bootLines.map(text => ({ type: 'boot', text }));
    let index = 0;
    const timer = setInterval(() => {
      if (index < lines.length) {
        setOutputLines(prev => [...prev, lines[index]]);
        index++;
      } else {
        clearInterval(timer);
        setBooted(true);
      }
    }, 22);
    return () => clearInterval(timer);
  }, []);

  // Load scenario state
  useEffect(() => {
    if (externalState) {
      try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
      setEngineState(externalState);
      setOutputLines([{ type: 'output', text: '\n--- Configuration loaded for lab. You are in operational mode. ---\n' }]);
      setCommandHistory([]);
      setHistoryIndex(-1);
      setBooted(true);
    }
  }, [externalState]);

  // Propagate state changes upward
  useEffect(() => {
    onStateChange?.(engineState);
  }, [engineState, onStateChange]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [outputLines, currentInput]);

  const prompt = getPrompt(engineState);

  const handleSubmit = useCallback(() => {
    const input = currentInput;
    setOutputLines(prev => [...prev, { type: 'input', prompt, text: input }]);

    if (input.trim()) {
      setCommandHistory(prev => [...prev, input]);
      setHistoryIndex(-1);

      const result = execute(input, engineState) || {};

      if (result.output != null && result.output !== '') {
        const lines = String(result.output).split('\n').map(text => ({ type: 'output', text }));
        setOutputLines(prev => [...prev, ...lines]);
      }
      if (result.state) setEngineState(result.state);

      if (result.persist === 'save') {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify((result.state || engineState).running)); } catch { /* ignore */ }
      } else if (result.persist === 'clear') {
        try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
      }
    }
    setCurrentInput('');
  }, [currentInput, engineState, prompt]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const newIndex = historyIndex === -1 ? commandHistory.length - 1 : Math.max(0, historyIndex - 1);
        setHistoryIndex(newIndex);
        setCurrentInput(commandHistory[newIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex >= 0) {
        const newIndex = historyIndex + 1;
        if (newIndex >= commandHistory.length) {
          setHistoryIndex(-1);
          setCurrentInput('');
        } else {
          setHistoryIndex(newIndex);
          setCurrentInput(commandHistory[newIndex]);
        }
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      setCurrentInput(tabComplete(currentInput, engineState));
    }
  }, [commandHistory, historyIndex, currentInput, engineState]);

  const handleContainerClick = () => {
    scrollRef.current?.querySelector('input')?.focus();
  };

  return (
    <div
      ref={scrollRef}
      onClick={handleContainerClick}
      className="h-full overflow-y-auto terminal-scroll p-4 font-mono text-sm cursor-text"
      style={{ backgroundColor: 'transparent' }}
    >
      <TerminalOutput lines={outputLines} />
      {booted && (
        <TerminalInput
          prompt={prompt}
          value={currentInput}
          onChange={setCurrentInput}
          onSubmit={handleSubmit}
          onKeyDown={handleKeyDown}
        />
      )}
    </div>
  );
}
