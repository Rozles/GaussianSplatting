@fragment
fn main(@location(0) color: vec4<f32>, @location(1) sigma: mat4x4<f32>, @location(2) uv: vec2<f32>) -> @location(0) vec4<f32> {
    return vec4<f32>(color);
}