struct Splat {
    @location(0) position: vec3<f32>,
    @location(1) scale: vec3<f32>,
    @location(2) color: u32,
    @location(3) rotation: u32,
}

struct VertexOutput {
  @builtin(position) position: vec4<f32>,
  @location(0) color: vec4<f32>,
};

struct Uniforms {
  viewMatrix: mat4x4<f32>,
  projMatrix: mat4x4<f32>,
  resolution: vec2<f32>,
  size: f32,
  _padding: f32,
};

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

@vertex
fn main(splat: Splat, @builtin(vertex_index) vertexIndex: u32, @builtin(instance_index) instanceIndex: u32) -> VertexOutput {
    let quadVertices = array<vec2<f32>, 6>(
        vec2<f32>(-1.0, -1.0),
        vec2<f32>( 1.0, -1.0),
        vec2<f32>(-1.0,  1.0),
        vec2<f32>(-1.0,  1.0),
        vec2<f32>( 1.0, -1.0),
        vec2<f32>( 1.0,  1.0),
    );
  
    let quad_pos = quadVertices[vertexIndex];
    let world_pos = vec4<f32>(splat.position.x, -splat.position.y, splat.position.z, 1.0);
    let view_pos = uniforms.viewMatrix * world_pos;
    let proj_pos = uniforms.projMatrix * view_pos;
    
    // Calculate screen-space quad position
    let screen_pos = proj_pos.xyz / proj_pos.w;
    let screen_quad_pos = screen_pos.xy + quad_pos * uniforms.size / uniforms.resolution * 2.0;
  
    let normalizedColor = vec4<f32>(
        f32((splat.color >> 0) & 0xFF) / 255.0,
        f32((splat.color >> 8) & 0xFF) / 255.0,
        f32((splat.color >> 16) & 0xFF) / 255.0,
        f32((splat.color >> 24) & 0xFF) / 255.0
    );
  
    var output: VertexOutput;
    output.position = vec4<f32>(screen_quad_pos, screen_pos.z, 1.0);
    output.color = normalizedColor;
  
    return output;
}