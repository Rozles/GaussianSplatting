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

fn mat2x3_times_mat3x3(a: mat2x3<f32>, b: mat3x3<f32>) -> mat2x3<f32> {
    let c0 = vec3<f32>(
        a[0][0] * b[0][0] + a[0][1] * b[1][0] + a[0][2] * b[2][0],
        a[0][0] * b[0][1] + a[0][1] * b[1][1] + a[0][2] * b[2][1],
        a[0][0] * b[0][2] + a[0][1] * b[1][2] + a[0][2] * b[2][2]
    );
    
    let c1 = vec3<f32>(
        a[1][0] * b[0][0] + a[1][1] * b[1][0] + a[1][2] * b[2][0],
        a[1][0] * b[0][1] + a[1][1] * b[1][1] + a[1][2] * b[2][1],
        a[1][0] * b[0][2] + a[1][1] * b[1][2] + a[1][2] * b[2][2]
    );
    
    return mat2x3<f32>(c0, c1);
}

fn mat2x3_times_transpose_mat2x3(a: mat2x3<f32>, b: mat2x3<f32>) -> mat2x2<f32> {
    return mat2x2<f32>(
        vec2<f32>(
            dot(a[0], b[0]),
            dot(a[0], b[1])
        ),
        vec2<f32>(
            dot(a[1], b[0]),
            dot(a[1], b[1])
        )
    );
}

fn build_covariance_3d(scale: vec3<f32>, q: vec4<f32>) -> mat3x3<f32> {
    let rot = quaternion_to_rotation_matrix(q);
    
    let S_squared = mat3x3<f32>(
        vec3<f32>(scale.x * scale.x, 0.0, 0.0),
        vec3<f32>(0.0, scale.y * scale.y, 0.0),
        vec3<f32>(0.0, 0.0, scale.z * scale.z)
    );
    
    return rot * S_squared * transpose(rot);
}

fn compute_jacobian(position_camera: vec3<f32>) -> mat3x3<f32> {
    let z_inv = 1.0 / position_camera.z;
    let z_inv_sq = z_inv * z_inv;

    let a = uniforms.projection[0][0];
    let b = uniforms.projection[1][1];
    let c = uniforms.projection[2][2];
    let d = uniforms.projection[3][2];
    
    let j1 = vec3<f32>(a * z_inv, 0.0, -position_camera.x * d * z_inv_sq);
    let j2 = vec3<f32>(0.0, b * z_inv, -position_camera.y * d * z_inv_sq);
    let j3 = vec3<f32>(0.0, 0.0, -c * z_inv_sq);
    
    return mat3x3<f32>(j1, j2, j3);
}

@vertex
fn main(splat: Splat, @builtin(vertex_index) index: u32) -> VertexOutput {
    let world_pos = vec4<f32>(splat.position.x, -splat.position.y, splat.position.z, 1.0);
    let camera_pos = uniforms.view * world_pos;

    let rot_quat = vec4<f32>(
        f32(((splat.rotation >> 24) & 0xFF) - 128) / 128.0,
        f32(((splat.rotation >> 0) & 0xFF) - 128) / 128.0,
        f32(((splat.rotation >> 8) & 0xFF) - 128) / 128.0,
        f32(((splat.rotation >> 16) & 0xFF) - 128) / 128.0,
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
    )

    let rotation = rotation_from_quat(rot_quat);

    let jacobian = compute_jacobian(camera_pos.xyz);

    let t = jacobian * view3 * scale3 * rotation;
    let sigma3 = t * transpose(t);

    let sigma2 = mat2x2<f32>(
        vec2<f32>(sigma3[0][0], sigma3[0][1]),
        vec2<f32>(sigma3[1][0], sigma3[1][1])
    );


    let det = sigma2[0][0] * sigma2[1][1] - sigma2[0][1] * sigma2[1][0];
    let inv_det = 1.0 / max(det, 1e-6);
    
    let sigma2_inv = mat2x2<f32>(
        vec2<f32>(sigma2[1][1] * inv_det, -sigma2[0][1] * inv_det),
        vec2<f32>(-sigma2[1][0] * inv_det, sigma2[0][0] * inv_det)
    );
    
    let clip_pos = uniforms.projection * camera_pos;
    let ndc_pos = vec2<f32>(clip_pos.x / clip_pos.w, clip_pos.y / clip_pos.w);

    let a = 1.0;
    let b = -(sigma2[0][0] + sigma2[1][1]);
    let c = sigma2[0][0] * sigma2[1][1] - sigma2[0][1] * sigma2[1][0];
    let discriminant = b * b - 4.0 * a * c;
    let eigenvalue1 = (-b + sqrt(max(discriminant, 0.0))) / (2.0 * a);
    let eigenvalue2 = (-b - sqrt(max(discriminant, 0.0))) / (2.0 * a);
    
    let quad_corners = array<vec2<f32>, 6>(
        vec2<f32>(-1.0, -1.0),
        vec2<f32>(-1.0, 1.0),
        vec2<f32>(1.0, 1.0),
        vec2<f32>(-1.0, -1.0),
        vec2<f32>(1.0, 1.0),
        vec2<f32>(1.0, -1.0)
    );

    let corner = quad_corners[index];

    let rotated_corner = vec2<f32>(
        eigenvector1.x * scaled_corner.x + eigenvector2.x * scaled_corner.x,
        eigenvector1.y * scaled_corner.y + eigenvector2.y * scaled_corner.y
    );
    
    let screen_pos = clip_pos + vec4<f32>(rotated_corner, 0.0, 1.0);

    let normalizedColor = vec4<f32>(
        f32((splat.color >> 0) & 0xFF) / 255.0,
        f32((splat.color >> 8) & 0xFF) / 255.0,
        f32((splat.color >> 16) & 0xFF) / 255.0,
        f32((splat.color >> 24) & 0xFF) / 255.0
    );
    
    var output: VertexOutput;
    output.position = screen_pos;
    output.uv = corner; // Map [-1,1] to [0,1]
    output.color = normalizedColor;
    output.cov_inv = vec4<f32>(sigma2_inv[0][0], sigma2_inv[0][1], sigma2_inv[1][0], sigma2_inv[1][1]);
    
    return output;
}


