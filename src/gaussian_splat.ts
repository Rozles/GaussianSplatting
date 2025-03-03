import { mat4 } from "gl-matrix";
import { createShaderModule } from "./webgpu";

export class GaussianSplatRenderer {
    private device: GPUDevice;

    constructor(gpu: { device: GPUDevice }) {
        this.device = gpu.device;
    }

    async render() {
        console.log("Rendering Gaussian splats...");
        // TODO: Implement point rendering with Gaussian blending
    }
}