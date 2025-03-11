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

fn quaternion_to_rotation_matrix(q: vec4<f32>) -> mat3x3<f32> {
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

fn compute_jacobian(position_camera: vec3<f32>) -> mat2x3<f32> {
    // Jacobian of perspective projection at the camera-space position
    // For a typical perspective projection: x' = x/z, y' = y/z
    
    let z_inv = 1.0 / position_camera.z;
    let z_inv_sq = z_inv * z_inv;
    
    // First row: partial derivatives of x' = x/z with respect to x,y,z
    let j1 = vec3<f32>(z_inv, 0.0, -position_camera.x * z_inv_sq);
    
    // Second row: partial derivatives of y' = y/z with respect to x,y,z
    let j2 = vec3<f32>(0.0, z_inv, -position_camera.y * z_inv_sq);
    
    return mat2x3<f32>(j1, j2);
}

@vertex
fn main(splat: Splat, @builtin(vertex_index) index: u32) -> VertexOutput {
    let world_pos = vec4<f32>(splat.position.x, -splat.position.y, splat.position.z, 1.0);
    let camera_pos = uniforms.view * world_pos;

    let rot_quat = vec4<f32>(
        f32(((splat.rotation >> 0) & 0xFF) - 128) / 128.0,
        f32(((splat.rotation >> 8) & 0xFF) - 128) / 128.0,
        f32(((splat.rotation >> 16) & 0xFF) - 128) / 128.0,
        f32(((splat.rotation >> 24) & 0xFF) - 128) / 128.0,
    );

    // Build the covariance matrix in world space
    let cov_3d_world = build_covariance_3d(splat.scale, rot_quat);

    // Transform the covariance matrix to camera space
    let view_rotation = mat3x3<f32>(
        uniforms.view[0].xyz,
        uniforms.view[1].xyz,
        uniforms.view[2].xyz
    );
    
    let cov_3d_camera = view_rotation * cov_3d_world * transpose(view_rotation);

    let jacobian = compute_jacobian(camera_pos.xyz);

    let temp = mat2x3_times_mat3x3(jacobian, cov_3d_camera);
    let cov_2d = mat2x3_times_transpose_mat2x3(temp, jacobian);
    
    let det = cov_2d[0][0] * cov_2d[1][1] - cov_2d[0][1] * cov_2d[1][0];
    let inv_det = 1.0 / max(det, 1e-6);
    
    let cov_2d_inv = mat2x2<f32>(
        vec2<f32>(cov_2d[1][1] * inv_det, -cov_2d[0][1] * inv_det),
        vec2<f32>(-cov_2d[1][0] * inv_det, cov_2d[0][0] * inv_det)
    );
    
    let clip_pos = uniforms.projection * camera_pos;
    let ndc_pos = vec2<f32>(clip_pos.x / clip_pos.w, clip_pos.y / clip_pos.w);

    let mean_val = (cov_2d[0][0] + cov_2d[1][1]) * 0.5;
    let diff = (cov_2d[0][0] - cov_2d[1][1]) * 0.5;
    let discriminant = sqrt(diff * diff + cov_2d[0][1] * cov_2d[0][1]);
    let eigenvalue1 = mean_val + discriminant;
    let eigenvalue2 = mean_val - discriminant;
    
    // Calculate eigenvectors
    var eigenvector1: vec2<f32>;
    var eigenvector2: vec2<f32>;
    
    if (abs(cov_2d[0][1]) < 1e-6) {
        // Matrix is already diagonal
        if (cov_2d[0][0] >= cov_2d[1][1]) {
            eigenvector1 = vec2<f32>(1.0, 0.0);
            eigenvector2 = vec2<f32>(0.0, 1.0);
        } else {
            eigenvector1 = vec2<f32>(0.0, 1.0);
            eigenvector2 = vec2<f32>(1.0, 0.0);
        }
    } else {
        // Calculate first eigenvector
        let v1_x = eigenvalue1 - cov_2d[1][1];
        let v1_y = cov_2d[0][1];
        eigenvector1 = normalize(vec2<f32>(v1_x, v1_y));
        
        // Second eigenvector is perpendicular to the first
        eigenvector2 = vec2<f32>(-eigenvector1.y, eigenvector1.x);
    }
    
    let radius_x = sqrt(max(eigenvalue1, 0.0)) * uniforms.size;
    let radius_y = sqrt(max(eigenvalue2, 0.0)) * uniforms.size;
    
    // Quad corner based on vertex_idx (0,1,2,0,2,3)
    let quad_corners = array<vec2<f32>, 6>(
        vec2<f32>(-1.0, -1.0),
        vec2<f32>(-1.0, 1.0),
        vec2<f32>(1.0, 1.0),
        vec2<f32>(-1.0, -1.0),
        vec2<f32>(1.0, 1.0),
        vec2<f32>(1.0, -1.0)
    );

    let corner = quad_corners[index];

    let scaled_corner = vec2<f32>(
        corner.x * radius_x,
        corner.y * radius_y
    );

    let rotated_corner = vec2<f32>(
        eigenvector1.x * scaled_corner.x + eigenvector2.x * scaled_corner.y,
        eigenvector1.y * scaled_corner.x + eigenvector2.y * scaled_corner.y
    );
    
    // Screen position with size
    let screen_pos = clip_pos + vec4<f32>(rotated_corner, 0.0, 1.0);

    let normalizedColor = vec4<f32>(
        f32((splat.color >> 0) & 0xFF) / 255.0,
        f32((splat.color >> 8) & 0xFF) / 255.0,
        f32((splat.color >> 16) & 0xFF) / 255.0,
        f32((splat.color >> 24) & 0xFF) / 255.0
    );
    
    var output: VertexOutput;
    output.position = screen_pos;
    output.uv = corner * 0.5 + 0.5; // Map [-1,1] to [0,1]
    output.color = normalizedColor;
    output.cov_inv = vec4<f32>(cov_2d_inv[0][0], cov_2d_inv[0][1], cov_2d_inv[1][0], cov_2d_inv[1][1]);
    
    return output;
}


