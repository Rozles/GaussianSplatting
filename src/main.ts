import { SplatCloud } from "./splatcloud";
import { Camera } from "./camera";
import { mat4, vec3 } from "gl-matrix";

const canvas = document.getElementById("webgpu-canvas") as HTMLCanvasElement;

const splatCloud = new SplatCloud();
await splatCloud.readFromFile("data/nike.splat");
const positions = splatCloud.getPositions();
const colors = splatCloud.getColors();

const minMaxValues = computeMinMax(positions);
const paddedMinMaxValues = new Float32Array(4);
paddedMinMaxValues.set(minMaxValues);
paddedMinMaxValues[3] = 0;

const camera = new Camera();
camera.update();

const fpsOverlay = document.getElementById("overlay");
let fpsTimer = performance.now();
let frameCount = 0;
let frameTimer = performance.now();

let mouseDown = false;
let lastMouseX = 0;
let lastMouseY = 0;
let mouseX = 0;
let mouseY = 0;
let pressedKeys = new Set<string>();

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
      fpsOverlay.textContent = frameCount.toString();
    frameCount = 0;
    fpsTimer = currentTime;
  }
}

function handleMouseDown(event) {
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

function computeMinMax(points) {
  let min = Number.MAX_VALUE;
  let max = Number.MIN_VALUE;

  let num_vectors = points.length / 3;
  for (let i = 0; i < num_vectors; i++) { 
    let x = points[i * 3];
    let y = points[i * 3 + 1];
    let z = points[i * 3 + 2];
    if (x < min) min = x;
    if (x > max) max = x;
    if (y < min) min = y;
    if (y > max) max = y;
    if (z < min) min = z;
    if (z > max) max = z;
  }

  return new Float32Array([min, max]);
}

function updateUniformBuffer(device, uniformBuffer, viewProjectionMatrix: mat4) {
  const uniforms = new Float32Array([
    ...viewProjectionMatrix,
    ...paddedMinMaxValues
  ]);

  device.queue.writeBuffer(uniformBuffer, 0, uniforms);
}

async function initWebGPU() {
  if (!navigator.gpu) {
      console.error("WebGPU is not supported!");
      return;
  }
  
  const adapter = await navigator.gpu.requestAdapter();
  const device = await adapter.requestDevice();
  const context = canvas.getContext("webgpu");

  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({
      device: device,
      format: format
  });

  return { device, context, format };
}

async function createPipeline(device, format) {

  const pointCloudVertWGSL = await fetch("shaders/pointcloudVertex.wgsl").then(res => res.text());
  const pointCloudFragWGSL = await fetch("shaders/pointcloudFragment.wgsl").then(res => res.text());

  const pointCloudVertModule = device.createShaderModule({ code: pointCloudVertWGSL });
  const pointCloudFragModule = device.createShaderModule({ code: pointCloudFragWGSL });

  const viewProjectionMatrix = camera.getViewProjectionMatrix();

  const positionBuffer = device.createBuffer({
    size: positions.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    mappedAtCreation: true,
  });
  new Float32Array(positionBuffer.getMappedRange()).set(positions);
  positionBuffer.unmap();

  const colorBuffer = device.createBuffer({
    size: colors.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    mappedAtCreation: true,
  });
  new Int32Array(colorBuffer.getMappedRange()).set(colors);
  colorBuffer.unmap();

  const uniforms = new Float32Array([...viewProjectionMatrix,...paddedMinMaxValues]);

  const uniformBuffer = device.createBuffer({
    size: uniforms.byteLength,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
  });
  device.queue.writeBuffer(uniformBuffer, 0, uniforms);

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
          arrayStride: 3 * 4,
          attributes: [{
            shaderLocation: 0,
            offset: 0,
            format: 'float32x3',
          }],
        },
        {
          arrayStride: 4 * 4,
          attributes: [{
            shaderLocation: 1,
            offset: 0,
            format: 'uint32x4',
          }],
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
      topology: 'point-list',
    },
  });

  return { pointCloudPipeline, positionBuffer, colorBuffer, uniformBuffer, bindGroup };
}

async function render() {
  const webGPU = await initWebGPU();
  if (!webGPU) {
    console.error("Failed to initialize WebGPU");
    return;
  }
  const { device, context, format } = webGPU;
  const { pointCloudPipeline, positionBuffer, colorBuffer, uniformBuffer, bindGroup } = await createPipeline(device, format);

  function frame() {
    updateFPS();
    updateCamera();

    const viewProjectionMatrix = camera.getViewProjectionMatrix();

    updateUniformBuffer(device, uniformBuffer, viewProjectionMatrix);

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
    renderPass.setVertexBuffer(0, positionBuffer);
    renderPass.setVertexBuffer(1, colorBuffer);
    renderPass.setBindGroup(0, bindGroup);
    renderPass.draw(positions.length / 3); // Number of points
    renderPass.end();

    device.queue.submit([commandEncoder.finish()]);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

render().catch(console.error);