import { ShaderPreset } from './types';

// Helper to generate a procedural noise texture (Data URI)
export const createNoiseTextureURI = () => {
  const width = 256;
  const height = 256;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const imgData = ctx.createImageData(width, height);
  for (let i = 0; i < imgData.data.length; i += 4) {
    const val = Math.floor(Math.random() * 255);
    imgData.data[i] = val;     // R
    imgData.data[i + 1] = val; // G
    imgData.data[i + 2] = val; // B
    imgData.data[i + 3] = 255; // Alpha
  }
  ctx.putImageData(imgData, 0, 0);
  return canvas.toDataURL();
};

export const DEFAULT_VERTEX_SHADER = `
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vPosition;

uniform float u_time;

void main() {
  vUv = uv;
  // Use World Space for normals to match lighting calculations
  // modelMatrix transforms position to world, mat3(modelMatrix) handles rotation/scale for normals
  vNormal = normalize(mat3(modelMatrix) * normal);
  
  // Posición en el espacio del mundo (necesaria para iluminación)
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vPosition = worldPosition.xyz;
  
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`.trim();

// Vertex shader specifically for Texture Mapping to ensure clarity
export const TEXTURE_VERTEX_SHADER = `
varying vec2 vUv;
varying vec3 vNormal;

void main() {
  vUv = uv;
  vNormal = normal;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`.trim();

export const DEFAULT_FRAGMENT_SHADER = `
varying vec2 vUv;
varying vec3 vNormal;

uniform float u_time;
uniform vec3 u_color; 

void main() {
  vec3 color = 0.5 + 0.5 * cos(u_time + vNormal.xyz + vec3(0, 2, 4));
  gl_FragColor = vec4(color, 1.0);
}
`.trim();

export const SHADER_PRESETS: ShaderPreset[] = [
  {
    name: 'Básico (Normales)',
    description: 'Muestra las normales de la superficie como colores.',
    vertex: DEFAULT_VERTEX_SHADER,
    fragment: `
varying vec2 vUv;
varying vec3 vNormal;

void main() {
  vec3 color = vNormal * 0.5 + 0.5;
  gl_FragColor = vec4(color, 1.0);
}
    `.trim()
  },
  {
    name: 'Realista (Phong)',
    description: 'Simula iluminación Lambertiana y Especular con atenuación por distancia.',
    vertex: DEFAULT_VERTEX_SHADER,
    fragment: `
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vPosition;

// Definimos un máximo de luces
#define MAX_LIGHTS 4

uniform vec3 u_lightPos[MAX_LIGHTS];
uniform vec3 u_lightColor[MAX_LIGHTS];
uniform float u_lightIntensity[MAX_LIGHTS];
uniform vec3 u_cameraPosition;

void main() {
  vec3 normal = normalize(vNormal);
  // Calculamos la dirección de la vista usando la posición de la cámara del mundo real
  vec3 viewDir = normalize(u_cameraPosition - vPosition);
  
  // Color base del objeto (Grisáceo)
  vec3 objectColor = vec3(0.8, 0.8, 0.8);
  vec3 totalLighting = vec3(0.0);
  
  // Luz Ambiental base (suave)
  vec3 ambient = vec3(0.05); 
  
  for(int i = 0; i < MAX_LIGHTS; i++) {
      if(u_lightIntensity[i] <= 0.01) continue;

      float dist = length(u_lightPos[i] - vPosition);
      vec3 lightDir = normalize(u_lightPos[i] - vPosition);
      
      // Atenuación (Inverse Square Law aproximada)
      // Evita que la luz sea infinita y queme la imagen
      float attenuation = 1.0 / (1.0 + 0.1 * dist + 0.05 * dist * dist);
      
      // 2. Componente Difusa (Lambert)
      float diff = max(dot(normal, lightDir), 0.0);
      vec3 diffuse = diff * u_lightColor[i] * u_lightIntensity[i] * attenuation;
      
      // 3. Componente Especular (Phong)
      vec3 reflectDir = reflect(-lightDir, normal);
      float spec = pow(max(dot(viewDir, reflectDir), 0.0), 32.0);
      vec3 specular = spec * u_lightColor[i] * u_lightIntensity[i] * attenuation;
      
      totalLighting += (diffuse + specular);
  }
  
  vec3 finalColor = (ambient + totalLighting) * objectColor;
  
  // Simple Tone Mapping para evitar saturación extrema si hay muchas luces
  finalColor = finalColor / (finalColor + vec3(1.0));
  finalColor = pow(finalColor, vec3(1.0/2.2)); // Gamma Correction

  gl_FragColor = vec4(finalColor, 1.0);
}
    `.trim()
  },
  {
    name: 'Olas de Vértices',
    description: 'Modifica la posición de los vértices usando una función seno.',
    vertex: `
varying vec2 vUv;
varying float vElevation;

uniform float u_time;

void main() {
  vUv = uv;
  
  vec3 newPos = position;
  float elevation = sin(position.x * 5.0 + u_time) * 0.2;
  elevation += sin(position.y * 3.0 + u_time * 0.5) * 0.1;
  
  newPos.z += elevation;
  vElevation = elevation;

  gl_Position = projectionMatrix * modelViewMatrix * vec4(newPos, 1.0);
}
    `.trim(),
    fragment: `
varying vec2 vUv;
varying float vElevation;

void main() {
  vec3 colorA = vec3(0.1, 0.4, 0.9);
  vec3 colorB = vec3(0.9, 0.1, 0.4);
  
  float mixStrength = (vElevation + 0.3) * 2.0;
  vec3 color = mix(colorA, colorB, mixStrength);
  
  gl_FragColor = vec4(color, 1.0);
}
    `.trim()
  },
  {
    name: 'Plasma Psicodélico',
    description: 'Patrones complejos generados en el fragment shader.',
    vertex: DEFAULT_VERTEX_SHADER,
    fragment: `
varying vec2 vUv;
uniform float u_time;

void main() {
  vec2 uv = vUv * 10.0;
  float t = u_time * 0.5;
  
  vec2 p = uv;
  float v = sin(p.x + t);
  v += sin(p.y + t);
  v += sin(p.x + p.y + t);
  v += sin(length(p) + t);
  
  vec3 color = vec3(sin(v), sin(v + 1.0), sin(v + 2.0));
  color = color * 0.5 + 0.5;
  
  gl_FragColor = vec4(color, 1.0);
}
    `.trim()
  },
  {
    name: 'Textura (Imagen)',
    description: 'Mapea una imagen 2D sobre la geometría usando coordenadas UV.',
    vertex: TEXTURE_VERTEX_SHADER,
    fragment: `
varying vec2 vUv;
uniform float u_time;

uniform sampler2D u_texture;

void main() {
  // Coordenadas UV básicas
  vec2 uv = vUv;
  
  // Efecto opcional: desplazamiento de UV con el tiempo
  // uv.x += sin(uv.y * 10.0 + u_time) * 0.02;
  
  vec4 texColor = texture2D(u_texture, uv);
  
  gl_FragColor = texColor;
}
    `.trim()
  }
];