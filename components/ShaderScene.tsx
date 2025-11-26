import React, { useRef, useMemo, useEffect, useState, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Environment, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { GeometryType, CustomUniform, UniformType, Light, TextureWrapMode } from '../types';

interface ShaderMeshProps {
  vertexShader: string;
  fragmentShader: string;
  geometryType: GeometryType;
  customModel?: string | null;
  customUniforms: CustomUniform[];
  lights: Light[];
  hideAxes: boolean;
  isWireframe: boolean;
  onError?: (error: string) => void;
  onSuccess?: () => void;
}

// Prefixes matching standard THREE.ShaderMaterial inputs for validation
const THREE_VERTEX_PREFIX = `
#define SHADER_NAME ShaderMaterial
#define VERTEX
precision highp float;
uniform mat4 modelMatrix;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat4 viewMatrix;
uniform mat3 normalMatrix;
uniform vec3 cameraPosition;
attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv;
`;

const THREE_FRAGMENT_PREFIX = `
#define SHADER_NAME ShaderMaterial
#define FRAGMENT
precision highp float;
uniform mat4 viewMatrix;
uniform vec3 cameraPosition;
`;

// Helper to count lines for error offset calculation
const countLines = (str: string) => (str.match(/\n/g) || []).length;
const VERTEX_OFFSET = countLines(THREE_VERTEX_PREFIX);
const FRAGMENT_OFFSET = countLines(THREE_FRAGMENT_PREFIX);

// Helper to clean up error logs and fix line numbers
const parseErrorLog = (log: string, offset: number) => {
    // Matches standard GLSL error format: ERROR: 0:LINE: Message
    return log.replace(/ERROR: \d+:(\d+):/g, (match, line) => {
        const adjusted = Math.max(1, parseInt(line) - offset);
        return `ERROR: line ${adjusted}:`;
    });
};

const getWrapMode = (mode?: TextureWrapMode) => {
    switch(mode) {
        case 'CLAMP': return THREE.ClampToEdgeWrapping;
        case 'MIRROR': return THREE.MirroredRepeatWrapping;
        case 'REPEAT': 
        default: return THREE.RepeatWrapping;
    }
}

// Helper component to extract geometry from uploaded GLB/GLTF
const CustomGeometry: React.FC<{ url: string }> = ({ url }) => {
    const { scene } = useGLTF(url);
    const geometry = useMemo(() => {
        let geom: THREE.BufferGeometry | null = null;
        scene.traverse((obj) => {
            if (!geom && (obj as THREE.Mesh).isMesh) {
                geom = (obj as THREE.Mesh).geometry;
            }
        });
        return geom?.clone(); // Clone to be safe
    }, [scene]);

    if (!geometry) return <boxGeometry args={[1,1,1]} />;
    return <primitive object={geometry} attach="geometry" />;
};

const ShaderMesh: React.FC<ShaderMeshProps> = ({ 
  vertexShader, 
  fragmentShader, 
  geometryType,
  customModel,
  customUniforms,
  lights,
  isWireframe,
  onError,
  onSuccess
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  // Safe State: Only updated when code is valid
  const [safeVertex, setSafeVertex] = useState(vertexShader);
  const [safeFragment, setSafeFragment] = useState(fragmentShader);

  // --- Validation Logic ---
  useEffect(() => {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return;

    // 1. Prepare Sources
    const vsSource = THREE_VERTEX_PREFIX + vertexShader;
    const fsSource = THREE_FRAGMENT_PREFIX + fragmentShader;

    // 2. Compile Function
    const compile = (type: number, source: string) => {
        const shader = gl.createShader(type);
        if(!shader) return { error: "Failed to create shader", shader: null };
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            const info = gl.getShaderInfoLog(shader);
            gl.deleteShader(shader);
            return { error: info, shader: null };
        }
        return { error: null, shader: shader };
    };

    // 3. Validate Shaders
    const vsResult = compile(gl.VERTEX_SHADER, vsSource);
    const fsResult = compile(gl.FRAGMENT_SHADER, fsSource);

    if (vsResult.error) {
        if(onError) onError(`VERTEX SHADER ERROR:\n${parseErrorLog(vsResult.error, VERTEX_OFFSET)}`);
        return;
    }
    
    if (fsResult.error) {
        if(onError) onError(`FRAGMENT SHADER ERROR:\n${parseErrorLog(fsResult.error, FRAGMENT_OFFSET)}`);
        return;
    }

    // 4. Validate Linking (Catches varying mismatches)
    const program = gl.createProgram();
    if (program && vsResult.shader && fsResult.shader) {
        gl.attachShader(program, vsResult.shader);
        gl.attachShader(program, fsResult.shader);
        gl.linkProgram(program);
        
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            const info = gl.getProgramInfoLog(program);
            if(onError) onError(`LINKER ERROR (Varying Mismatch?):\n${info}`);
            return;
        }
    }

    // Cleanup
    if (vsResult.shader) gl.deleteShader(vsResult.shader);
    if (fsResult.shader) gl.deleteShader(fsResult.shader);
    if (program) gl.deleteProgram(program);

    // 5. Success: Update the Rendered Shader
    if (onSuccess) onSuccess();
    setSafeVertex(vertexShader);
    setSafeFragment(fragmentShader);

  }, [vertexShader, fragmentShader, onError, onSuccess]);

  // --- Uniforms Memoization ---
  const uniforms = useMemo(() => {
    return {
      u_time: { value: 0 },
      u_resolution: { value: new THREE.Vector2() },
      u_mouse: { value: new THREE.Vector2() },
      u_cameraPosition: { value: new THREE.Vector3() },
      // Initialize Light Arrays (Max 4)
      u_lightPos: { value: [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()] },
      u_lightColor: { value: [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()] },
      u_lightIntensity: { value: [0, 0, 0, 0] }
    };
  }, []);

  // --- Live Update Uniforms & Lights ---
  useEffect(() => {
    if (!materialRef.current) return;

    // Sync Custom Uniforms
    customUniforms.forEach(cu => {
      let initialValue: any;
      const v = cu.value;

      if (cu.type === UniformType.VEC3 && Array.isArray(v)) {
        initialValue = new THREE.Vector3(v[0], v[1], v[2]);
      } else if (cu.type === UniformType.VEC2 && Array.isArray(v)) {
        initialValue = new THREE.Vector2(v[0], v[1]);
      } else if (cu.type === UniformType.VEC4 && Array.isArray(v)) {
        initialValue = new THREE.Vector4(v[0], v[1], v[2], v[3]);
      } else if (cu.type === UniformType.MAT3 && Array.isArray(v)) {
        initialValue = new THREE.Matrix3();
        initialValue.fromArray(v);
      } else if (cu.type === UniformType.MAT4 && Array.isArray(v)) {
        initialValue = new THREE.Matrix4();
        initialValue.fromArray(v);
      } else if (cu.type === UniformType.SAMPLER_2D && typeof v === 'string') {
         // Texture Loader - Returns a Texture immediately (empty) that updates when loaded
         initialValue = new THREE.TextureLoader().load(v);
      } else {
        initialValue = v;
      }

      if (materialRef.current.uniforms[cu.name]) {
        // If it exists, update value
        if (!cu.binding) {
            // Special handling for textures to avoid overwriting the texture object if value is the same string (optimization optional, but safer to reassign)
             if (cu.type !== UniformType.SAMPLER_2D) {
                 materialRef.current.uniforms[cu.name].value = initialValue;
             } else {
                 // For textures, we only reload if the URL changed or we want to force it. 
                 // Since we created a new Texture object above, let's assign it.
                 materialRef.current.uniforms[cu.name].value = initialValue;
             }
        }
      } else {
        // If it doesn't exist, create it
        materialRef.current.uniforms[cu.name] = { value: initialValue };
        materialRef.current.needsUpdate = true;
      }

      // Handle Texture Wrapping
      if (cu.type === UniformType.SAMPLER_2D) {
          const texture = materialRef.current.uniforms[cu.name].value;
          if (texture && texture.isTexture) {
              const wrapMode = getWrapMode(cu.wrap);
              if (texture.wrapS !== wrapMode || texture.wrapT !== wrapMode) {
                  texture.wrapS = wrapMode;
                  texture.wrapT = wrapMode;
                  texture.needsUpdate = true;
                  materialRef.current.needsUpdate = true;
              }
          }
      }
    });

    // Sync Lights
    const lightPositions: THREE.Vector3[] = materialRef.current.uniforms.u_lightPos.value;
    const lightColors: THREE.Vector3[] = materialRef.current.uniforms.u_lightColor.value;
    const lightIntensities: number[] = materialRef.current.uniforms.u_lightIntensity.value;

    // Reset all
    for(let i=0; i<4; i++) lightIntensities[i] = 0;

    lights.slice(0, 4).forEach((light, i) => {
        lightPositions[i].set(light.position[0], light.position[1], light.position[2]);
        const col = new THREE.Color(light.color);
        lightColors[i].set(col.r, col.g, col.b);
        lightIntensities[i] = light.intensity;
    });

    materialRef.current.uniformsNeedUpdate = true;

  }, [customUniforms, lights]);

  // --- Render Loop ---
  useFrame((state) => {
    if (materialRef.current) {
      // Update Built-ins
      materialRef.current.uniforms.u_time.value = state.clock.elapsedTime;
      materialRef.current.uniforms.u_mouse.value.x = (state.pointer.x + 1) / 2;
      materialRef.current.uniforms.u_mouse.value.y = (state.pointer.y + 1) / 2;
      materialRef.current.uniforms.u_resolution.value.set(
        state.size.width * state.viewport.dpr, 
        state.size.height * state.viewport.dpr
      );
      materialRef.current.uniforms.u_cameraPosition.value.copy(state.camera.position);

      // Update Bindings
      customUniforms.forEach(cu => {
        if (!cu.binding) return;
        const uniform = materialRef.current?.uniforms[cu.name];
        if (!uniform) return;

        if (cu.binding === 'TIME') uniform.value = state.clock.elapsedTime;
        else if (cu.binding === 'MOUSE') {
           uniform.value.x = (state.pointer.x + 1) / 2;
           uniform.value.y = (state.pointer.y + 1) / 2;
        }
      });
    }
  });

  // Unique key to force re-construction when SAFE shader code changes
  const materialKey = `${safeVertex}-${safeFragment}`;

  return (
    <mesh ref={meshRef}>
      {geometryType === 'box' && <boxGeometry args={[2, 2, 2, 64, 64, 64]} />}
      {geometryType === 'sphere' && <sphereGeometry args={[1.5, 64, 64]} />}
      {geometryType === 'torus' && <torusGeometry args={[1.2, 0.4, 64, 128]} />}
      {geometryType === 'plane' && <planeGeometry args={[4, 4, 64, 64]} />}
      
      {geometryType === 'custom' && customModel && (
          <Suspense fallback={<boxGeometry args={[1,1,1]} />}>
              <CustomGeometry url={customModel} />
          </Suspense>
      )}
      
      <shaderMaterial
        key={materialKey}
        ref={materialRef}
        vertexShader={safeVertex}
        fragmentShader={safeFragment}
        uniforms={uniforms}
        side={THREE.DoubleSide}
        wireframe={isWireframe}
      />
    </mesh>
  );
};

export const ShaderScene: React.FC<ShaderMeshProps> = (props) => {
  return (
    <div className="w-full h-full relative bg-gray-900 rounded-lg overflow-hidden shadow-2xl border border-gray-800">
      <Canvas>
        <PerspectiveCamera makeDefault position={[0, 0, 6]} />
        <OrbitControls makeDefault />
        <Environment preset="city" />
        <color attach="background" args={['#111115']} />
        
        <Suspense fallback={null}>
            <ShaderMesh {...props} />
        </Suspense>
        
        {/* Blender-style Axis on Grid */}
        {!props.hideAxes && (
            <group position={[0, -1.99, 0]}>
                <mesh position={[0, 0, 0]}>
                    <boxGeometry args={[40, 0.05, 0.05]} />
                    <meshBasicMaterial color="#ff3333" />
                </mesh>
                <mesh position={[0, 0, 0]}>
                    <boxGeometry args={[0.05, 0.05, 40]} />
                    <meshBasicMaterial color="#3333ff" />
                </mesh>
            </group>
        )}

        {/* Lights Visualizers */}
        {props.lights.map((light) => (
            <mesh key={light.id} position={light.position as any}>
                <sphereGeometry args={[0.1, 8, 8]} />
                <meshBasicMaterial color={light.color} />
            </mesh>
        ))}

        <gridHelper args={[20, 20, 0x333333, 0x222222]} position={[0, -2, 0]} />
      </Canvas>
      
      {/* Overlay info */}
      <div className="absolute top-4 left-4 pointer-events-none text-xs text-gray-400 font-mono space-y-1">
        <p className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-500"></span> FPS: 60 (aprox)</p>
        <p className="opacity-70">uniform float u_time;</p>
        <p className="opacity-70">uniform vec2 u_mouse;</p>
      </div>
    </div>
  );
};