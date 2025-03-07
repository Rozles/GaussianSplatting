struct Splat {
    @location(0) position: vec3<f32>,
    @location(1) scale: vec3<f32>,
    @location(2) color: u32,
    @location(3) rotation: u32,
}

struct Uniforms {
    viewMatrix: mat4x4<f32>,
    projMatrix: mat4x4<f32>,
    size: f32,
}

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) color: vec4<f32>,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

@vertex
fn main(splat: Splat, @builtin(vertex_index) index: u32) -> VertexOutput {
    let quadVertices = array<vec2<f32>, 4>(
        vec2<f32>(-1.0, -1.0),
        vec2<f32>( 1.0, -1.0),
        vec2<f32>(-1.0,  1.0),
        vec2<f32>( 1.0,  1.0),
    );

    var output: VertexOutput;

    // Calculate the position of the vertex in world space
    let localPos = quadVertices[index];
    let scaled = localPos * uniforms.size / splat.position.z;
    let worldPos = splat.position + vec3<f32>(scaled, 0.0);

    // Transform to clip space
    let viewPos = uniforms.viewMatrix * vec4<f32>(worldPos, 1.0);
    output.position = uniforms.projMatrix * viewPos;

    // Pass the color to the fragment shader
    let normalizedColor = vec4<f32>(
        f32((splat.color >> 24) & 0xFF) / 255.0,
        f32((splat.color >> 16) & 0xFF) / 255.0,
        f32((splat.color >> 8) & 0xFF) / 255.0,
        f32(splat.color & 0xFF) / 255.0
    );
    output.color = normalizedColor;

    return output;
}
