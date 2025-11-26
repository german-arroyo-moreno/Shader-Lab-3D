import React, { useState, useEffect, useRef } from 'react';
import { ShaderScene } from './components/ShaderScene';
import { EditorPanel } from './components/EditorPanel';
import { Controls } from './components/Controls';
import { SHADER_PRESETS, createNoiseTextureURI } from './constants';
import { GeometryType, CustomUniform, Light, UniformType } from './types';
import { Box, TriangleAlert, XCircle, ChevronDown, ChevronUp } from 'lucide-react';

const App: React.FC = () => {
  // --- State Management ---
  const [activePresetIndex, setActivePresetIndex] = useState(0);
  
  // "Code" state is what is currently typed in the editor
  const [editorVertex, setEditorVertex] = useState(SHADER_PRESETS[0].vertex);
  const [editorFragment, setEditorFragment] = useState(SHADER_PRESETS[0].fragment);

  // "Active" state is what is passed to the WebGL context
  const [activeVertex, setActiveVertex] = useState(SHADER_PRESETS[0].vertex);
  const [activeFragment, setActiveFragment] = useState(SHADER_PRESETS[0].fragment);

  const [geometry, setGeometry] = useState<GeometryType>('box');
  const [customModel, setCustomModel] = useState<string | null>(null);

  const [customUniforms, setCustomUniforms] = useState<CustomUniform[]>([]);
  
  // Lighting State
  const [lights, setLights] = useState<Light[]>([
      { id: 'l1', position: [2, 2, 2], color: '#ffffff', intensity: 1.0 }
  ]);
  
  // Axes Visibility (Default visible, so hideAxes = false)
  const [hideAxes, setHideAxes] = useState(false);
  
  // Wireframe Mode
  const [isWireframe, setIsWireframe] = useState(false);

  // Error Console State
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isConsoleOpen, setIsConsoleOpen] = useState(true);

  // --- Layout Resizing ---
  const [sidebarWidth, setSidebarWidth] = useState(300); // px
  const [editorWidth, setEditorWidth] = useState(40); // percent (approx)
  
  const mainRef = useRef<HTMLElement>(null);

  // Function to load a preset
  const loadPreset = (index: number) => {
    setActivePresetIndex(index);
    const preset = SHADER_PRESETS[index];
    
    // Update both editor and active state
    setEditorVertex(preset.vertex);
    setEditorFragment(preset.fragment);
    setActiveVertex(preset.vertex);
    setActiveFragment(preset.fragment);
    
    setCustomUniforms([]);
    setErrorMsg(null);

    // Auto-inject Texture Uniform for the Texture Preset
    if (preset.name.includes('Textura')) {
        const newUniform: CustomUniform = {
            id: 'auto-texture',
            name: 'u_texture',
            type: UniformType.SAMPLER_2D,
            value: createNoiseTextureURI(), // Use generated procedural noise to avoid CORS issues by default
            min: 0,
            max: 0
        };
        setCustomUniforms([newUniform]);
    }
  };

  // Compile / Run function
  const handleRun = () => {
    setErrorMsg(null); // Clear previous errors
    // A small delay to allow UI to clear error before React tries to re-render potentially bad shader
    setTimeout(() => {
        setActiveVertex(editorVertex);
        setActiveFragment(editorFragment);
    }, 10);
  };

  const handleShaderError = (msg: string) => {
      setErrorMsg(msg);
      setIsConsoleOpen(true);
  }

  const handleShaderSuccess = () => {
      setErrorMsg(null);
  }

  const handleCustomModelUpload = (file: File) => {
      if (!file) return;
      const url = URL.createObjectURL(file);
      setCustomModel(url);
      setGeometry('custom');
  };

  // Shortcut: CTRL+ENTER or CMD+ENTER to run
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            handleRun();
        }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [editorVertex, editorFragment]);

  // --- Resize Handlers ---
  const startResizingSidebar = (e: React.MouseEvent) => {
      e.preventDefault();
      const onMouseMove = (moveEvent: MouseEvent) => {
          let newWidth = moveEvent.clientX;
          if (newWidth < 200) newWidth = 200;
          if (newWidth > 500) newWidth = 500;
          setSidebarWidth(newWidth);
      };
      const onMouseUp = () => {
          document.removeEventListener('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);
      };
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
  };

  const startResizingEditor = (e: React.MouseEvent) => {
      e.preventDefault();
      if (!mainRef.current) return;
      const mainRect = mainRef.current.getBoundingClientRect();
      
      const onMouseMove = (moveEvent: MouseEvent) => {
          const relativeX = moveEvent.clientX - mainRect.left;
          // Calculate percentage from right
          let percent = 100 - (relativeX / mainRect.width) * 100;
          if (percent < 20) percent = 20;
          if (percent > 60) percent = 60;
          setEditorWidth(percent);
      };
      const onMouseUp = () => {
          document.removeEventListener('mousemove', onMouseMove);
          document.removeEventListener('mouseup', onMouseUp);
      };
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
  };

  return (
    <div className="flex flex-col h-screen w-full bg-black text-white font-sans overflow-hidden">
      
      {/* Header */}
      <header className="h-14 border-b border-gray-800 bg-[#111115] flex items-center justify-between px-6 shrink-0 z-10 shadow-md">
        <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-cyan-500 to-purple-600 p-1.5 rounded-md shadow-lg shadow-cyan-900/40">
                <Box className="text-white w-5 h-5" />
            </div>
            <h1 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-100 to-gray-400">
                Shader Lab <span className="text-cyan-500 text-xs align-top">3D</span>
            </h1>
        </div>
        
        <div className="flex items-center gap-4">
            <div className="flex bg-[#0f0f13] rounded-lg p-1 border border-gray-800">
                {SHADER_PRESETS.map((preset, idx) => (
                    <button
                        key={idx}
                        onClick={() => loadPreset(idx)}
                        className={`text-xs px-3 py-1.5 rounded transition-all duration-200 ${
                            activePresetIndex === idx 
                            ? 'bg-gray-700 text-white shadow-sm font-medium' 
                            : 'text-gray-500 hover:text-gray-300'
                        }`}
                    >
                        {preset.name}
                    </button>
                ))}
            </div>
        </div>
      </header>

      {/* Main Content Grid */}
      <main ref={mainRef} className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        
        {/* Left Sidebar: Controls */}
        <aside 
            style={{ width: `${sidebarWidth}px` }}
            className="hidden lg:flex border-r border-gray-800 bg-[#0f0f13] shrink-0 overflow-hidden flex-col z-10 shadow-[4px_0_24px_rgba(0,0,0,0.4)]"
        >
          <Controls 
            geometry={geometry} 
            setGeometry={setGeometry}
            customModel={customModel}
            setCustomModel={(file) => handleCustomModelUpload(file)}
            customUniforms={customUniforms}
            setCustomUniforms={setCustomUniforms}
            lights={lights}
            setLights={setLights}
            hideAxes={hideAxes}
            setHideAxes={setHideAxes}
            isWireframe={isWireframe}
            setIsWireframe={setIsWireframe}
          />
        </aside>

        {/* Drag Handle 1 (Sidebar) */}
        <div 
            className="hidden lg:block w-1 bg-gray-900 hover:bg-cyan-500 cursor-col-resize z-20 transition-colors opacity-0 hover:opacity-100 absolute h-full"
            style={{ left: `${sidebarWidth}px` }}
            onMouseDown={startResizingSidebar}
        />

        {/* Center: 3D Viewport */}
        <section className="flex-1 relative bg-gray-900 flex flex-col min-w-0">
            <div className="flex-1 relative bg-[#050505] overflow-hidden">
                 <ShaderScene 
                    vertexShader={activeVertex}
                    fragmentShader={activeFragment}
                    geometryType={geometry}
                    customModel={customModel}
                    customUniforms={customUniforms}
                    lights={lights}
                    hideAxes={hideAxes}
                    isWireframe={isWireframe}
                    onError={handleShaderError}
                    onSuccess={handleShaderSuccess}
                 />
            </div>
            
            {/* Error Console (Collapsible at bottom of Viewport) */}
            {errorMsg && (
                <div className={`absolute bottom-0 left-0 right-0 z-30 flex flex-col transition-all duration-300 ${isConsoleOpen ? 'h-48' : 'h-8'}`}>
                    {/* Console Header */}
                    <div 
                        className="h-8 bg-red-900/90 flex items-center justify-between px-4 cursor-pointer hover:bg-red-800 border-t border-red-700"
                        onClick={() => setIsConsoleOpen(!isConsoleOpen)}
                    >
                         <div className="flex items-center gap-2 text-xs font-bold text-red-100">
                            <TriangleAlert size={14} /> ERROR DE COMPILACIÓN
                         </div>
                         <div className="text-red-200">
                             {isConsoleOpen ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                         </div>
                    </div>
                    
                    {/* Console Body */}
                    {isConsoleOpen && (
                        <div className="flex-1 bg-[#1a0505] p-4 font-mono text-xs text-red-200 overflow-auto whitespace-pre-wrap border-t border-red-900/50">
                            {errorMsg}
                        </div>
                    )}
                </div>
            )}
        </section>

         {/* Drag Handle 2 (Editor) */}
         <div 
            className="hidden lg:block w-1 bg-gray-900 hover:bg-cyan-500 cursor-col-resize z-20 transition-colors opacity-0 hover:opacity-100 absolute h-full right-[40%]"
            style={{ right: `${editorWidth}%` }}
            onMouseDown={startResizingEditor}
        />

        {/* Right Sidebar: Editor */}
        <aside 
            style={{ width: `${editorWidth}%` }}
            className="hidden lg:flex shrink-0 flex-col border-l border-gray-800 shadow-[-4px_0_24px_rgba(0,0,0,0.4)] z-20"
        >
          <EditorPanel 
            vertexShader={editorVertex}
            setVertexShader={setEditorVertex}
            fragmentShader={editorFragment}
            setFragmentShader={setEditorFragment}
            onRun={handleRun}
          />
        </aside>

        {/* Mobile View Fallback (Simplified Stack) */}
        <div className="lg:hidden flex flex-col h-full overflow-y-auto">
             <div className="h-[40vh] w-full"><ShaderScene vertexShader={activeVertex} fragmentShader={activeFragment} geometryType={geometry} customUniforms={customUniforms} lights={lights} hideAxes={hideAxes} isWireframe={isWireframe} /></div>
             <div className="h-[30vh] w-full border-t border-gray-800"><Controls geometry={geometry} setGeometry={setGeometry} customModel={customModel} setCustomModel={handleCustomModelUpload} customUniforms={customUniforms} setCustomUniforms={setCustomUniforms} lights={lights} setLights={setLights} hideAxes={hideAxes} setHideAxes={setHideAxes} isWireframe={isWireframe} setIsWireframe={setIsWireframe}/></div>
             <div className="h-[50vh] w-full border-t border-gray-800"><EditorPanel vertexShader={editorVertex} setVertexShader={setEditorVertex} fragmentShader={editorFragment} setFragmentShader={setEditorFragment} onRun={handleRun} /></div>
        </div>

      </main>
    </div>
  );
};

export default App;