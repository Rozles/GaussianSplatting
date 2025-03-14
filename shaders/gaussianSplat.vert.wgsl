struct Splat {
    @location(0) position: vec3<f32>,
    @location(1) scale: vec3<f32>,
    @location(2) color: u32,
    @location(3) rotation: u32,
}

struct Uniforms {
    view: mat4x4<f32>,
    inv_view: mat4x4<f32>,
    projection: mat4x4<f32>,
    resolution: vec2<f32>,
    size: f32,
}

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) uv: vec2<f32>,
    @location(1) color: vec4<f32>,
    @location(2) cov_inv: vec4<f32>,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

fn rotation_from_quat(q: vec4<f32>) -> mat3x3<f32> {
    let q_normalized = normalize(q);
    let x = q_normalized.x;
    let y = q_normalized.y;
    let z = q_normalized.z;
    let w = q_normalized.w;
    
    return mat3x3<f32>(
        vec3<f32>(1.0 - 2.0 * (y * y + z * z), 2.0 * (x * y - z * w), 2.0 * (x * z + y * w)),
        vec3<f32>(2.0 * (x * y + z * w), 1.0 - 2.0 * (x * x + z * z), 2.0 * (y * z - x * w)),
        vec3<f32>(2.0 * (x * z - y * w), 2.0 * (y * z + x * w), 1.0 - 2.0 * (x * x + y * y))
    );
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
    let a = uniforms.projection[3][2];

    let jacobian = mat3x3<f32>(
        vec3<f32>(a *f_x / z, 0.0, -x * a*f_x / (z * z)),
        vec3<f32>(0.0, a*f_y / z, -y * a*f_y / (z * z)),
        vec3<f32>(0.0, 0.0, 0.0)
    );
    
    return jacobian;
}

@vertex
fn main(splat: Splat, @builtin(vertex_index) index: u32) -> VertexOutput {
    let world_pos = vec4<f32>(splat.position.x, -splat.position.y, splat.position.z, 1.0);
    let camera_pos = uniforms.view * world_pos;
    let clip_pos = uniforms.projection * camera_pos;
    let ndc_pos = clip_pos / clip_pos.w;

    let rot_quat = vec4<f32>(
        f32(((splat.rotation >> 8) & 0xFF) - 128) / 128.0,
        f32(((splat.rotation >> 16) & 0xFF) - 128) / 128.0,
        f32(((splat.rotation >> 24) & 0xFF) - 128) / 128.0,
        f32(((splat.rotation >> 0) & 0xFF) - 128) / 128.0,
    );

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

    let rotation = rotation_from_quat(rot_quat);
    let rotation2 = transpose(rotation);

    let jacobian = compute_jacobian(camera_pos.xyz);

    let m = jacobian * view3 * scale3 * rotation2;
    let sigma_dash = m * transpose(m);

    let sigma2 = mat2x2<f32>(
        vec2<f32>(sigma_dash[0][0], sigma_dash[0][1]),
        vec2<f32>(sigma_dash[1][0], sigma_dash[1][1])
    );

    let det = sigma2[0][0] * sigma2[1][1] - sigma2[0][1] * sigma2[1][0];
    let inv_det = 1.0 / max(det, 1e-6);
    
    let sigma2_inv = mat2x2<f32>(
        vec2<f32>(sigma2[1][1] * inv_det, -sigma2[0][1] * inv_det),
        vec2<f32>(-sigma2[1][0] * inv_det, sigma2[0][0] * inv_det)
    );

    let a = sigma2[0][0];
    let b = sigma2[0][1];
    let c = sigma2[1][1];

    let eigenvalue1 = (a + c + sqrt(a * a + 2 * a * c + c * c - 4 * (a * c - b * b))) / 2;
    let eigenvalue2 = (a + c - sqrt(a * a + 2 * a * c + c * c - 4 * (a * c - b * b))) / 2;

    let eigen_vector1 = normalize(vec2(1, (-a+b+eigenvalue1) / (b-c+eigenvalue1)));
    let eigen_vector2 = normalize(vec2(- eigen_vector1.y, eigen_vector1.x));

    let majorAxis = min(3 * sqrt(max(eigenvalue1, 0.0)), 10) * eigen_vector1;
    let minorAxis = min(3 * sqrt(max(eigenvalue2, 0.0)), 10) * eigen_vector2;
    
    let quad_corners = array<vec2<f32>, 6>(
        vec2<f32>(1.0, 1.0),
        vec2<f32>(-1.0, 1.0),
        vec2<f32>(1.0, -1.0),
        vec2<f32>(1.0, -1.0),
        vec2<f32>(-1.0, 1.0),
        vec2<f32>(-1.0, -1.0)
    );

    let corner = quad_corners[index];
    let add_this = corner.x * majorAxis + corner.y * minorAxis;
    let output_vertex = ndc_pos + vec4<f32>(add_this * uniforms.size, 0.0, 0.0);

    let normalizedColor = vec4<f32>(
        f32((splat.color >> 0) & 0xFF) / 255.0,
        f32((splat.color >> 8) & 0xFF) / 255.0,
        f32((splat.color >> 16) & 0xFF) / 255.0,
        f32((splat.color >> 24) & 0xFF) / 255.0
    );
    

    let uv = corner.x * majorAxis + corner.y * minorAxis;
    var output: VertexOutput;
    output.position = output_vertex;
    output.uv = add_this;
    output.color = normalizedColor;
    output.cov_inv = vec4<f32>(sigma2_inv[0][0], sigma2_inv[0][1], sigma2_inv[1][0], sigma2_inv[1][1]);
    
    return output;
}


