struct FragmentInput {
    @location(0) uv: vec2<f32>,
    @location(1) color: vec4<f32>,
    @location(2) cov_inv: vec4<f32>,
}

@fragment
fn main(input: FragmentInput) -> @location(0) vec4<f32> {
    let cov_inv = mat2x2<f32>(
        vec2<f32>(input.cov_inv.x, input.cov_inv.y),
        vec2<f32>(input.cov_inv.z, input.cov_inv.w)
    );

    let power = -0.5 * dot(input.uv, cov_inv * input.uv);
    
    if (power < -10.0) {
        discard;
    }

    let alpha = input.color[3] * exp(power);

    if (alpha < 0.01) {
        discard;
    }
    
    return vec4<f32>(input.color.xyz * alpha, alpha);
}