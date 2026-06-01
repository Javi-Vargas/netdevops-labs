import React, { useRef, useEffect } from 'react';

export default function TerminalInput({ prompt, value, onChange, onSubmit, onKeyDown }) {
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, [prompt]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onSubmit();
    } else {
      onKeyDown(e);
    }
  };

  return (
    <div className="flex items-center leading-5">
      <span className="text-primary whitespace-pre">{prompt}</span>
      <div className="relative flex-1">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full bg-transparent text-primary outline-none border-none font-mono text-sm caret-primary"
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="off"
        />
      </div>
    </div>
  );
}
