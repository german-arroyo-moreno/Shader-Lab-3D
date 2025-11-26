import React, { useState, useRef } from 'react';
import { Play } from 'lucide-react';

interface EditorPanelProps {
  vertexShader: string;
  setVertexShader: (s: string) => void;
  fragmentShader: string;
  setFragmentShader: (s: string) => void;
  onRun: () => void;
}

// Regex combinada para evitar reemplazos anidados que rompan el HTML
const TOKEN_REGEX = /(\/\/.*)|(\b(?:void|float|int|bool|vec[234]|mat[234]|const|uniform|varying|attribute|struct|precision|highp|mediump|lowp)\b)|(\b(?:gl_Position|gl_FragColor|gl_FragCoord|gl_PointCoord)\b)|(\b(?:sin|cos|tan|mix|dot|cross|normalize|length|pow|min|max|clamp|step|smoothstep|texture2D|abs|fract|floor|ceil|mod)\b)|(\bmain\b)|(\b(?:[0-9]+\.[0-9]+|[0-9]+\.|\.[0-9]+|[0-9]+)\b)/g;

const HighlightedCode = ({ code, scrollRef }: { code: string, scrollRef: React.RefObject<HTMLPreElement | null> }) => {
  const highlight = (text: string) => {
    const escaped = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    return escaped.replace(TOKEN_REGEX, (match, comment, type, builtin, func, main, number) => {
      if (comment) return `<span class="text-gray-500 italic">${comment}</span>`;
      if (type) return `<span class="text-purple-400 font-bold">${type}</span>`;
      if (builtin) return `<span class="text-yellow-400">${builtin}</span>`;
      if (func) return `<span class="text-blue-300">${func}</span>`;
      if (main) return `<span class="text-green-400 font-bold">${main}</span>`;
      if (number) return `<span class="text-cyan-300">${number}</span>`;
      return match;
    });
  };

  return (
    <pre 
      ref={scrollRef}
      className="absolute inset-0 m-0 font-mono text-sm leading-relaxed whitespace-pre p-4 overflow-hidden pointer-events-none"
      dangerouslySetInnerHTML={{ __html: highlight(code) }}
      style={{ tabSize: 2 }}
    />
  );
};

const CodeEditor: React.FC<{ 
    code: string; 
    onChange: (val: string) => void; 
    active: boolean;
}> = ({ code, onChange, active }) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const preRef = useRef<HTMLPreElement>(null);

    if (!active) return null;

    const handleScroll = () => {
        if (textareaRef.current && preRef.current) {
            preRef.current.scrollTop = textareaRef.current.scrollTop;
            preRef.current.scrollLeft = textareaRef.current.scrollLeft;
        }
    };

    return (
        <div className="relative flex-1 w-full h-full bg-[#1e1e26] overflow-hidden group">
            {/* Syntax Highlight Layer */}
            <HighlightedCode code={code} scrollRef={preRef} />

            {/* Input Layer */}
            <textarea
                ref={textareaRef}
                value={code}
                onChange={(e) => onChange(e.target.value)}
                onScroll={handleScroll}
                spellCheck={false}
                autoCapitalize="off"
                autoComplete="off"
                autoCorrect="off"
                className="absolute inset-0 w-full h-full bg-transparent text-transparent caret-white font-mono text-sm p-4 resize-none leading-relaxed focus:outline-none selection:bg-cyan-500/30 whitespace-pre overflow-auto custom-scrollbar"
                style={{ tabSize: 2 }}
            />
        </div>
    );
}

export const EditorPanel: React.FC<EditorPanelProps> = ({
  vertexShader,
  setVertexShader,
  fragmentShader,
  setFragmentShader,
  onRun
}) => {
  const [activeTab, setActiveTab] = useState<'vertex' | 'fragment'>('fragment');

  return (
    <div className="flex flex-col h-full border-l border-gray-800 bg-[#15151a]">
      {/* Header Tabs */}
      <div className="flex items-center justify-between border-b border-gray-800 bg-[#111115] pr-2">
        <div className="flex">
            <button
            onClick={() => setActiveTab('vertex')}
            className={`px-6 py-3 text-xs font-bold font-mono transition-colors uppercase tracking-wider ${
                activeTab === 'vertex' 
                ? 'bg-[#1e1e26] text-cyan-400 border-t-2 border-t-cyan-400' 
                : 'text-gray-500 hover:text-gray-300 hover:bg-[#1a1a20]'
            }`}
            >
            Vertex
            </button>
            <button
            onClick={() => setActiveTab('fragment')}
            className={`px-6 py-3 text-xs font-bold font-mono transition-colors uppercase tracking-wider ${
                activeTab === 'fragment' 
                ? 'bg-[#1e1e26] text-purple-400 border-t-2 border-t-purple-400' 
                : 'text-gray-500 hover:text-gray-300 hover:bg-[#1a1a20]'
            }`}
            >
            Fragment
            </button>
        </div>

        <button 
            onClick={onRun}
            className="flex items-center gap-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white px-4 py-1.5 rounded text-xs font-bold uppercase tracking-wider transition-all transform active:scale-95 shadow-lg shadow-cyan-900/20"
        >
            <Play size={12} fill="currentColor" /> Compilar
        </button>
      </div>

      {/* Editors */}
      <div className="flex-1 relative">
        <CodeEditor 
            code={vertexShader} 
            onChange={setVertexShader} 
            active={activeTab === 'vertex'}
        />
        <CodeEditor 
            code={fragmentShader} 
            onChange={setFragmentShader} 
            active={activeTab === 'fragment'}
        />
      </div>
      
      {/* Footer Info */}
      <div className="bg-[#111115] px-3 py-1 border-t border-gray-800 text-[10px] text-gray-500 font-mono flex justify-between">
         <span>GLSL ES 3.0 Compatible</span>
         <span>{activeTab === 'vertex' ? vertexShader.length : fragmentShader.length} chars</span>
      </div>
    </div>
  );
};