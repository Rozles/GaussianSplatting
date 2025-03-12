import { vec3, mat4, vec4 } from 'gl-matrix';

export async function loadBinaryFile(url: string): Promise<Uint8Array> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to load ${url}`);
    let data: ArrayBuffer = await response.arrayBuffer();
    return new Uint8Array(data);
}

export async function loadGaussianCloud(url: string): Promise<GaussianCloud> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to load ${url}`);
    let data: ArrayBuffer = await response.arrayBuffer();
    return new GaussianCloud(data);
}

export function sortGaussians(view: mat4) {

}

export class Gaussian {
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

    getPosition() {
        return this.position;
    }

    getScale() {
        return this.scale;
    }

    getColor() {
        return this.color;
    }

    getRotation() {
        return this.rotation;
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

    sort(view: mat4) {
        this.gaussians.sort((a, b) => {
            let aPosition = vec4.fromValues(a.position[0], a.position[1], a.position[2], 1);
            let bPosition = vec4.fromValues(b.position[0], b.position[1], b.position[2], 1);

            let aTransformed = vec4.create();
            let bTransformed = vec4.create();

            vec4.transformMat4(aTransformed, aPosition, view);
            vec4.transformMat4(bTransformed, bPosition, view);

            return aTransformed[2] - bTransformed[2];
        });
    }

    getGaussian(i: number) {
        return this.gaussians[i];
    }
}