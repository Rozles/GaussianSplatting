import { loadBinaryFile } from "./utils";
import { Camera, updateCamera } from "./camera";
import { vec3, mat4 } from "gl-matrix"; 
import { createAxisGizmoPipeline } from "./gizmo";

const canvas = document.getElementById("webgpu-canvas") as HTMLCanvasElement;

let aspect = canvas.width / canvas.height;
const camera = new Camera(aspect);

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
const gaussianCloud = await loadBinaryFile("data/nike.splat");
const numberOfPoints = gaussianCloud.byteLength / 32;


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
  //const pointCloudVertWGSL = await fetch("shaders/gaussianSplat.vertex.wgsl").then(res => res.text());
  //const pointCloudFragWGSL = await fetch("shaders/gaussianSplat.frag.wgsl").then(res => res.text());

  const pointCloudVertWGSL = await fetch("shaders/quadsVertex.wgsl").then(res => res.text());
  const pointCloudFragWGSL = await fetch("shaders/quadsFragment.wgsl").then(res => res.text());


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
            srcFactor: 'one',
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
      depthWriteEnabled: false,
      depthCompare: "less",
    },
    primitive:{
      topology: "triangle-list",
    },
  });

  const vertexBuffer = device.createBuffer({
    size: gaussianCloud.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE,
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

  depthTexture = device.createTexture({
    size: [canvas.width, canvas.height, 1],
    format: "depth24plus",
    usage: GPUTextureUsage.RENDER_ATTACHMENT,
  });

  return { pipeline, vertexBuffer, uniformBuffer, bindGroup };
}

async function createSortingPipeline(device: GPUDevice) {
  const computeDepthWGSL = await fetch("shaders/computeDepth.wgsl").then(res => res.text());
  const bitonicSortWGSL = await fetch("shaders/bitonicSort.wgsl").then(res => res.text());

  const computeDepthModule = device.createShaderModule({ code: computeDepthWGSL });
  const bitonicSortModule = device.createShaderModule({ code: bitonicSortWGSL });
  
  const numPoints = gaussianCloud.byteLength / 32;
  const depthIndicesBuffer = device.createBuffer({
    size: numPoints * 4,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.VERTEX
  });
  
  const depthValuesBuffer = device.createBuffer({
    size: numPoints * 4,
    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
  });
  
  const initialIndices = new Uint32Array(numPoints);
  for (let i = 0; i < numPoints; i++) {
    initialIndices[i] = i;
  }
  device.queue.writeBuffer(depthIndicesBuffer, 0, initialIndices);
  
  const sortParamsBuffer = device.createBuffer({
    size: 16,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
  });
  
  // Create bind group layouts
  const computeDepthBindGroupLayout = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
      { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
      { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
      { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
    ]
  });
  
  const sortBindGroupLayout = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
      { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
      { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
    ]
  });
  
  // Create pipelines
  const computeDepthPipeline = device.createComputePipeline({
    layout: device.createPipelineLayout({
      bindGroupLayouts: [computeDepthBindGroupLayout]
    }),
    compute: {
      module: computeDepthModule,
      entryPoint: 'main'
    }
  });
  
  const sortPipeline = device.createComputePipeline({
    layout: device.createPipelineLayout({
      bindGroupLayouts: [sortBindGroupLayout]
    }),
    compute: {
      module: bitonicSortModule,
      entryPoint: 'main'
    }
  });
  
  return {
    computeDepthPipeline,
    sortPipeline,
    depthIndicesBuffer,
    depthValuesBuffer,
    sortParamsBuffer,
    computeDepthBindGroupLayout,
    sortBindGroupLayout
  };
}

async function render() {
  const { pipeline, vertexBuffer, uniformBuffer, bindGroup } = await createPipeline(device, presentationFormat);
  const { gizmoPipeline, axisBuffer } = await createAxisGizmoPipeline(device, presentationFormat);
  const { 
    computeDepthPipeline,
    sortPipeline,
    depthIndicesBuffer,
    depthValuesBuffer,
    sortParamsBuffer,
    computeDepthBindGroupLayout,
    sortBindGroupLayout
  } = await createSortingPipeline(device);

  device.queue.writeBuffer(vertexBuffer, 0, gaussianCloud.buffer);

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

    // Create bind groups for this frame
    const computeDepthBindGroup = device.createBindGroup({
      layout: computeDepthBindGroupLayout,
      entries: [
        { binding: 0, resource: { buffer: uniformBuffer } },
        { binding: 1, resource: { buffer: vertexBuffer } },
        { binding: 2, resource: { buffer: depthIndicesBuffer } },
        { binding: 3, resource: { buffer: depthValuesBuffer } },
      ]
    });
    
    // Step 1: Compute depths
    const computePass = commandEncoder.beginComputePass();
    computePass.setPipeline(computeDepthPipeline);
    computePass.setBindGroup(0, computeDepthBindGroup);
    computePass.dispatchWorkgroups(Math.ceil(numberOfPoints / 256));
    computePass.end();
    
    // Step 2: Sort depths using bitonic sort
    // Bitonic sort requires power-of-2 sized arrays
    const powerOf2Size = Math.pow(2, Math.ceil(Math.log2(numberOfPoints)));
    
    // For each stage of the bitonic sort
    for (let stage = 1; stage < powerOf2Size; stage <<= 1) {
      for (let substage = stage; substage > 0; substage >>= 1) {
        const sortParams = new Uint32Array([numberOfPoints, substage, 0, 0]); // size, stage, direction
        device.queue.writeBuffer(sortParamsBuffer, 0, sortParams);
        
        const sortBindGroup = device.createBindGroup({
          layout: sortBindGroupLayout,
          entries: [
            { binding: 0, resource: { buffer: depthIndicesBuffer } },
            { binding: 1, resource: { buffer: depthValuesBuffer } },
            { binding: 2, resource: { buffer: sortParamsBuffer } },
          ]
        });
        
        const sortPass = commandEncoder.beginComputePass();
        sortPass.setPipeline(sortPipeline);
        sortPass.setBindGroup(0, sortBindGroup);
        sortPass.dispatchWorkgroups(Math.ceil(powerOf2Size / 512));
        sortPass.end();
      }
    }

    // Step 3: Render with sorted indices
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
    
    // Using indirect drawing with the sorted indices buffer
    renderPass.setVertexBuffer(1, depthIndicesBuffer); // Set our indices buffer as a secondary vertex buffer
    renderPass.draw(6, numberOfPoints, 0, 0);

    // Render axis gizmo
    renderPass.setPipeline(gizmoPipeline);
    renderPass.setVertexBuffer(0, axisBuffer);
    renderPass.setBindGroup(0, bindGroup); 
    renderPass.draw(6, 1, 0, 0);

    renderPass.end();

    device.queue.submit([commandEncoder.finish()]);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

render().catch(console.error);