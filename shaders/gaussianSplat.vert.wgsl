struct Splat {
    @location(0) position: vec3<f32>,
    @location(1) scale: vec3<f32>,
    @location(2) color: u32,
    @location(3) rotation: u32,
}

struct Uniforms {
    view: mat4x4<f32>,
    projection: mat4x4<f32>,
    resolution: vec2<f32>,
    size: f32,
}

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) uv: vec2<f32>,
    @location(1) color: vec4<f32>,
    @location(2) cov_inv: vec4<f32>,
    @location(3) sigma: f32,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

fn rotation_from_quat(q: vec4<f32>) -> mat3x3<f32> {
    let q_normalized = normalize(q);
    let qr = q_normalized.x;
    let qi = q_normalized.y;
    let qj = q_normalized.z;
    let qk = q_normalized.w;
    
    return transpose(mat3x3<f32>(
        vec3<f32>(1.0 - 2.0 * (qj*qj + qk*qk), 2.0 * (qi*qj - qk*qr), 2.0 * (qi*qk + qj*qr)),
        vec3<f32>(2.0 * (qi*qj + qk*qr), 1.0 - 2.0 * (qi*qi + qk*qk), 2.0 * (qj*qk - qi*qr)),
        vec3<f32>(2.0 * (qi*qk - qj*qr), 2.0 * (qj*qk + qi*qr), 1.0 - 2.0 * (qi*qi + qj*qj))
    ));
}

fn transpose(m: mat3x3<f32>) -> mat3x3<f32> {
    return mat3x3<f32>(
        vec3<f32>(m[0][0], m[1][0], m[2][0]),
        vec3<f32>(m[0][1], m[1][1], m[2][1]),
        vec3<f32>(m[0][2], m[1][2], m[2][2])
    );
}

fn compute_jacobian(position_camera: vec3<f32>) -> mat3x3<f32> {
    let x = position_camera.x;
    let y = position_camera.y;
    let z = position_camera.z;

    let f_x = uniforms.projection[0][0];
    let f_y = uniforms.projection[1][1];

    let focal = vec2<f32>(uniforms.projection[0][0], uniforms.projection[1][1]) * uniforms.resolution;

    let jacobian = mat3x3<f32>(
        vec3<f32>(focal.x / z, 0.0, -x * focal.x / (z * z)),
        vec3<f32>(0.0, focal.y / z, -y * focal.y / (z * z)),
        vec3<f32>(0.0, 0.0, 0.0)
    );
    
    return jacobian;
}

@vertex
fn main(splat: Splat, @builtin(vertex_index) index: u32, @builtin(instance_index) instance: u32) -> VertexOutput {
    let world_pos = vec4<f32>(-splat.position.x, -splat.position.y, -splat.position.z, 1.0);
    let camera_pos = uniforms.view * world_pos;
    let clip_pos = uniforms.projection * camera_pos;

    let qr = f32(((splat.rotation >>  0u) & 0xFF) - 128u) / 128.0;
    let qi = f32(((splat.rotation >>  8u) & 0xFF) - 128u) / 128.0;
    let qj = f32(((splat.rotation >> 16u) & 0xFF) - 128u) / 128.0;
    let qk = f32(((splat.rotation >> 24u) & 0xFF) - 128u) / 128.0;

    let rot_quat = vec4<f32>(qr, qi, qj, qk);

    let rotation = rotation_from_quat(rot_quat);

    let view3 = mat3x3<f32>(
        uniforms.view[0].xyz,
        uniforms.view[1].xyz,
        uniforms.view[2].xyz
    );

    let scale3 = mat3x3<f32>(
        splat.scale.x, 0.0, 0.0,
        0.0, splat.scale.y, 0.0,
        0.0, 0.0, splat.scale.z
    );

    let jacobian = compute_jacobian(camera_pos.xyz);

    let m = jacobian * view3 * rotation * scale3;
    let sigma_dash = m * transpose(m);

    var sigma2 = mat2x2<f32>(
        vec2<f32>(sigma_dash[0][0], sigma_dash[0][1]),
        vec2<f32>(sigma_dash[1][0], sigma_dash[1][1])
    );

    let low_pass = mat2x2<f32>(
        vec2<f32>(0.01, 0.0),
        vec2<f32>(0.0, 0.01)
    );

    sigma2 = sigma2 + low_pass;

    let det = sigma2[0][0] * sigma2[1][1] - sigma2[0][1] * sigma2[1][0];
    let inv_det = 1.0 / max(det, 1e-6);
    
    let sigma2_inv = mat2x2<f32>(
        vec2<f32>(sigma2[1][1] * inv_det, -sigma2[0][1] * inv_det),
        vec2<f32>(-sigma2[1][0] * inv_det, sigma2[0][0] * inv_det)
    );

    let a = sigma2[0][0];
    let b = sigma2[0][1];
    let c = sigma2[1][1];

    let eigenvalue1 = (a + c + sqrt((a + c) * (a + c) - 4 * (a * c - b * b))) / 2;
    let eigenvalue2 = (a + c - sqrt((a + c) * (a + c) - 4 * (a * c - b * b))) / 2;

    
    let eigen_vector1 = normalize(vec2<f32>(b, (eigenvalue1 - a)));
    let eigen_vector2 = vec2<f32>(eigen_vector1.y, -eigen_vector1.x);

    let max_radius = 2.0;

    let major_scale = uniforms.size * sqrt(eigenvalue1) * 0.1;
    let minor_scale = uniforms.size * sqrt(eigenvalue2) * 0.1;
    let major_axis = major_scale * eigen_vector1;
    let minor_axis = minor_scale * eigen_vector2;
    
    let quad_vertex_offset = array<vec2<f32>, 6>(
        vec2<f32>(1.0, -1.0),
        vec2<f32>(-1.0, -1.0),
        vec2<f32>(1.0, 1.0),
        vec2<f32>(-1.0, 1.0),
        vec2<f32>(1.0, 1.0),
        vec2<f32>(-1.0, -1.0)
    );

    let quad_vertex = quad_vertex_offset[index % 6];

    let out_pos = (clip_pos.xy 
                    + quad_vertex.x * clip_pos.w * major_axis / uniforms.resolution
                    + quad_vertex.y * clip_pos.w * minor_axis / uniforms.resolution);

    let normalizedColor = vec4<f32>(
        f32((splat.color >> 0) & 0xFF) / 255.0,
        f32((splat.color >> 8) & 0xFF) / 255.0,
        f32((splat.color >> 16) & 0xFF) / 255.0,
        f32((splat.color >> 24) & 0xFF) / 255.0
    );

    var output: VertexOutput;
    output.position = vec4<f32>(out_pos, clip_pos.zw);
    output.uv = quad_vertex;
    output.color = normalizedColor;
    output.cov_inv = vec4<f32>(sigma2_inv[0][0], sigma2_inv[0][1], sigma2_inv[1][0], sigma2_inv[1][1]);
    output.sigma = uniforms.size / clip_pos.z;
    
    return output;
}


