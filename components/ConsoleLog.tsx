import React, { useEffect, useRef } from 'react';
import { LogEntry } from '../types';
import { Terminal, Sparkles } from 'lucide-react';

interface ConsoleLogProps {
  logs: LogEntry[];
}

const ConsoleLog: React.FC<ConsoleLogProps> = ({ logs }) => {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="w-full max-w-md bg-white/80 backdrop-blur-md rounded-2xl border border-white/50 shadow-xl overflow-hidden flex flex-col h-64 sm:h-80">
      <div className="bg-gray-100/50 p-3 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-2 text-gray-500 font-semibold text-xs uppercase tracking-wider">
          <Terminal size={14} />
          <span>Interaction Log</span>
        </div>
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-400/80"></div>
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-400/80"></div>
          <div className="w-2.5 h-2.5 rounded-full bg-green-400/80"></div>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-3 font-mono text-sm">
        {logs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-2 opacity-60">
            <Sparkles size={24} />
            <p>Press a button to start...</p>
          </div>
        ) : (
          logs.map((log) => (
            <div 
              key={log.id} 
              className={`flex flex-col ${log.type === 'response' ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}
            >
              <div className={`max-w-[85%] px-3 py-2 rounded-lg ${
                log.type === 'action' 
                  ? 'bg-blue-50 text-blue-900 rounded-tl-none' 
                  : 'bg-yellow-50 text-yellow-900 rounded-tr-none'
              }`}>
                <p className="whitespace-pre-wrap font-sans font-medium">{log.message}</p>
              </div>
              <span className="text-[10px] text-gray-400 mt-1 px-1">
                {log.timestamp.toLocaleTimeString()}
              </span>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
};

export default ConsoleLog;