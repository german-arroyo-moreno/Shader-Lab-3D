import React from 'react';
import { Trash2, Sliders, Grid3X3, Grid2X2, Clock, MousePointer2, Plus, HelpCircle, Lightbulb, Move3d, ScanLine, Upload, Shuffle, Image as ImageIcon, FileBox } from 'lucide-react';
import { GeometryType, CustomUniform, UniformType, Light, TextureWrapMode } from '../types';
import { createNoiseTextureURI } from '../constants';

interface ControlsProps {
  geometry: GeometryType;
  setGeometry: (g: GeometryType) => void;
  customModel?: string | null;
  setCustomModel?: (f: File) => void;
  customUniforms: CustomUniform[];
  setCustomUniforms: React.Dispatch<React.SetStateAction<CustomUniform[]>>;
  lights: Light[];
  setLights: React.Dispatch<React.SetStateAction<Light[]>>;
  hideAxes: boolean;
  setHideAxes: (v: boolean) => void;
  isWireframe: boolean;
  setIsWireframe: (v: boolean) => void;
}

export const Controls: React.FC<ControlsProps> = ({
  geometry,
  setGeometry,
  customModel,
  setCustomModel,
  customUniforms,
  setCustomUniforms,
  lights,
  setLights,
  hideAxes,
  setHideAxes,
  isWireframe,
  setIsWireframe
}) => {

  // --- Uniform Logic ---
  const addUniform = (type: UniformType, binding?: 'TIME' | 'MOUSE') => {
    let defaultValue: any;
    let name = '';
    let wrap: TextureWrapMode | undefined = undefined;
    
    // Default naming logic
    let namePrefix = 'u_custom';
    if (binding === 'TIME') namePrefix = 'u_timer';
    if (binding === 'MOUSE') namePrefix = 'u_mouse_pos';

    switch(type) {
        case UniformType.VEC2: defaultValue = [0.5, 0.5]; break;
        case UniformType.VEC3: defaultValue = [1.0, 1.0, 1.0]; break;
        case UniformType.VEC4: defaultValue = [1.0, 0.5, 0.0, 1.0]; break;
        case UniformType.MAT3: defaultValue = [1,0,0, 0,1,0, 0,0,1]; break; 
        case UniformType.MAT4: defaultValue = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]; break; 
        case UniformType.SAMPLER_2D: 
            defaultValue = createNoiseTextureURI(); 
            wrap = 'REPEAT'; // Default wrap mode
            // Special naming for first texture to match shader convention
            const hasDefaultTexture = customUniforms.some(u => u.name === 'u_texture');
            if (!hasDefaultTexture) name = 'u_texture';
            else namePrefix = "u_texture"; 
            break;
        default: defaultValue = 0.5;
    }

    if (!name) {
        name = `${namePrefix}_${customUniforms.length + 1}`;
    }

    const newUniform: CustomUniform = {
      id: Math.random().toString(36).substr(2, 9),
      name: name,
      type,
      value: defaultValue,
      min: 0,
      max: 2,
      binding,
      wrap
    };
    setCustomUniforms([...customUniforms, newUniform]);
  };

  const removeUniform = (id: string) => {
    setCustomUniforms(customUniforms.filter(u => u.id !== id));
  };

  const updateUniformValue = (id: string, newValue: any) => {
    setCustomUniforms(customUniforms.map(u => 
      u.id === id ? { ...u, value: newValue } : u
    ));
  };

  const updateUniformName = (id: string, name: string) => {
    setCustomUniforms(customUniforms.map(u => 
        u.id === id ? { ...u, name } : u
      ));
  }

  const updateUniformWrap = (id: string, wrap: TextureWrapMode) => {
    setCustomUniforms(customUniforms.map(u => 
        u.id === id ? { ...u, wrap } : u
      ));
  }
  
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, uniformId: string) => {
    const file = e.target.files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            if(event.target?.result) {
                updateUniformValue(uniformId, event.target.result);
            }
        };
        reader.readAsDataURL(file);
    }
  };
  
  const handleModelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file && setCustomModel) {
          setCustomModel(file);
      }
  }

  // --- Light Logic ---
  const addLight = () => {
      if (lights.length >= 4) return;
      const newLight: Light = {
          id: Math.random().toString(36).substr(2, 9),
          position: [2, 2, 2],
          color: '#ffffff',
          intensity: 1.0
      };
      setLights([...lights, newLight]);
  }

  const removeLight = (id: string) => {
      setLights(lights.filter(l => l.id !== id));
  }

  const updateLight = (id: string, field: keyof Light, value: any) => {
      setLights(lights.map(l => l.id === id ? { ...l, [field]: value } : l));
  }
  
  const updateLightPos = (id: string, index: number, val: number) => {
      const l = lights.find(x => x.id === id);
      if(!l) return;
      const newPos = [...l.position] as [number, number, number];
      newPos[index] = val;
      updateLight(id, 'position', newPos);
  }

  // --- UI Helpers ---
  const renderMatrixInputs = (uniform: CustomUniform, size: 3 | 4) => {
    const values = uniform.value as number[];
    const gridCols = size === 3 ? 'grid-cols-3' : 'grid-cols-4';
    
    return (
        <div className={`grid ${gridCols} gap-1 mt-2`}>
            {values.map((val, idx) => (
                <input
                    key={idx}
                    type="number"
                    step="0.1"
                    className="w-full bg-gray-900 border border-gray-700 rounded text-[10px] text-center p-1 text-gray-300 focus:border-cyan-500 focus:outline-none"
                    value={val}
                    onChange={(e) => {
                        const newVals = [...values];
                        newVals[idx] = parseFloat(e.target.value) || 0;
                        updateUniformValue(uniform.id, newVals);
                    }}
                />
            ))}
        </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-4 h-full overflow-y-auto custom-scrollbar">
      
      {/* Geometry Selector */}
      <div className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
            <Sliders size={14} /> Entorno
        </h3>
        <select
          value={geometry}
          onChange={(e) => setGeometry(e.target.value as GeometryType)}
          className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded px-3 py-2 focus:outline-none focus:border-cyan-500 transition-colors"
        >
          <option value="box">Cubo</option>
          <option value="sphere">Esfera</option>
          <option value="torus">Toroide</option>
          <option value="plane">Plano</option>
          <option value="custom">Modelo 3D (Archivo)</option>
        </select>
        
        {/* Custom Model Upload UI */}
        {geometry === 'custom' && (
            <div className="bg-gray-800/50 p-3 rounded border border-dashed border-gray-600">
                <label className="flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-gray-800 transition-colors p-2 rounded">
                    <div className="bg-cyan-900/50 p-2 rounded-full text-cyan-400">
                        <FileBox size={18} />
                    </div>
                    <span className="text-xs text-center text-cyan-200 font-medium">Cargar .GLB / .GLTF</span>
                    <input 
                        type="file" 
                        accept=".glb,.gltf" 
                        className="hidden" 
                        onChange={handleModelUpload}
                    />
                </label>
                <p className="text-[9px] text-gray-500 text-center mt-2">
                    {customModel ? 'Modelo cargado correctamente' : 'Soporta archivos binarios (glb) y texto (gltf embedded)'}
                </p>
            </div>
        )}
        
        <div className="flex gap-2">
            <label className="flex-1 flex items-center gap-2 bg-gray-800/50 p-2 rounded border border-gray-700 cursor-pointer hover:bg-gray-800">
                <input 
                    type="checkbox" 
                    checked={hideAxes}
                    onChange={(e) => setHideAxes(e.target.checked)}
                    className="w-4 h-4 accent-cyan-500"
                />
                <span className="text-xs text-gray-300 flex items-center gap-2"><Move3d size={12}/> Ocultar Ejes</span>
            </label>
            
            <button
                onClick={() => setIsWireframe(!isWireframe)}
                className={`flex items-center gap-2 px-3 py-2 rounded border transition-colors ${
                    isWireframe 
                    ? 'bg-cyan-900/50 border-cyan-500 text-cyan-300' 
                    : 'bg-gray-800/50 border-gray-700 text-gray-400 hover:bg-gray-800'
                }`}
            >
                <ScanLine size={14} />
                <span className="text-xs">Wireframe</span>
            </button>
        </div>
      </div>

      {/* Lighting Section */}
      <div className="space-y-3">
        <div className="flex flex-col border-b border-gray-700 pb-2 gap-2">
            <div className="flex justify-between items-center">
                 <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
                    <Lightbulb size={14} /> Iluminación
                </h3>
                <button 
                    onClick={addLight}
                    disabled={lights.length >= 4}
                    className="bg-gray-800 hover:bg-yellow-900 text-xs px-2 py-1 rounded text-yellow-400 border border-gray-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    + Luz
                </button>
            </div>
        </div>

        <div className="space-y-4">
             {lights.length === 0 && (
                <p className="text-xs text-gray-600 italic text-center py-2">Sin luces activas</p>
            )}
            {lights.map((light, index) => (
                <div key={light.id} className="bg-gray-800/50 rounded p-2 border border-gray-700 relative group">
                    <div className="flex items-center justify-between mb-2">
                         <span className="text-[10px] font-bold text-yellow-500 uppercase">Luz {index + 1} (Point)</span>
                         <button onClick={() => removeLight(light.id)} className="text-gray-600 hover:text-red-400"><Trash2 size={12}/></button>
                    </div>
                    
                    <div className="grid grid-cols-[1fr_auto] gap-2 items-center mb-2">
                        <input 
                            type="range" 
                            min="0" max="5" step="0.1" 
                            value={light.intensity}
                            onChange={(e) => updateLight(light.id, 'intensity', parseFloat(e.target.value))}
                            className="h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-yellow-500"
                        />
                         <input 
                            type="color" 
                            value={light.color}
                            onChange={(e) => updateLight(light.id, 'color', e.target.value)}
                            className="w-6 h-6 rounded cursor-pointer bg-transparent border-none"
                        />
                    </div>
                    
                    <div className="space-y-1">
                        {['x','y','z'].map((axis, i) => (
                             <div key={axis} className="flex items-center gap-2">
                                <span className="text-[10px] uppercase text-gray-500 w-3">{axis}</span>
                                <input
                                    type="range"
                                    min="-10"
                                    max="10"
                                    step="0.1"
                                    value={light.position[i]}
                                    onChange={(e) => updateLightPos(light.id, i, parseFloat(e.target.value))}
                                    className="flex-1 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                                />
                                <span className="text-[10px] font-mono w-6 text-right">{light.position[i].toFixed(1)}</span>
                             </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
      </div>


      {/* Uniforms Section */}
      <div className="space-y-3">
        <div className="flex flex-col border-b border-gray-700 pb-2 gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">Uniforms</h3>
            
            <div className="flex items-center justify-between gap-2">
                <div className="flex flex-wrap gap-1">
                    <button title="Float" onClick={() => addUniform(UniformType.FLOAT)} className="bg-gray-800 hover:bg-cyan-900 text-xs px-2 py-1 rounded text-cyan-400 border border-gray-700 transition-all">1.0</button>
                    <button title="Vec2" onClick={() => addUniform(UniformType.VEC2)} className="bg-gray-800 hover:bg-green-900 text-xs px-2 py-1 rounded text-green-400 border border-gray-700 transition-all">xy</button>
                    <button title="Vec3" onClick={() => addUniform(UniformType.VEC3)} className="bg-gray-800 hover:bg-purple-900 text-xs px-2 py-1 rounded text-purple-400 border border-gray-700 transition-all">xyz</button>
                    <button title="Vec4 (Color)" onClick={() => addUniform(UniformType.VEC4)} className="bg-gray-800 hover:bg-red-900 text-xs px-2 py-1 rounded text-red-400 border border-gray-700 transition-all">rgba</button>
                    <button title="Mat3" onClick={() => addUniform(UniformType.MAT3)} className="bg-gray-800 hover:bg-yellow-900 text-xs px-2 py-1 rounded text-yellow-400 border border-gray-700 transition-all flex items-center"><Grid3X3 size={10} /></button>
                    <button title="Mat4" onClick={() => addUniform(UniformType.MAT4)} className="bg-gray-800 hover:bg-orange-900 text-xs px-2 py-1 rounded text-orange-400 border border-gray-700 transition-all flex items-center"><Grid2X2 size={10} /></button>
                     <button title="Texture" onClick={() => addUniform(UniformType.SAMPLER_2D)} className="bg-gray-800 hover:bg-indigo-900 text-xs px-2 py-1 rounded text-indigo-400 border border-gray-700 transition-all flex items-center">Tex</button>
                </div>
                
                {/* Special Bindings */}
                <div className="flex gap-1 pl-2 border-l border-gray-700">
                     <button title="Vincular Tiempo (float)" onClick={() => addUniform(UniformType.FLOAT, 'TIME')} className="bg-gray-800 hover:bg-pink-900 text-xs p-1.5 rounded text-pink-400 border border-gray-700 transition-all flex items-center"><Clock size={12} /></button>
                     <button title="Vincular Mouse (vec2)" onClick={() => addUniform(UniformType.VEC2, 'MOUSE')} className="bg-gray-800 hover:bg-blue-900 text-xs p-1.5 rounded text-blue-400 border border-gray-700 transition-all flex items-center"><MousePointer2 size={12} /></button>
                </div>
            </div>
        </div>
        
        <div className="space-y-4 pb-20">
          {customUniforms.length === 0 && (
            <p className="text-xs text-gray-600 italic text-center py-4">No hay variables personalizadas</p>
          )}
          
          {customUniforms.map((uniform) => (
            <div key={uniform.id} className="bg-gray-800/50 rounded p-3 border border-gray-700 shadow-sm hover:border-gray-600 transition-colors">
              <div className="flex justify-between mb-2 items-center">
                <div className="flex items-center gap-2 w-full">
                    <span className={`text-[10px] uppercase font-bold px-1 rounded ${
                        uniform.type === UniformType.FLOAT ? 'bg-cyan-900 text-cyan-200' :
                        uniform.type === UniformType.VEC2 ? 'bg-green-900 text-green-200' :
                        uniform.type === UniformType.VEC3 ? 'bg-purple-900 text-purple-200' :
                        uniform.type === UniformType.VEC4 ? 'bg-red-900 text-red-200' :
                        uniform.type === UniformType.SAMPLER_2D ? 'bg-indigo-900 text-indigo-200' :
                        'bg-yellow-900 text-yellow-200'
                    }`}>{uniform.type}</span>
                    <input 
                        type="text" 
                        value={uniform.name}
                        onChange={(e) => updateUniformName(uniform.id, e.target.value)}
                        className="bg-transparent text-xs font-mono text-gray-300 border-b border-transparent hover:border-gray-500 focus:border-cyan-500 focus:outline-none w-full"
                    />
                </div>
                <button 
                    onClick={() => removeUniform(uniform.id)}
                    className="text-gray-500 hover:text-red-400 transition-colors ml-2"
                >
                    <Trash2 size={12} />
                </button>
              </div>

              {/* Binding Indicator or Manual Controls */}
              {uniform.binding ? (
                <div className="flex items-center gap-2 text-xs text-gray-400 bg-gray-900/50 p-2 rounded border border-gray-800">
                    {uniform.binding === 'TIME' ? <Clock size={12} className="text-pink-400" /> : <MousePointer2 size={12} className="text-blue-400" />}
                    <span className="italic">Vinculado a {uniform.binding === 'TIME' ? 'Tiempo' : 'Mouse'}</span>
                </div>
              ) : (
                  <>
                  {/* FLOAT UI */}
                  {uniform.type === UniformType.FLOAT && (
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="-5"
                        max="5"
                        step="0.01"
                        value={uniform.value as number}
                        onChange={(e) => updateUniformValue(uniform.id, parseFloat(e.target.value))}
                        className="flex-1 accent-cyan-500 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                      />
                      <input 
                        type="number" 
                        value={uniform.value as number}
                        step="0.1"
                        onChange={(e) => updateUniformValue(uniform.id, parseFloat(e.target.value))}
                        className="w-12 bg-transparent text-right text-xs font-mono text-gray-300 focus:outline-none border-b border-gray-700"
                      />
                    </div>
                  )}

                  {/* VEC2 UI */}
                  {uniform.type === UniformType.VEC2 && (
                     <div className="space-y-1">
                     {(['x', 'y'] as const).map((axis, i) => (
                       <div key={axis} className="flex items-center gap-2">
                           <span className="text-[10px] uppercase text-gray-500 w-3">{axis}</span>
                           <input
                               type="range"
                               min="0"
                               max="1"
                               step="0.01"
                               value={(uniform.value as number[])[i]}
                               onChange={(e) => {
                                   const newVal = [...(uniform.value as number[])];
                                   newVal[i] = parseFloat(e.target.value);
                                   updateUniformValue(uniform.id, newVal);
                               }}
                               className="flex-1 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
                           />
                            <span className="text-xs w-8 text-right font-mono">{(uniform.value as number[])[i].toFixed(2)}</span>
                       </div>
                     ))}
                   </div>
                  )}

                  {/* VEC3 UI */}
                  {uniform.type === UniformType.VEC3 && (
                    <div className="space-y-1">
                      {(['x', 'y', 'z'] as const).map((axis, i) => (
                        <div key={axis} className="flex items-center gap-2">
                            <span className="text-[10px] uppercase text-gray-500 w-3">{axis}</span>
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.01"
                                value={(uniform.value as number[])[i]}
                                onChange={(e) => {
                                    const newVal = [...(uniform.value as number[])];
                                    newVal[i] = parseFloat(e.target.value);
                                    updateUniformValue(uniform.id, newVal);
                                }}
                                className={`flex-1 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer ${
                                    i === 0 ? 'accent-red-500' : i === 1 ? 'accent-green-500' : 'accent-blue-500'
                                }`}
                            />
                             <span className="text-xs w-8 text-right font-mono">{(uniform.value as number[])[i].toFixed(2)}</span>
                        </div>
                      ))}
                      <div className="mt-2 h-2 w-full rounded border border-gray-700" style={{
                          backgroundColor: `rgb(${(uniform.value as number[])[0] * 255}, ${(uniform.value as number[])[1] * 255}, ${(uniform.value as number[])[2] * 255})`
                      }} />
                    </div>
                  )}

                   {/* VEC4 UI */}
                   {uniform.type === UniformType.VEC4 && (
                    <div className="space-y-1">
                      {(['r', 'g', 'b', 'a'] as const).map((axis, i) => (
                        <div key={axis} className="flex items-center gap-2">
                            <span className="text-[10px] uppercase text-gray-500 w-3">{axis}</span>
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.01"
                                value={(uniform.value as number[])[i]}
                                onChange={(e) => {
                                    const newVal = [...(uniform.value as number[])];
                                    newVal[i] = parseFloat(e.target.value);
                                    updateUniformValue(uniform.id, newVal);
                                }}
                                className={`flex-1 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer ${
                                    i === 3 ? 'accent-gray-400' : 'accent-red-500'
                                }`}
                            />
                             <span className="text-xs w-8 text-right font-mono">{(uniform.value as number[])[i].toFixed(2)}</span>
                        </div>
                      ))}
                      <div className="mt-2 h-4 w-full rounded border border-gray-700 grid grid-cols-2 overflow-hidden">
                           <div style={{
                                backgroundColor: `rgba(${(uniform.value as number[])[0] * 255}, ${(uniform.value as number[])[1] * 255}, ${(uniform.value as number[])[2] * 255}, 1)`
                           }} className="h-full"></div>
                            <div style={{
                                backgroundColor: `rgba(${(uniform.value as number[])[0] * 255}, ${(uniform.value as number[])[1] * 255}, ${(uniform.value as number[])[2] * 255}, ${(uniform.value as number[])[3]})`
                           }} className="h-full relative bg-[url('https://www.transparenttextures.com/patterns/checkerboard.png')]"></div>
                      </div>
                    </div>
                  )}

                  {/* SAMPLER 2D UI */}
                  {uniform.type === UniformType.SAMPLER_2D && (
                      <div className="flex flex-col gap-2">
                          {/* Preview */}
                          <div className="w-full h-24 bg-black/40 rounded border border-gray-700 flex items-center justify-center overflow-hidden relative group/preview">
                               {typeof uniform.value === 'string' && uniform.value.length > 0 ? (
                                   <img src={uniform.value} className="w-full h-full object-cover" alt="Texture Preview" />
                               ) : (
                                   <div className="text-gray-600 flex flex-col items-center gap-1">
                                       <ImageIcon size={20} />
                                       <span className="text-[10px]">Sin textura</span>
                                   </div>
                               )}
                          </div>

                          {/* Wrapping Mode Selection */}
                          <div className="flex items-center gap-2">
                             <span className="text-[9px] text-gray-500 uppercase">Mode:</span>
                             <select 
                                value={uniform.wrap || 'REPEAT'}
                                onChange={(e) => updateUniformWrap(uniform.id, e.target.value as TextureWrapMode)}
                                className="flex-1 bg-gray-900 border border-gray-700 text-[10px] p-1 rounded text-gray-300 focus:border-cyan-500 focus:outline-none"
                             >
                                 <option value="REPEAT">Repetir</option>
                                 <option value="CLAMP">Estirar (Clamp)</option>
                                 <option value="MIRROR">Espejo (Mirror)</option>
                             </select>
                          </div>

                          {/* URL Input */}
                          <input 
                            type="text" 
                            placeholder="https://..."
                            value={uniform.value as string}
                            onChange={(e) => updateUniformValue(uniform.id, e.target.value)}
                             className="bg-gray-900 border border-gray-700 text-[10px] p-2 rounded text-gray-300 focus:border-cyan-500 focus:outline-none font-mono"
                          />

                          {/* Action Buttons */}
                          <div className="flex gap-2">
                              <label className="flex-1 flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 text-gray-200 text-[10px] py-1.5 rounded cursor-pointer transition-colors border border-gray-600">
                                  <Upload size={12} /> Subir
                                  <input 
                                      type="file" 
                                      accept="image/*" 
                                      className="hidden" 
                                      onChange={(e) => handleFileUpload(e, uniform.id)}
                                  />
                              </label>
                              <button 
                                  onClick={() => updateUniformValue(uniform.id, createNoiseTextureURI())}
                                  className="flex-1 flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 text-gray-200 text-[10px] py-1.5 rounded transition-colors border border-gray-600"
                              >
                                  <Shuffle size={12} /> Ruido
                              </button>
                          </div>
                          <div className="text-[9px] text-gray-500 text-center">Para URLs externas, usa servicios con CORS (ej: imgur, uvchecker).</div>
                      </div>
                  )}

                  {/* MATRIX UI */}
                  {uniform.type === UniformType.MAT3 && renderMatrixInputs(uniform, 3)}
                  {uniform.type === UniformType.MAT4 && renderMatrixInputs(uniform, 4)}
                  </>
              )}
            </div>
          ))}
        </div>

        {/* Built-in Help */}
        <div className="pt-4 border-t border-gray-800">
             <h4 className="text-xs font-bold text-gray-500 flex items-center gap-1 mb-2"><HelpCircle size={12}/> Variables Built-in</h4>
             <ul className="text-[10px] text-gray-400 font-mono space-y-1 pl-2">
                 <li>uniform float u_time;</li>
                 <li>uniform vec2 u_mouse; <span className="text-gray-600">// (0,0) a (1,1)</span></li>
                 <li>uniform vec2 u_resolution;</li>
                 <li>uniform vec3 u_cameraPosition;</li>
                 <li className="text-yellow-500/80 mt-1 block">-- Iluminación (Max 4) --</li>
                 <li>uniform vec3 u_lightPos[4];</li>
                 <li>uniform vec3 u_lightColor[4];</li>
                 <li>uniform float u_lightIntensity[4];</li>
                 <li className="text-gray-600 italic mt-1">attribute vec3 position;</li>
                 <li className="text-gray-600 italic">attribute vec3 normal;</li>
                 <li className="text-gray-600 italic">attribute vec2 uv;</li>
             </ul>
        </div>
      </div>
    </div>
  );
};