struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) color: vec4<f32>,
}

@fragment
fn main(input: VertexOutput) -> @location(0) vec4<f32> {

    // Visualize depth using color gradient
    let depth = input.position.z;
    let normalizedDepth = input.position.z;
    // Create a heatmap gradient (blue to red)
    let r = normalizedDepth;
    let g = 0.0;
    let b = 1.0 - normalizedDepth;
    
    return vec4<f32>(r, g, b, 1.0);
  }