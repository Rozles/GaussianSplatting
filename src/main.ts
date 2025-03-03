// import { initWebGPU } from "./webgpu";
// import { TriangleRenderer } from "./triangle";

// async function run() {
//     const gpu = await initWebGPU();
//     const renderer = new TriangleRenderer(gpu);

//     const commandEncoder = gpu.device.createCommandEncoder();
//     const passEncoder = commandEncoder.beginRenderPass({
//         colorAttachments: [{
//             view: gpu.context.getCurrentTexture().createView(),
//             loadOp: "clear",
//             storeOp: "store",
//             clearValue: [0.1, 0.1, 0.1, 1.0]
//         }]
//     });

//     renderer.render(passEncoder);
//     passEncoder.end();
//     gpu.device.queue.submit([commandEncoder.finish()]);
// }

// run();

export function quitIfAdapterNotAvailable(
    adapter: GPUAdapter | null
  ): asserts adapter {
    if (!('gpu' in navigator)) {
      fail('navigator.gpu is not defined - WebGPU not available in this browser');
    }
  
    if (!adapter) {
      fail("requestAdapter returned null - this sample can't run on this system");
    }
  }  

export function quitIfWebGPUNotAvailable(
    adapter: GPUAdapter | null,
    device: GPUDevice | null
  ): asserts device {
    if (!device) {
      quitIfAdapterNotAvailable(adapter);
      fail('Unable to get a device for an unknown reason');
      return;
    }
  
    device.lost.then((reason) => {
      fail(`Device lost ("${reason.reason}"):\n${reason.message}`);
    });
    device.onuncapturederror = (ev) => {
      fail(`Uncaptured error:\n${ev.error.message}`);
    };
  }

const triangleVertWGSL = '@vertex\
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
const redFragWGSL = '@fragment\
                fn main() -> @location(0) vec4f {\
                return vec4(1.0, 0.0, 0.0, 1.0);\
                }'

const canvas = document.querySelector('canvas') as HTMLCanvasElement;
const adapter = await navigator.gpu?.requestAdapter();
const device = await adapter?.requestDevice();
quitIfWebGPUNotAvailable(adapter, device);

const context = canvas.getContext('webgpu') as GPUCanvasContext;

const devicePixelRatio = window.devicePixelRatio;
canvas.width = 512;//canvas.clientWidth * devicePixelRatio;
canvas.height = 512;//canvas.clientHeight * devicePixelRatio;
const presentationFormat = navigator.gpu.getPreferredCanvasFormat();

context.configure({
  device,
  format: presentationFormat,
});

const pipeline = device.createRenderPipeline({
  layout: 'auto',
  vertex: {
    module: device.createShaderModule({
      code: triangleVertWGSL,
    }),
  },
  fragment: {
    module: device.createShaderModule({
      code: redFragWGSL,
    }),
    targets: [
      {
        format: presentationFormat,
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
