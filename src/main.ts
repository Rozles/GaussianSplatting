import { SplatCloud, loadBinaryFile } from "./splatcloud";
import { Camera } from "./camera";
import { mat4, vec3 } from "gl-matrix";

const canvas = document.getElementById("webgpu-canvas") as HTMLCanvasElement;

// const splatCloud = new SplatCloud();
// await splatCloud.readFromFile("data/train.splat");
// const positions = splatCloud.getPositions();
// const colors = splatCloud.getColors();

const pointCloudDataBuffer = await loadBinaryFile("data/nike.splat");

const camera = new Camera();
camera.update();

const overlay = document.getElementById("overlay");
const fpsOverlay = document.getElementById("fps");
let fpsTimer = performance.now();
let frameCount = 0;
let frameTimer = performance.now();

let mouseDown = false;
let lastMouseX = 0;
let lastMouseY = 0;
let mouseX = 0;
let mouseY = 0;
let pressedKeys = new Set<string>();

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

window.addEventListener('mousemove', handleMouseMove);
window.addEventListener('mousedown', handleMouseDown);
window.addEventListener('mouseup', handleMouseUp);
window.addEventListener('keydown', handleKeyDown);
window.addEventListener('keyup', handleKeyUp);
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

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

function handleMouseDown(event) {
  if (overlay && overlay.contains(event.target)) {
    return;
  }

  mouseDown = true;
  lastMouseX = event.clientX;
  lastMouseY = event.clientY;
}

function handleMouseUp(event) {
  mouseDown = false;
}

function handleMouseMove(event) {
  mouseX = event.clientX;
  mouseY = event.clientY;
}

function handleKeyDown(event) {
  pressedKeys.add(event.key);
}

function handleKeyUp(event) {
  pressedKeys.delete(event.key);
}

function updateCamera() {
  const currentTime = performance.now();
  const deltaTime = (currentTime - frameTimer) / 1000;
  frameTimer = currentTime;

  // rotation
  let deltaX = 0;
  let deltaY = 0;
  if (mouseDown) {
    deltaX = mouseX - lastMouseX;
    deltaY = mouseY - lastMouseY;
    lastMouseX = mouseX;
    lastMouseY = mouseY;
  }

  const sensitivity = 50 * deltaTime;
  const yaw = deltaX * sensitivity * deltaTime;
  const pitch = deltaY * sensitivity * deltaTime;

  camera.rotateYaw(-yaw);
  camera.rotatePitch(pitch);

  // movement
  const step = 1 * deltaTime;
  if (pressedKeys.has('w') || pressedKeys.has('ArrowUp')) {
    camera.moveForward(step);
  }
  if (pressedKeys.has('s') || pressedKeys.has('ArrowDown')) {
    camera.moveBackward(step);
  }
  if (pressedKeys.has('a') || pressedKeys.has('ArrowLeft')) {
    camera.moveLeft(step);
  }
  if (pressedKeys.has('d') || pressedKeys.has('ArrowRight')) {
    camera.moveRight(step);
  }
  if (pressedKeys.has('Shift')) {
    camera.moveDown(step);
  }
  if (pressedKeys.has(' ')) {
    camera.moveUp(step);
  }
}

function resizeCanvas() {
  const devicePixelRatio = window.devicePixelRatio || 1;
  canvas.width = canvas.clientWidth * devicePixelRatio;
  canvas.height = canvas.clientHeight * devicePixelRatio;
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

  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({
      device: device,
      format: format
  });

  return { device, context, format };
}

async function createPipeline(device: GPUDevice, format: any) {
  const pointCloudVertWGSL = await fetch("shaders/quadCloudVertex.wgsl").then(res => res.text());
  const pointCloudFragWGSL = await fetch("shaders/quadCloudFragment.wgsl").then(res => res.text());

  const pointCloudVertModule = device.createShaderModule({ code: pointCloudVertWGSL });
  const pointCloudFragModule = device.createShaderModule({ code: pointCloudFragWGSL });

  const viewMatrix = camera.getViewMatrix();
  const projectionMatrix = camera.getProjectionMatrix();

  const vertexBuffer = device.createBuffer({
    size: pointCloudDataBuffer.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    mappedAtCreation: true,
  });
  new Uint8Array(vertexBuffer.getMappedRange()).set(new Uint8Array(pointCloudDataBuffer));
  vertexBuffer.unmap();

  const uniformBufferData = new Float32Array([...viewMatrix, ...projectionMatrix, pointSize]);
  const uniformBufferDataPadded = new Float32Array(36);
  uniformBufferDataPadded.set(uniformBufferData);

  const uniformBuffer = device.createBuffer({
    size: uniformBufferDataPadded.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
  });
  device.queue.writeBuffer(uniformBuffer, 0, uniformBufferDataPadded.buffer);

  const indexData = new Uint32Array([
    0, 1, 2, 2, 1, 3
  ]);

  const indexBuffer = device.createBuffer({
    size: indexData.byteLength,
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    mappedAtCreation: true,
  });
  new Uint32Array(indexBuffer.getMappedRange()).set(indexData);
  indexBuffer.unmap();

  const bindGroupLayout = device.createBindGroupLayout({
    entries: [{
      binding: 0,
      visibility: GPUShaderStage.VERTEX,
      buffer: { type: 'uniform' }
    }]
  });

  const bindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [{
      binding: 0,
      resource: { buffer: uniformBuffer }
    }]
  });

  const pipelineLayout = device.createPipelineLayout({
    bindGroupLayouts: [bindGroupLayout]
  });

  const pointCloudPipeline = device.createRenderPipeline({
    layout: pipelineLayout,
    vertex: {
      module: pointCloudVertModule,
      entryPoint: 'main',
      buffers: [
        {
          arrayStride: 32,
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
        format: format,
      }],
    },
    primitive: {
      topology: 'triangle-list',
    },
  });

  return { pointCloudPipeline, vertexBuffer, indexBuffer, uniformBuffer, bindGroup };
}

async function render() {
  const webGPU = await initWebGPU();
  if (!webGPU) {
    console.error("Failed to initialize WebGPU");
    return;
  }
  const { device, context, format } = webGPU;
  const { pointCloudPipeline, vertexBuffer, indexBuffer, uniformBuffer, bindGroup } = await createPipeline(device, format);

  function frame() {
    updateFPS();
    updateCamera();

    const uniformBufferData = new Float32Array([...camera.getViewMatrix(), ...camera.getProjectionMatrix(), pointSize]);
    const uniformBufferDataPadded = new Float32Array(36);
    uniformBufferDataPadded.set(uniformBufferData);
    device.queue.writeBuffer(uniformBuffer, 0, uniformBufferDataPadded.buffer);

    const commandEncoder = device.createCommandEncoder();
    const textureView = context.getCurrentTexture().createView();

    const renderPass = commandEncoder.beginRenderPass({
        colorAttachments: [{
            view: textureView,
            loadOp: "clear",
            clearValue: [0, 0, 0, 1],
            storeOp: "store"
        }]
    });

    renderPass.setPipeline(pointCloudPipeline);
    renderPass.setVertexBuffer(0, vertexBuffer);
    renderPass.setIndexBuffer(indexBuffer, 'uint32');
    renderPass.setBindGroup(0, bindGroup);
    renderPass.drawIndexed(6, 1, 0, 0, 0);
    renderPass.end();

    device.queue.submit([commandEncoder.finish()]);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

render().catch(console.error);