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
    @location(0) color: vec4<f32>,
    @location(1) sigma1: vec2<f32>,
    @location(2) sigma2: vec2<f32>,
    @location(3) uv: vec2<f32>,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

fn quaternionToMatrix(q: vec4<f32>) -> mat4x4<f32> {
    let x = q.x;
    let y = q.y;
    let z = q.z;
    let w = q.w;

    let xx = x * x;
    let yy = y * y;
    let zz = z * z;
    let xy = x * y;
    let xz = x * z;
    let yz = y * z;
    let wx = w * x;
    let wy = w * y;
    let wz = w * z;

    return mat4x4<f32>(
        vec4<f32>(1.0 - 2.0 * (yy + zz), 2.0 * (xy - wz), 2.0 * (xz + wy), 0.0),
        vec4<f32>(2.0 * (xy + wz), 1.0 - 2.0 * (xx + zz), 2.0 * (yz - wx), 0.0),
        vec4<f32>(2.0 * (xz - wy), 2.0 * (yz + wx), 1.0 - 2.0 * (xx + yy), 0.0),
        vec4<f32>(0.0, 0.0, 0.0, 1.0)
    );
}

fn transpose(m: mat4x4<f32>) -> mat4x4<f32> {
    return mat4x4<f32>(
        vec4<f32>(m[0][0], m[1][0], m[2][0], m[3][0]),
        vec4<f32>(m[0][1], m[1][1], m[2][1], m[3][1]),
        vec4<f32>(m[0][2], m[1][2], m[2][2], m[3][2]),
        vec4<f32>(m[0][3], m[1][3], m[2][3], m[3][3])
    );
}

fn transpose2(m: mat2x4<f32>) -> mat4x2<f32> {
    return mat4x2<f32>(
        vec2<f32>(m[0][0], m[1][0]),
        vec2<f32>(m[0][1], m[1][1]),
        vec2<f32>(m[0][2], m[1][2]),
        vec2<f32>(m[0][3], m[1][3])
    );
}

@vertex
fn main(splat: Splat, @builtin(vertex_index) index: u32) -> VertexOutput {
    let quadVertices = array<vec2<f32>, 6>(
        vec2<f32>(-1.0, -1.0),
        vec2<f32>( 1.0, -1.0),
        vec2<f32>(-1.0,  1.0),
        vec2<f32>(-1.0,  1.0),
        vec2<f32>( 1.0, -1.0),
        vec2<f32>( 1.0,  1.0),
    );

    let quadVertex = quadVertices[index];
    let worldPos = vec4<f32>(splat.position.x, -splat.position.y, splat.position.z, 1.0);
    let clipPos = uniforms.projection * uniforms.view * worldPos;
    let vertexPos = vec4<f32>(quadVertex * 2 * uniforms.size / uniforms.resolution, 0, 0);

    let rotationQuat = vec4<f32>(
        f32(((splat.rotation >> 0) & 0xFF) - 128) / 128.0,
        f32(((splat.rotation >> 8) & 0xFF) - 128) / 128.0,
        f32(((splat.rotation >> 16) & 0xFF) - 128) / 128.0,
        f32(((splat.rotation >> 24) & 0xFF) - 128) / 128.0,
    );
    
    let rotation = quaternionToMatrix(rotationQuat);
    let scale = mat4x4<f32>(
        splat.scale.x, 0.0, 0.0, 0.0,
        0.0, splat.scale.y, 0.0, 0.0,
        0.0, 0.0, splat.scale.z, 0.0,
        0.0, 0.0, 0.0, 1.0,
    );

    let sigma = rotation * scale * transpose(scale) * transpose(rotation);

    let jacobian = mat2x4<f32>(
        vec4<f32>(1.0 / clipPos.w, 0.0, -clipPos.x / clipPos.w, 0.0),
        vec4<f32>(0.0, 1.0 / clipPos.w, -clipPos.y / clipPos.w, 0.0)
    );

    let umesna = uniforms.view * sigma * transpose(uniforms.view);
    let sigma2 = transpose2(jacobian) * umesna * jacobian;

    var output: VertexOutput;
    output.position = clipPos + vertexPos;
    output.sigma1 = sigma2[0].xy;
    output.sigma2 = sigma2[1].xy;
    output.uv = quadVertex;
    
    let normalizedColor = vec4<f32>(
        f32((splat.color >> 0) & 0xFF) / 255.0,
        f32((splat.color >> 8) & 0xFF) / 255.0,
        f32((splat.color >> 16) & 0xFF) / 255.0,
        f32((splat.color >> 24) & 0xFF) / 255.0
    );
    output.color = normalizedColor;

    return output;
}


