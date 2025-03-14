struct FragmentInput {
    @location(0) uv: vec2<f32>,
    @location(1) color: vec4<f32>,
    @location(2) cov_inv: vec4<f32>,
}

@fragment
fn main(input: FragmentInput) -> @location(0) vec4<f32> {
    let temp = vec2<f32>(
        input.uv.x * input.cov_inv.x + input.uv.y * input.cov_inv.y,
        input.uv.x * input.cov_inv.z + input.uv.y * input.cov_inv.w
    );
    let r = dot(input.uv, temp);

    if r > 4.0 {
        discard;
    }

    let alpha = input.color.a * exp(-0.5 * r);

    return vec4<f32>(input.color.rgb * alpha, alpha);
}