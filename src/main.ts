import { SplatCloud } from "./splatcloud";
import { mat4, vec3 } from "gl-matrix";

const canvas = document.getElementById("webgpu-canvas") as HTMLCanvasElement;
const devicePixelRatio = window.devicePixelRatio;
canvas.width = canvas.clientWidth * devicePixelRatio;
canvas.height = canvas.clientHeight * devicePixelRatio;

const splatCloud = new SplatCloud();

await splatCloud.readFromFile("data/nike.splat");

const positions = splatCloud.getPositions();

const minMaxValues = computeMinMax(positions);

function computeMinMax(points) {
  let minX = Number.MAX_VALUE;
  let maxX = Number.MIN_VALUE;
  let minY = Number.MAX_VALUE;
  let maxY = Number.MIN_VALUE;
  let minZ = Number.MAX_VALUE;
  let maxZ = Number.MIN_VALUE;

  let num_vectors = points.length / 3;
  for (let i = 0; i < num_vectors; i++) { 
    let x = points[i * 3];
    let y = points[i * 3 + 1];
    let z = points[i * 3 + 2];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }

  return new Float32Array([minX, maxX, minY, maxY, minZ, maxZ]);
}

let cameraPosition = vec3.fromValues(0, 0, 5);
const cameraTarget = vec3.fromValues(0, 0, 0);
const upDirection = vec3.fromValues(0, 1, 0);

function updateViewMatrix() {
  const viewMatrix = mat4.create();
  mat4.lookAt(viewMatrix, cameraPosition, cameraTarget, upDirection);
  return viewMatrix;
}

function updateUniformBuffer(device, uniformBuffer, viewProjectionMatrix, minMaxValues) {
  const paddedMinMaxValues = new Float32Array(8);
  paddedMinMaxValues.set(minMaxValues);

  const uniforms = new Float32Array([
    ...viewProjectionMatrix,
    ...paddedMinMaxValues
  ]);

  device.queue.writeBuffer(uniformBuffer, 0, uniforms);
}

function handleKeyDown(event) {
  const moveSpeed = 0.1;
  switch (event.key) {
    case 'w':
      cameraPosition[2] -= moveSpeed;
      break;
    case 's':
      cameraPosition[2] += moveSpeed;
      break;
    case 'a':
      cameraPosition[0] -= moveSpeed;
      break;
    case 'd':
      cameraPosition[0] += moveSpeed;
      break;
    case 'q':
      cameraPosition[1] -= moveSpeed;
      break;
    case 'e':
      cameraPosition[1] += moveSpeed;
      break;
  }
}

// Add event listener for keyboard input
window.addEventListener('keydown', handleKeyDown);

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

  const viewMatrix = updateViewMatrix();
  const projectionMatrix = mat4.create();

  mat4.perspective(projectionMatrix, Math.PI / 4, canvas.width / canvas.height, 0.1, 100.0);

  const viewProjectionMatrix = mat4.create();
  mat4.multiply(viewProjectionMatrix, projectionMatrix, viewMatrix);

  const positionBuffer = device.createBuffer({
    size: positions.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    mappedAtCreation: true,
  });

  new Float32Array(positionBuffer.getMappedRange()).set(positions);
  positionBuffer.unmap();

  const paddedMinMaxValues = new Float32Array(8);
  paddedMinMaxValues.set(minMaxValues);

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
      buffers: [{
        arrayStride: 3 * 4,
        attributes: [{
          shaderLocation: 0,
          offset: 0,
          format: 'float32x3',
        }],
      }],
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

  return { pointCloudPipeline, positionBuffer, uniformBuffer, bindGroup, projectionMatrix };
}

async function render() {
  const webGPU = await initWebGPU();
  if (!webGPU) {
    console.error("Failed to initialize WebGPU");
    return;
  }
  const { device, context, format } = webGPU;
  const { pointCloudPipeline, positionBuffer, uniformBuffer, bindGroup, projectionMatrix } = await createPipeline(device, format);

  function frame() {
    const viewMatrix = updateViewMatrix();
    const viewProjMatrix = mat4.create();
    mat4.multiply(viewProjMatrix, projectionMatrix, viewMatrix);

    updateUniformBuffer(device, uniformBuffer, viewProjMatrix, minMaxValues);

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
    renderPass.setBindGroup(0, bindGroup);
    renderPass.draw(positions.length / 3); // Number of points
    renderPass.end();

    device.queue.submit([commandEncoder.finish()]);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

render().catch(console.error);