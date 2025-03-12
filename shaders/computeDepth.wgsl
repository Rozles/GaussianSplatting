struct Uniforms {
  viewMatrix: mat4x4<f32>,
  projMatrix: mat4x4<f32>,
  resolution: vec2<f32>,
  pointSize: f32,
  _padding: f32,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;
@group(0) @binding(1) var<storage, read> points: array<f32>;
@group(0) @binding(2) var<storage, read_write> depthIndices: array<u32>;
@group(0) @binding(3) var<storage, read_write> depthValues: array<f32>;

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let index = global_id.x;
  if (index >= arrayLength(&depthIndices)) {
    return;
  }
  
  // Read position from points buffer (assuming xyz are at offsets 0,1,2)
  let posX = points[index * 8 + 0];
  let posY = points[index * 8 + 1];
  let posZ = points[index * 8 + 2];
  
  // Transform to view space to get depth
  let viewPos = uniforms.viewMatrix * vec4<f32>(posX, posY, posZ, 1.0);
  let depth = -viewPos.z; // Negative because camera looks along -Z
  
  // Store depth and index
  depthIndices[index] = index;
  depthValues[index] = depth;
}