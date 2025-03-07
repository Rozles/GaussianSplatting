struct Splat {
    @location(0) position: vec3<f32>,
    @location(1) scale: vec3<f32>,
    @location(2) color: u32,
    @location(3) rotation: u32,
}

struct Uniforms {
    viewProjMatrix: mat4x4<f32>,
    resolution: vec2<f32>,
    size: f32,
}

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) color: vec4<f32>,
}

@group(0) @binding(0) var<uniform> uniforms: Uniforms;

@vertex
// fn main(splat: Splat, @builtin(vertex_index) index: u32) -> VertexOutput {
//     let quadVertices = array<vec2<f32>, 6>(
//         vec2<f32>(-1.0, -1.0),
//         vec2<f32>( 1.0, -1.0),
//         vec2<f32>(-1.0,  1.0),
//         vec2<f32>(-1.0,  1.0),
//         vec2<f32>( 1.0, -1.0),
//         vec2<f32>( 1.0,  1.0),
//     );
//     var output: VertexOutput;

//     let pos = quadVertices[index] * uniforms.size;
//     let splatPos = vec4<f32>(splat.position.x + pos.x, -splat.position.y + pos.y, splat.position.z, 1.0);
//     let clipPos = uniforms.viewProjMatrix * splatPos;
//     output.position = clipPos;

//     let normalizedColor = vec4<f32>(
//         f32((splat.color >> 24) & 0xFF) / 255.0,
//         f32((splat.color >> 16) & 0xFF) / 255.0,
//         f32((splat.color >> 8) & 0xFF) / 255.0,
//         f32(splat.color & 0xFF) / 255.0
//     );
//     output.color = normalizedColor;

//     return output;
// }

fn main(splat: Splat, @builtin(vertex_index) index: u32) -> VertexOutput {
    var output: VertexOutput;

    let pos = vec4<f32>(splat.position.x, -splat.position.y, splat.position.z, 1.0);
    let clipPos = uniforms.viewProjMatrix * pos;
    output.position = clipPos;

    let normalizedColor = vec4<f32>(
        f32((splat.color >> 24) & 0xFF) / 255.0,
        f32((splat.color >> 16) & 0xFF) / 255.0,
        f32((splat.color >> 8) & 0xFF) / 255.0,
        f32(splat.color & 0xFF) / 255.0
    );
    output.color = normalizedColor;

    return output;
}
