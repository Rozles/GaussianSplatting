struct FragmentInput {
    @location(0) uv: vec2<f32>,
    @location(1) color: vec4<f32>,
    @location(2) cov_inv: vec4<f32>,
    @location(3) cutoff: f32,
}

@fragment
fn main(input: FragmentInput) -> @location(0) vec4<f32> {
    let uv = input.uv;

    let rgb = input.color.rgb; 

    let radius = dot(uv, uv);
    if (radius > input.cutoff * input.cutoff) {
        discard;
    }

    let transformed_uv = vec2<f32>(
        uv.x * input.cov_inv.x + uv.y * input.cov_inv.y,
        uv.x * input.cov_inv.z + uv.y * input.cov_inv.w
    );

    let r = dot(transformed_uv, uv);

    let falloff = exp(-0.5 * radius);

    let alpha = input.color.a * falloff;

    return vec4<f32>(rgb, alpha);
}