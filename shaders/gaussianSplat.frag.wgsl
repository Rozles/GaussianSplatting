fn inverse2x2(m: mat2x2<f32>) -> mat2x2<f32> {
    let det = m[0][0] * m[1][1] - m[0][1] * m[1][0];
    return mat2x2<f32>(
        vec2<f32>(m[1][1] / det, -m[0][1] / det),
        vec2<f32>(-m[1][0] / det, m[0][0] / det)
    );
}

@fragment
fn main(@location(0) color: vec4<f32>, 
        @location(1) sigma1: vec2<f32>,
        @location(2) sigma2: vec2<f32>,
        @location(3) uv: vec2<f32>) -> @location(0) vec4<f32> {
    
    let sigma: mat2x2<f32> = mat2x2<f32>(
        vec2<f32>(sigma1),
        vec2<f32>(sigma2)
    );

    let gaussian = exp(-0.5 * dot(uv, inverse2x2(sigma) * uv));

    return vec4<f32>(color.rgb, color.a * gaussian);
}