import { vec3, mat4, vec4 } from 'gl-matrix';

export async function loadBinaryFile(url: string): Promise<Uint8Array> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to load ${url}`);
    let data: ArrayBuffer = await response.arrayBuffer();
    return new Uint8Array(data);
}

export function sortGaussians(view: mat4) {

}

class Gaussian {
    position: vec3;
    scale: vec3;
    color: number;
    rotation: number;

    constructor(position: vec3, scale: vec3, color: number, rotation: number) {
        this.position = position;
        this.scale = scale;
        this.color = color;
        this.rotation = rotation;
    }
}

export class GaussianCloud {

    private gaussians: Array<Gaussian>;

    constructor(dataBuffer: ArrayBuffer) {

        this.gaussians = [];
        let numberOfPoints = dataBuffer.byteLength / 32;

        for (let i = 0; i < numberOfPoints; i++) {
            let positionArray = new Float32Array(dataBuffer, i * 32, 3);
            let position = vec3.fromValues(positionArray[0], positionArray[1], positionArray[2]);

            let scaleArray = new Float32Array(dataBuffer, i * 32 + 12, 3);
            let scale = vec3.fromValues(scaleArray[0], scaleArray[1], scaleArray[2]);

            let colorArray = new Uint32Array(dataBuffer, i * 32 + 24, 1);
            let color = colorArray[0];

            let rotationArray = new Uint32Array(dataBuffer, i * 32 + 28, 1);
            let rotation = rotationArray[0];

            this.gaussians.push(new Gaussian(position, scale, color, rotation));
        }
    }

    length() {
        return this.gaussians.length;
    }

    size() {
        return this.gaussians.length * 32;
    }

    data() {
        return this.gaussians;
    }
}