// Define uniform buffer for min/max values
struct MinMax {
    minX: f32,
    maxX: f32,
    minY: f32,
    maxY: f32,
    minZ: f32,
    maxZ: f32,
};
@group(0) @binding(0) var<uniform> minMax: MinMax;

@vertex
fn main(@location(0) position: vec3<f32>) -> @builtin(position) vec4<f32> {
    let minVals = vec3<f32>(minMax.minX, minMax.minY, minMax.minZ);
    let maxVals = vec3<f32>(minMax.maxX, minMax.maxY, minMax.maxZ);

    // Normalize
    let normalized = (position - minVals) / (maxVals - minVals) * 2.0 - 1.0;

    return vec4<f32>(normalized, 1.0);
}