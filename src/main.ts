const triangleVertWGSLcode = '@vertex\
                    fn main(\
                    @builtin(vertex_index) VertexIndex : u32\
                    ) -> @builtin(position) vec4f {\
                    var pos = array<vec2f, 3>(\
                        vec2(0.0, 0.5),\
                        vec2(-0.5, -0.5),\
                        vec2(0.5, -0.5)\
                    );\
                    return vec4f(pos[VertexIndex], 0.0, 1.0);\
                    }'
const redFragWGSLcode = '@fragment\
                fn main() -> @location(0) vec4f {\
                return vec4(1.0, 0.0, 0.0, 1.0);\
                }'

if (!navigator.gpu) {
  throw new Error("WebGPU not supported on this browser.");
}

const adapter = await navigator.gpu.requestAdapter();
const device = await adapter?.requestDevice();
if (!device) {
  throw new Error("Failed to get GPU device.");
}

const canvas = document.getElementById("webgpu-canvas") as HTMLCanvasElement;
const context = canvas.getContext("webgpu") as GPUCanvasContext;

const devicePixelRatio = window.devicePixelRatio;
canvas.width = canvas.clientWidth * devicePixelRatio;
canvas.height = canvas.clientHeight * devicePixelRatio;

const format = navigator.gpu.getPreferredCanvasFormat();
context.configure({ device, format });

const triangleVertWGSL = device.createShaderModule({
  code: triangleVertWGSLcode,
});

const redFragWGSL = device.createShaderModule({
  code: redFragWGSLcode,
});

const pipeline = device.createRenderPipeline({
  layout: 'auto',
  vertex: {
    module: triangleVertWGSL
  },
  fragment: {
    module: redFragWGSL,
    targets: [
      {
        format: format,
      },
    ],
  },
  primitive: {
    topology: 'triangle-list',
  },
});

function frame() {
  const commandEncoder = device.createCommandEncoder();
  const textureView = context.getCurrentTexture().createView();

  const renderPassDescriptor: GPURenderPassDescriptor = {
    colorAttachments: [
      {
        view: textureView,
        clearValue: [0, 0, 0, 0], // Clear to transparent
        loadOp: 'clear',
        storeOp: 'store',
      },
    ],
  };

  const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
  passEncoder.setPipeline(pipeline);
  passEncoder.draw(3);
  passEncoder.end();

  device.queue.submit([commandEncoder.finish()]);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
