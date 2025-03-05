import { vec3, mat4 } from 'gl-matrix';

function rotateVectorAroundAxis(vector: vec3, axis: vec3, angle: number): vec3 {
    const rotationMatrix = mat4.create();
    mat4.fromRotation(rotationMatrix, angle, axis);

    vec3.transformMat4(vector, vector, rotationMatrix);
    vec3.normalize(vector, vector);
}

export class Camera {

    private position: vec3;
    private forwardVec: vec3;
    private up: vec3;
    private viewMatrix: mat4;

    constructor() {
        this.position = vec3.create();
        this.position[2] = 5;

        this.forwardVec = vec3.create();
        vec3.sub(this.forwardVec, vec3.create(), this.position);
        vec3.normalize(this.forwardVec, this.forwardVec);

        this.up = vec3.create();
        this.up[1] = 1;

        this.viewMatrix = mat4.create();

        this.update();
    }

    getViewMatrix(): mat4 {
        return this.viewMatrix;
    }

    update() {
        let target = vec3.create();
        vec3.add(target, this.position, this.forwardVec);
        mat4.lookAt(this.viewMatrix, this.position, target, this.up);
    }

    moveForward(distance: number) {
        vec3.scaleAndAdd(this.position, this.position, this.forwardVec, distance);

        this.update();
    }

    moveLeft(distance: number) {
        let leftVec = vec3.create();

        vec3.cross(leftVec, this.up, this.forwardVec);
        vec3.normalize(leftVec, leftVec);
        vec3.scaleAndAdd(this.position, this.position, leftVec, distance);

        this.update();
    }

    moveRight(distance: number) {
        this.moveLeft(-distance);
    }

    moveBackward(distance: number) {
        this.moveForward(-distance);
    }

    rotateYaw(radians: number) {
        rotateVectorAroundAxis(this.forwardVec, this.up, radians);
        console.log (radians);
        console.log(this.forwardVec);
        this.update();
    }

    rotatePitch(radians: number) {
        let leftVec = vec3.create();
        vec3.cross(leftVec, this.up, this.forwardVec);
        vec3.normalize(leftVec, leftVec);

        rotateVectorAroundAxis(this.forwardVec, leftVec, radians);

        this.update();
    }

    moveUp(distance: number) {
        vec3.scaleAndAdd(this.position, this.position, this.up, distance);

        this.update();
    }

    moveDown(distance: number) {
        this.moveUp(-distance);
    }
}