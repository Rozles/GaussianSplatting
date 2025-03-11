export async function createAxisGizmoPipeline(device: GPUDevice, presentationFormat: any) {
  // Simple shader for axis lines
  const gizmoVertexCode = `
  struct Uniforms {
    view: mat4x4<f32>,
    projection: mat4x4<f32>,
    resolution: vec2<f32>,
    size: f32,
  }
  
  @group(0) @binding(0) var<uniform> uniforms: Uniforms;
  
  struct VertexInput {
    @location(0) position: vec3<f32>,
    @location(1) color: vec3<f32>,
  }
  
  struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) color: vec3<f32>,
  }
  
  @vertex
  fn main(input: VertexInput) -> VertexOutput {
    var output: VertexOutput;
    
    // Extract just the rotation component of the view matrix
    let viewRot = mat3x3<f32>(
      uniforms.view[0].xyz,
      uniforms.view[1].xyz,
      uniforms.view[2].xyz
    );
    
    // Scale axes but keep them fixed size in screen space
    let scaledPos = input.position * 0.15;
    
    // Apply view rotation to the axis direction (only the orientation changes)
    let rotatedPos = viewRot * scaledPos;
    
    // Fix the center point of the gizmo in the bottom-right corner
    // These are clip space coordinates (-1 to 1)
    let fixedPos = vec2<f32>(0.85, -0.85);
    
    // Place the gizmo at the fixed position
    // The Z coordinate is set to 0 for consistent rendering
    output.position = vec4<f32>(
      rotatedPos.x + fixedPos.x, 
      rotatedPos.y + fixedPos.y, 
      0.0, 
      1.0
    );
    
    output.color = input.color;
    return output;
  }
`;

  const gizmoFragmentCode = `
    @fragment
    fn main(@location(0) color: vec3<f32>) -> @location(0) vec4<f32> {
      return vec4<f32>(color, 1.0);
    }
  `;

  const gizmoVertexModule = device.createShaderModule({ code: gizmoVertexCode });
  const gizmoFragmentModule = device.createShaderModule({ code: gizmoFragmentCode });

  // Create layout that matches your main pipeline
  const bindGroupLayout = device.createBindGroupLayout({
    entries: [{
      binding: 0,
      visibility: GPUShaderStage.VERTEX,
      buffer: { type: 'uniform' }
    }]
  });

  const pipelineLayout = device.createPipelineLayout({
    bindGroupLayouts: [bindGroupLayout]
  });

  // Create gizmo pipeline with explicit layout
  const gizmoPipeline = device.createRenderPipeline({
    layout: pipelineLayout,
    vertex: {
      module: gizmoVertexModule,
      entryPoint: 'main',
      buffers: [{
        arrayStride: 24,
        attributes: [
          { shaderLocation: 0, offset: 0, format: 'float32x3' }, // position
          { shaderLocation: 1, offset: 12, format: 'float32x3' }, // color
        ],
      }],
    },
    fragment: {
      module: gizmoFragmentModule,
      entryPoint: 'main',
      targets: [{
        format: presentationFormat,
      }],
    },
    primitive: {
      topology: 'line-list',
    },
    depthStencil: {
      format: "depth24plus",
      depthWriteEnabled: false,
      depthCompare: "always", // Always show on top
    },
  });

  // Create vertex buffer for axes
  const axisVertices = new Float32Array([
    // X axis (red)
    0, 0, 0, 1, 0, 0,
    1, 0, 0, 1, 0, 0,
    
    // Y axis (green)
    0, 0, 0, 0, 1, 0,
    0, 1, 0, 0, 1, 0,
    
    // Z axis (blue)
    0, 0, 0, 0, 0, 1,
    0, 0, 1, 0, 0, 1,
  ]);
  
  const axisBuffer = device.createBuffer({
    size: axisVertices.byteLength,
    usage: GPUBufferUsage.VERTEX,
    mappedAtCreation: true,
  });
  
  new Float32Array(axisBuffer.getMappedRange()).set(axisVertices);
  axisBuffer.unmap();

  return { gizmoPipeline, axisBuffer, bindGroupLayout };
}