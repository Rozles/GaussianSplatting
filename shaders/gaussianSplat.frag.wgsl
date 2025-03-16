struct FragmentInput {
    @location(0) uv: vec2<f32>,
    @location(1) color: vec4<f32>,
    @location(2) cov_inv: vec4<f32>,
    @location(3) sigma: f32,
}

@fragment
fn main(input: FragmentInput) -> @location(0) vec4<f32> {
    let uv = input.uv;

    let temp = vec2<f32>(
        uv.x * input.cov_inv.x + uv.y * input.cov_inv.y,
        uv.x * input.cov_inv.z + uv.y * input.cov_inv.w
    );
    let r = dot(uv, temp);

    if r > 1.0 {
        discard;
    }

    let alpha = input.color.a * exp(-0.5 * r);

    return vec4<f32>(input.color.rgb, alpha);

 ////// HERER IS DEVIDER

    // let d = input.uv;  // UV coordinates already centered at (0,0)

    // // Apply the 2D Gaussian function
    // let transformed_d = vec2<f32>(
    //     input.cov_inv[0] * d.x + input.cov_inv[1] * d.y,
    //     input.cov_inv[2] * d.x + input.cov_inv[3] * d.y
    // );


    // let falloff = exp(-0.5 * dot(d, transformed_d));  // Compute Gaussian falloff

    // var alpha = input.color.a * falloff;  // Modulate the alpha with Gaussian falloff

    // // // Border handling
    // // if (input.uv.x >= 0.99 || input.uv.y >= 0.99) {
    // //     alpha = 1.0;
    // // }

    // // if (input.uv.x <= -0.99 || input.uv.y <= -0.99) {
    // //     alpha = 1.0;
    // // }

    // // Modulate the alpha with Gaussian falloff
    // let finalColor = vec4<f32>(input.color.rgb, alpha);
    // return finalColor;


/////////////

    //return vec4<f32>(input.color.rgb * input.color.a, input.color.a);

////////////


    // let uv_color = (input.uv + vec2<f32>(1.0, 1.0)) / 2.0;
    // return vec4<f32>(uv_color, 0.0, 1.0);

    // let uv = input.uv * 1.0;
    // let temp = vec2<f32>(
    //     uv.x * input.cov_inv.x + uv.y * input.cov_inv.y,
    //     uv.x * input.cov_inv.z + uv.y * input.cov_inv.w
    // );

    // let r = dot(uv, uv);

    // if (r > 2.0) {
    //     discard;
    // }

    // let alpha = input.color.a * exp(-0.5 * r);

    // if (alpha < 0.01) {
    //     discard;
    // }

    // return vec4<f32>(input.color.rgb, alpha);
}