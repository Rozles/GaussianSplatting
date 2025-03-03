struct VertexInput {
    @location(0) position: vec3<f32>;
    @location(1) size: f32;
};

@vertex
fn main(input: VertexInput) -> @builtin(position) vec4<f32> {
    return vec4<f32>(input.position, 1.0);
}