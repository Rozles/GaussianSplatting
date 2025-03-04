struct Uniforms {
    viewProj: mat4x4<f32>,
    minVals: vec3<f32>,
    maxVals: vec3<f32>,
};
@group(0) @binding(0) var<uniform> uniforms: Uniforms;

@vertex
fn main(@location(0) position: vec3<f32>) -> @builtin(position) vec4<f32> {
    let normalized = (position - uniforms.minVals) / (uniforms.maxVals - uniforms.minVals) * 2.0 - 1.0;
    let pos = vec4<f32>(normalized, 1.0);
    return uniforms.viewProj * pos;
}