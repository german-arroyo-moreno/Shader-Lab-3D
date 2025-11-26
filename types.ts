export enum UniformType {
  FLOAT = 'float',
  VEC2 = 'vec2',
  VEC3 = 'vec3',
  VEC4 = 'vec4',
  MAT3 = 'mat3',
  MAT4 = 'mat4',
  SAMPLER_2D = 'sampler2D',
}

export type TextureWrapMode = 'REPEAT' | 'CLAMP' | 'MIRROR';

export interface CustomUniform {
  id: string;
  name: string;
  type: UniformType;
  value: number | number[] | string; // string for texture URLs
  min?: number;
  max?: number;
  binding?: 'TIME' | 'MOUSE';
  wrap?: TextureWrapMode; // Texture wrapping mode
}

export interface Light {
  id: string;
  position: [number, number, number];
  color: string;
  intensity: number;
}

export interface ShaderPreset {
  name: string;
  vertex: string;
  fragment: string;
  description: string;
}

export type GeometryType = 'box' | 'sphere' | 'torus' | 'plane' | 'custom';