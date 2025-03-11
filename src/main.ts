import { loadBinaryFile } from "./utils";
import { Camera, updateCamera } from "./camera";
import { vec3, mat4 } from "gl-matrix"; 

const canvas = document.getElementById("webgpu-canvas") as HTMLCanvasElement;

let aspect = canvas.width / canvas.height;
const camera = new Camera(aspect);
camera.update();


// Overlay
const fpsOverlay = document.getElementById("fps");
let fpsTimer = performance.now();
let frameCount = 0;

let pointSize = 1.0;
const sizeRangeInput = document.getElementById("size") as HTMLInputElement;
const sizeNumberInput = document.getElementById("size-number") as HTMLInputElement;
sizeRangeInput.addEventListener("input", () => {
  sizeNumberInput.value = sizeRangeInput.value;
  pointSize = parseFloat(sizeRangeInput.value);
});
sizeNumberInput.addEventListener("input", () => {
  sizeRangeInput.value = sizeNumberInput.value;
  pointSize = parseFloat(sizeNumberInput.value);
}); 


// WebGPU initialization
const webGPU = await initWebGPU();
if (!webGPU) {
  console.error("Failed to initialize WebGPU");
}
const { device, context, presentationFormat } = webGPU;

let depthTexture = null;

window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Point cloud data
const pointCloudDataBuffer = await loadBinaryFile("data/nike.splat");
const numberOfPoints = pointCloudDataBuffer.byteLength / 32;

// TEST

// create position vector from first three floats in buffer
const position = vec3.fromValues(
  new Float32Array(pointCloudDataBuffer, 0, 3)[0],
  new Float32Array(pointCloudDataBuffer, 0, 3)[1],
  new Float32Array(pointCloudDataBuffer, 0, 3)[2]
);

// scale from next three
const scale = vec3.fromValues(
  new Float32Array(pointCloudDataBuffer, 12, 3)[0],
  new Float32Array(pointCloudDataBuffer, 12, 3)[1],
  new Float32Array(pointCloudDataBuffer, 12, 3)[2]
);

// color from next unsigned int
const colorBuffer: number = new Uint32Array(pointCloudDataBuffer, 24, 1)[0];
let color = new Float32Array([
  ((colorBuffer >> 0) & 0xff) / 255.0,
  ((colorBuffer >> 8) & 0xff) / 255.0,
  ((colorBuffer >> 16) & 0xff) / 255.0,
  ((colorBuffer >> 24) & 0xff) / 255.0,
]);

// rotation 

const rotBuffer: number = new Uint32Array(pointCloudDataBuffer, 24, 1)[0];
let rotQuat = new Float32Array([
  (((rotBuffer >> 0) & 0xff) - 128.0) / 128.0,
  (((rotBuffer >> 8) & 0xff) - 128.0) / 128.0,
  (((rotBuffer >> 16) & 0xff) - 128.0) / 128.0,
  (((rotBuffer >> 24) & 0xff) - 128.0) / 128.0,
]);

let rotMat = mat4.create();
mat4.fromQuat(rotMat, rotQuat);

let scaleMat = mat4.create();
mat4.fromScaling(scaleMat, scale);

// sigma = scaleMat * rotMat * rotMat.T * scaleMat.T
let sigma = mat4.create();
let rotMatT = mat4.create();
mat4.transpose(rotMatT, rotMat);
mat4.multiply(sigma, scaleMat, rotMat);
mat4.multiply(sigma, sigma, rotMatT);
mat4.multiply(sigma, sigma, scaleMat);


console.log("position: ", position);
console.log("scale: ", scale);
console.log("color: ", color);
console.log("rotQuat: ", rotQuat);
console.log("rotMat: ", rotMat);
console.log("scaleMat: ", scaleMat);
console.log("sigma: ", sigma);


function updateFPS() {
  const currentTime = performance.now();
  frameCount++;
  if (currentTime - fpsTimer >= 1000) {
    if (fpsOverlay)
      fpsOverlay.textContent = 'FPS: ' + frameCount.toString();
    frameCount = 0;
    fpsTimer = currentTime;
  }
}

function resizeCanvas() {
  const devicePixelRatio = window.devicePixelRatio || 1;
  canvas.width = canvas.clientWidth * devicePixelRatio;
  canvas.height = canvas.clientHeight * devicePixelRatio;
  aspect = canvas.width / canvas.height;

  camera.setAspect(aspect);

  if (depthTexture) {
    depthTexture.destroy();
  }
  depthTexture = device.createTexture({
    size: [canvas.width, canvas.height, 1],
    format: "depth24plus",
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
  });
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
  const pointCloudVertWGSL = await fetch("shaders/gaussianSplat.vertex.wgsl").then(res => res.text());
  const pointCloudFragWGSL = await fetch("shaders/gaussianSplat.frag.wgsl").then(res => res.text());

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
            srcFactor: 'one',
            dstFactor: 'one-minus-src-alpha',
            operation: 'add',
          },
        },
      }],
    },
    depthStencil: {
      format: "depth24plus",
      depthWriteEnabled: true,
      depthCompare: "less",
    },
  });

  const vertexBuffer = device.createBuffer({
    size: pointCloudDataBuffer.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    mappedAtCreation: true,
  });
  new Uint8Array(vertexBuffer.getMappedRange()).set(new Uint8Array(pointCloudDataBuffer));
  vertexBuffer.unmap();

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

  depthTexture = device.createTexture({
    size: [canvas.width, canvas.height, 1],
    format: "depth24plus",
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
  });

  return { pipeline, vertexBuffer, uniformBuffer, bindGroup };
}

async function render() {
  const { pipeline, vertexBuffer, uniformBuffer, bindGroup } = await createPipeline(device, presentationFormat);

  function frame() {
    updateFPS();
    updateCamera(camera);

    const commandEncoder = device.createCommandEncoder();
    const canvasTexture = context.getCurrentTexture();
    const textureView = canvasTexture.createView();

    const paddedUniformBufferData = new Float32Array(36);
    paddedUniformBufferData.set(camera.getViewMatrix());
    paddedUniformBufferData.set(camera.getProjectionMatrix(), 16);
    paddedUniformBufferData.set([canvasTexture.width, canvasTexture.height], 32);
    paddedUniformBufferData.set([pointSize, 0],  34);

    device.queue.writeBuffer(uniformBuffer, 0, paddedUniformBufferData.buffer);

    const renderPass = commandEncoder.beginRenderPass({
        colorAttachments: [{
            view: textureView,
            loadOp: "clear",
            clearValue: [1, 1, 1, 1],
            storeOp: "store"
        }],
        depthStencilAttachment: {
          view: depthTexture.createView(),
          depthLoadOp: "clear",
          depthClearValue: 1.0,
          depthStoreOp: "store",
        }
    });

    renderPass.setPipeline(pipeline);
    renderPass.setVertexBuffer(0, vertexBuffer);
    renderPass.setBindGroup(0, bindGroup);
    renderPass.draw(6, numberOfPoints, 0, 0);

    renderPass.end();

    device.queue.submit([commandEncoder.finish()]);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

render().catch(console.error);