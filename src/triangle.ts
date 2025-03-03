import { createShaderModule } from "./webgpu";

export class TriangleRenderer {
    private device: GPUDevice;
    private pipeline!: GPURenderPipeline;
    private pipelineReady: Promise<void>;

    constructor(gpu: { device: GPUDevice, format: GPUTextureFormat }) {
        this.device = gpu.device;
        this.pipelineReady = this.createPipeline(gpu.format);
    }

    private async createPipeline(format: GPUTextureFormat) {
        const vertexShaderCode = await fetch("shaders/triangle.wgsl").then(res => res.text());
        const fragmentShaderCode = await fetch("shaders/fragment.wgsl").then(res => res.text());

        const vertexShader = createShaderModule(this.device, vertexShaderCode);
        const fragmentShader = createShaderModule(this.device, fragmentShaderCode);

        this.pipeline = this.device.createRenderPipeline({
            layout: "auto",
            vertex: { module: vertexShader, entryPoint: "main" },
            fragment: {
                module: fragmentShader,
                entryPoint: "main",
                targets: [{ format }]
            },
            primitive: { topology: "triangle-list" }
        });
    }

    async render(passEncoder: GPURenderPassEncoder) {
        await this.pipelineReady;
        passEncoder.setPipeline(this.pipeline);
        passEncoder.draw(3);
        passEncoder.end();
    }
}