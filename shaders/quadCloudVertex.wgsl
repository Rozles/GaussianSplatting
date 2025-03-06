
struct Splat {
    @location(0) position: vec3<f32>,
    @location(1) scale: vec3<f32>,
    @location(2) color: u32,
    @location(3) rotation: u32,
}

struct Uniforms {
    viewMatrix: mat4x4f,
    projMatrix: mat4x4f,
    size: f32,
};

struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) color: vec4f,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

@vertex
fn main(splat: Splat, @builtin(vertex_index) index: u32) -> VertexOutput {
  let quadVertices = array(
    vec2f(-1, -1),
    vec2f( 1, -1),
    vec2f(-1,  1),
    vec2f( 1,  1),
  );
  var output: VertexOutput;
  let pos = vec4(position[index].x, -position[index].y, position[index].z, 1);
  let viewPos = uniforms.viewMatrix * vert.position;
  let pointPos = vec4f(pos * uni.size / uni.resolution, 0, 0);
  output.position = clipPos + pointPos;
  output.texcoord = pos * 0.5 + 0.5;
  return output;
}
