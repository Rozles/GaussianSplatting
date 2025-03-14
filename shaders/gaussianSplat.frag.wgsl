struct FragmentInput {
    @location(0) uv: vec2<f32>,
    @location(1) color: vec4<f32>,
    @location(2) cov_inv: vec4<f32>,
}

@fragment
fn main(input: FragmentInput) -> @location(0) vec4<f32> {
    let x = input.uv.x;
    let y = input.uv.y;

    let a= input.cov_inv.x;
    let b= input.cov_inv.y;
    let c= input.cov_inv.z;
    let d= input.cov_inv.w;

    let temp = vec2<f32>(x * a + y * c, x * b + y * d);
    let power = -0.5 * dot(temp, input.uv); 
    
    let alpha = input.color[3] * exp(power);

    return vec4<f32>(input.color.xyz * alpha, alpha);

    // let r = dot(input.uv, input.uv);
    // if (r > 1.0){ discard; } // circle
    
    // let splatOpacity = input.color.w;
    // let Gv = exp(-0.5 * r);
    // let a = Gv * splatOpacity;
    // return vec4(a * input.color.rgb, a);
}