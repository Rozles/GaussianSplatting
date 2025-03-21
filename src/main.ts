import { loadBinaryFile } from "./utils";
import { CameraController } from "./camera";
import { vec3 } from "gl-matrix"; 
import { createAxisGizmoPipeline } from "./gizmo";
import { GUI } from "./gui";

const canvas = document.getElementById("webgpu-canvas") as HTMLCanvasElement;
let aspect = canvas.width / canvas.height;

const camera = new CameraController(aspect);

const gui = new GUI();

// WebGPU initialization
const webGPU = await initWebGPU();
if (!webGPU) {
  console.error("Failed to initialize WebGPU");
}
const { device, context, presentationFormat } = webGPU;

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

let sortPoints = false;
window.addEventListener('keydown', (event) => {
  if (event.key === 'x') {
    sortPoints = true;
  }
});

// Point cloud data
const gaussianCloud = await loadBinaryFile("data/nike.splat");
const numberOfPoints = gaussianCloud.byteLength / 32;

//let depthTexture = null;

function resizeCanvas() {
  const devicePixelRatio = window.devicePixelRatio || 1;
  canvas.width = canvas.clientWidth * devicePixelRatio;
  canvas.height = canvas.clientHeight * devicePixelRatio;
  aspect = canvas.width / canvas.height;

  camera.setAspect(aspect);

  // if (depthTexture) {
  //   depthTexture.destroy();
  // }
  // depthTexture = device.createTexture({
  //   size: [canvas.width, canvas.height, 1],
  //   format: "depth24plus",
  //   usage: GPUTextureUsage.RENDER_ATTACHMENT,
  // });
}

async function initWebGPU() {
  if (!navigator.gpu) {
      console.error("WebGPU is not supported!");
      return;
  }
  
  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) {
      console.error("Failed to find a GPU adapter");
      return;
  }

  const device = await adapter.requestDevice();
  const context = canvas.getContext("webgpu");
  if (!context) {
      console.error("Failed to create WebGPU context");
      return;
  }

  const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
  context.configure({
      device: device,
      format: presentationFormat
  });

  return { device, context, presentationFormat };
}

async function createPipeline(device: GPUDevice, presentationFormat: any) {

  // Gaussian splatting 3.5
  const pointCloudVertWGSL = await fetch("shaders/gaussianSplat.vert.wgsl").then(res => res.text());
  const pointCloudFragWGSL = await fetch("shaders/gaussianSplat.frag.wgsl").then(res => res.text());

  // Gaussian quads 3.4
  // const pointCloudVertWGSL = await fetch("shaders/quadGauss.vert.wgsl").then(res => res.text());
  // const pointCloudFragWGSL = await fetch("shaders/quadGauss.frag.wgsl").then(res => res.text());

  // Quad cloud
  // const pointCloudVertWGSL = await fetch("shaders/quadCloud.vertex.wgsl").then(res => res.text());
  // const pointCloudFragWGSL = await fetch("shaders/quadCloud.frag.wgsl").then(res => res.text());

  // Point cloud 
  // const pointCloudVertWGSL = await fetch("shaders/pointCloud.vertex.wgsl").then(res => res.text());
  // const pointCloudFragWGSL = await fetch("shaders/pointCloud.frag.wgsl").then(res => res.text());


  const pointCloudVertModule = device.createShaderModule({ code: pointCloudVertWGSL });
  const pointCloudFragModule = device.createShaderModule({ code: pointCloudFragWGSL });

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

  const pipeline = device.createRenderPipeline({
    layout: pipelineLayout,
    vertex: {
      module: pointCloudVertModule,
      entryPoint: 'main',
      buffers: [
        {
          arrayStride: 32,
          stepMode: 'instance',
          attributes: [
            {shaderLocation: 0, offset: 0, format: 'float32x3',},
            {shaderLocation: 1, offset: 12, format: 'float32x3',},
            {shaderLocation: 2, offset: 24, format: 'uint32',},
            {shaderLocation: 3, offset: 28, format: 'uint32',}],
        }
      ],
    },
    fragment: {
      module: pointCloudFragModule,
      entryPoint: 'main',
      targets: [{
        format: presentationFormat,
        blend: {
          color: {
            srcFactor: 'src-alpha',
            dstFactor: 'one-minus-src-alpha',
            operation: 'add',
          },
          alpha: {
            srcFactor: 'src-alpha',
            dstFactor: 'one',
            operation: 'add',
          },
        },
      }],
    },
    // depthStencil: {
    //   format: "depth24plus",
    //   depthWriteEnabled: false,
    //   depthCompare: "less",
    // },
    primitive:{
      topology: "triangle-list",
    },
  });

  const vertexBuffer = device.createBuffer({
    size: numberOfPoints * 32,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });

  const uniformBuffer = device.createBuffer({
    size: 144,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
  });

  const bindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [{
      binding: 0,
      resource: { buffer: uniformBuffer }
    }]
  });

  // depthTexture = device.createTexture({
  //   size: [canvas.width, canvas.height, 1],
  //   format: "depth24plus",
  //   usage: GPUTextureUsage.RENDER_ATTACHMENT,
  // });

  return { pipeline, vertexBuffer, uniformBuffer, bindGroup };
}

let previousPosition = vec3.create();

function sortSplats(vertexBuffer: GPUBuffer) {
  let currentPosition = camera.getPosition();
  let deltaPosition = vec3.create();
  vec3.sub(deltaPosition, currentPosition, previousPosition);

  if (vec3.length(deltaPosition) < 0.01 && !sortPoints) {
    return;
  }

  sortPoints = false;
  vec3.copy(previousPosition, currentPosition);

  const cameraPos = camera.getPosition();

  const gaussians = new Array(numberOfPoints);
  const bytesPerSplat = 32;
  const floatsPerSplat = bytesPerSplat / 4;
  
  const floatView = new Float32Array(gaussianCloud.buffer);
  
  for (let i = 0; i < numberOfPoints; i++) {
    const posIdx = i * floatsPerSplat;
    const x = -floatView[posIdx] - cameraPos[0];
    const y = -floatView[posIdx + 1] - cameraPos[1];
    const z = -floatView[posIdx + 2] - cameraPos[2];
    
    gaussians[i] = {
      index: i,
      distSq: x*x + y*y + z*z
    };
  }
  
  gaussians.sort((a, b) => b.distSq - a.distSq);
  
  const sortedData = new Uint8Array(gaussianCloud.byteLength);
  const srcData = new Uint8Array(gaussianCloud.buffer);
  
  for (let i = 0; i < numberOfPoints; i++) {
    const srcOffset = gaussians[i].index * bytesPerSplat;
    const dstOffset = i * bytesPerSplat;
    
    sortedData.set(
      srcData.subarray(srcOffset, srcOffset + bytesPerSplat), 
      dstOffset
    );
  }
  
  device.queue.writeBuffer(vertexBuffer, 0, sortedData);
}

async function render() {
  const { pipeline, vertexBuffer, uniformBuffer, bindGroup } = await createPipeline(device, presentationFormat);
  //const { gizmoPipeline, axisBuffer } = await createAxisGizmoPipeline(device, presentationFormat);

  device.queue.writeBuffer(vertexBuffer, 0, gaussianCloud);

  function frame() {
    gui.updateFPS();
    camera.updateCamera();

    sortSplats(vertexBuffer);

    const commandEncoder = device.createCommandEncoder();
    const canvasTexture = context.getCurrentTexture();
    const textureView = canvasTexture.createView();

    const paddedUniformBufferData = new Float32Array(36);
    paddedUniformBufferData.set(camera.getViewMatrix());
    paddedUniformBufferData.set(camera.getProjectionMatrix(), 16);
    paddedUniformBufferData.set([canvasTexture.width, canvasTexture.height], 32);
    paddedUniformBufferData.set([gui.getSize(), 0],  34);

    device.queue.writeBuffer(uniformBuffer, 0, paddedUniformBufferData.buffer);
    
    const renderPass = commandEncoder.beginRenderPass({
        colorAttachments: [{
            view: textureView,
            loadOp: "clear",
            clearValue: [1, 1, 1, 1],
            storeOp: "store"
        }],
        // depthStencilAttachment: {
        //   view: depthTexture.createView(),
        //   depthLoadOp: "clear",
        //   depthClearValue: 1.0,
        //   depthStoreOp: "store",
        // }
    });

    renderPass.setPipeline(pipeline);
    renderPass.setVertexBuffer(0, vertexBuffer);
    renderPass.setBindGroup(0, bindGroup);
    renderPass.draw(6, numberOfPoints, 0, 0);

    // // Render axis gizmo
    // renderPass.setPipeline(gizmoPipeline);
    // renderPass.setVertexBuffer(0, axisBuffer);
    // renderPass.setBindGroup(0, bindGroup); 
    // renderPass.draw(6, 1, 0, 0);

    renderPass.end();

    device.queue.submit([commandEncoder.finish()]);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

render().catch(console.error);