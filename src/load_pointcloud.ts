import * as fs from 'fs';
import { vec3, mat4 } from 'gl-matrix';

function readBinaryFile(filePath: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        fs.readFile(filePath, (err, data) => {
            if (err) {
                reject(err);
            } else {
                resolve(data);
            }
        });
    });
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

}

export class PointCloud {

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
            const buffer = await readBinaryFile(file);
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

}