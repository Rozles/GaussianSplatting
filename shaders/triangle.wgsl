@vertex
fn main(@builtin(vertex_index) vertexIndex: u32) -> @builtin(position) vec4<f32> {
    var positions = array<vec2<f32>, 3>(
        vec2( 0.0,  0.5),  // Top
        vec2(-0.5, -0.5),  // Bottom Left
        vec2( 0.5, -0.5)   // Bottom Right
    );

    return vec4<f32>(positions[vertexIndex], 0.0, 1.0);
}