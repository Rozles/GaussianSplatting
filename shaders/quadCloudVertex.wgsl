struct Splat {
    @location(0) position: vec3<f32>,
    @location(1) scale: vec3<f32>,
    @location(2) color: u32,
    @location(3) rotation: u32,
}

struct Uniforms {
    matrix: mat4x4<f32>,
    resolution: vec2<f32>,
    size: f32,
}

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) color: vec4<f32>,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

@vertex
fn main(splat: Splat, @builtin(vertex_index) index: u32) -> VertexOutput {
    let quadVertices = array<vec2<f32>, 6>(
        vec2<f32>(-1.0, -1.0),
        vec2<f32>( 1.0, -1.0),
        vec2<f32>(-1.0,  1.0),
        vec2<f32>(-1.0,  1.0),
        vec2<f32>( 1.0, -1.0),
        vec2<f32>( 1.0,  1.0),
    );

    let quadVertex = quadVertices[index];
    let worldPos = vec4<f32>(splat.position.x, -splat.position.y, splat.position.z, 1.0);
    let clipPos = uniforms.matrix * worldPos;
    let pointPos = vec4f(quadVertex * 2 * uniforms.size / uniforms.resolution, 0, 0);

    var output: VertexOutput;
    output.position = clipPos + pointPos;
    
    let normalizedColor = vec4<f32>(
            f32((splat.color >> 0) & 0xFF) / 255.0,
            f32((splat.color >> 8) & 0xFF) / 255.0,
            f32((splat.color >> 16) & 0xFF) / 255.0,
            f32((splat.color >> 24) & 0xFF) / 255.0
        );
    output.color = normalizedColor;

    return output;
}


