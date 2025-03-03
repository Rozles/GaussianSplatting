
export function quitIfAdapterNotAvailable(adapter: GPUAdapter | null): asserts adapter {
    if (!('gpu' in navigator)) {
        fail('navigator.gpu is not defined - WebGPU not available in this browser');
    }

    if (!adapter) {
        fail("requestAdapter returned null - this sample can't run on this system");
    }
}  

export function quitIfWebGPUNotAvailable(adapter: GPUAdapter | null, device: GPUDevice | null): asserts device {
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

export async function initWebGPU() {
    if (!navigator.gpu) {
        throw new Error("WebGPU not supported on this browser.");
    }

    const adapter = await navigator.gpu.requestAdapter();
    const device = await adapter?.requestDevice();
    if (!device) {
        throw new Error("Failed to get GPU device.");
    }

    const canvas = document.getElementById("webgpu-canvas") as HTMLCanvasElement;
    const context = canvas.getContext("webgpu");

    const format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({ device, format });

    return { device, context, format };
}

export function createShaderModule(device: GPUDevice, code: string): GPUShaderModule {
    return device.createShaderModule({ code });
}