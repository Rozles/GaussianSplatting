import { vec3, mat4 } from 'gl-matrix';

async function loadBinaryFile(url: string): Promise<ArrayBuffer> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to load ${url}`);
    return await response.arrayBuffer();
}

class Splat {
    private position: vec3;
    private scale: vec3;
    private color: Uint8Array;
    private rotation: Uint8Array;

    constructor (position: vec3, scale: vec3, color: Uint8Array, rotation: Uint8Array) {
        this.position = position;
        this.scale = scale;
        this.color = color;
        this.rotation = rotation;
    }

    getPosition(): vec3 {
        return this.position;
    }

    getScale(): vec3 {
        return this.scale;
    }

    getColor(): Uint8Array {
        return this.color;
    }

    getRotation(): Uint8Array {
        return this.rotation;
    }

}

export class SplatCloud {

    private points: Array<Splat>;

    constructor(file?: string) {
        this.points = [];
        if (file) {
            this.readFromFile(file);
        }
    }

    addPoint(splat: Splat) {
        this.points.push(splat)
    }

    async readFromFile(file: string) {
        try {
            const buffer = await loadBinaryFile(file);
            const dataView = new DataView(buffer);
            const numSplats = buffer.byteLength / 32;

            for (let i = 0; i < numSplats; i++) {
                const offset = i * 32;
                const position = vec3.fromValues(
                    dataView.getFloat32(offset, true),
                    dataView.getFloat32(offset + 4, true),
                    dataView.getFloat32(offset + 8, true)
                );
                const scale = vec3.fromValues(
                    dataView.getFloat32(offset + 12, true),
                    dataView.getFloat32(offset + 16, true),
                    dataView.getFloat32(offset + 20, true)
                );
                const color = new Uint8Array(buffer, offset + 24, 4);
                const rotation = new Uint8Array(buffer, offset + 28, 4);

                this.addPoint(new Splat(position, scale, color, rotation));
            }
        } catch (err) {
            console.error(err);
        }
    }

    readFromBuffer

    getPositions(): Float32Array {
        const positions = new Float32Array(this.points.length * 3);
        for (let i = 0; i < this.points.length; i++) {
            positions[i * 3] = this.points[i].getPosition()[0];
            positions[i * 3 + 1] = this.points[i].getPosition()[1];
            positions[i * 3 + 2] = this.points[i].getPosition()[2];
        }
        return positions;
    }

    getColors(): Uint8Array {
        const colors = new Uint8Array(this.points.length * 4);
        for (let i = 0; i < this.points.length; i++) {
            colors[i * 4] = this.points[i].getColor()[0];
            colors[i * 4 + 1] = this.points[i].getColor()[1];
            colors[i * 4 + 2] = this.points[i].getColor()[2];
            colors[i * 4 + 3] = this.points[i].getColor()[3];
        }
        return colors;
    }

    getScales(): Float32Array {
        const scales = new Float32Array(this.points.length * 3);
        for (let i = 0; i < this.points.length; i++) {
            scales[i * 3] = this.points[i].getScale()[0];
            scales[i * 3 + 1] = this.points[i].getScale()[1];
            scales[i * 3 + 2] = this.points[i].getScale()[2];
        }
        return scales;
    }

    getRotations(): Uint8Array {
        const rotations = new Uint8Array(this.points.length * 4);
        for (let i = 0; i < this.points.length; i++) {
            rotations[i * 4] = this.points[i].getRotation()[0];
            rotations[i * 4 + 1] = this.points[i].getRotation()[1];
            rotations[i * 4 + 2] = this.points[i].getRotation()[2];
            rotations[i * 4 + 3] = this.points[i].getRotation()[3];
        }
        return rotations;
    }

}