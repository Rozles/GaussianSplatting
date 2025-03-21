struct Uniforms {
    viewProj: mat4x4<f32>,
};
@group(0) @binding(0) var<uniform> uniforms: Uniforms;

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) color: vec4<f32>,
};

@vertex
fn main(@location(0) position: vec3<f32>, @location(1) color: vec4<u32>) -> VertexOutput {
    let pos = vec4<f32>(position.x, -position.y, position.z, 1.0);
    let normalizedColor = vec4<f32>(color.rgba) / 255.0;
    var output: VertexOutput;
    output.position = uniforms.viewProj * pos;
    output.color = normalizedColor;
    return output;
}