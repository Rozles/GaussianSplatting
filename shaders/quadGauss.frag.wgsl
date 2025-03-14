struct FragmentInput {
    @location(0) color: vec4<f32>,
    @location(1) uv: vec2<f32>,
    @location(2) sigma: f32,
}


@fragment
fn main(input: FragmentInput) -> @location(0) vec4<f32> {
    let alpha = exp(-0.5 * dot(input.uv, input.uv) * input.sigma);
    return vec4<f32>(input.color.rgb * alpha, alpha);
}