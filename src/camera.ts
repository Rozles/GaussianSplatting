import { vec3, mat4 } from 'gl-matrix';

function rotateVectorAroundAxis(vector: vec3, axis: vec3, angle: number): vec3 {
    const rotationMatrix = mat4.create();
    mat4.fromRotation(rotationMatrix, angle, axis);

    vec3.transformMat4(vector, vector, rotationMatrix);
    vec3.normalize(vector, vector);
}

let mouseDown = false;
let lastMouseX = 0;
let lastMouseY = 0;
let mouseX = 0;
let mouseY = 0;
let pressedKeys = new Set<string>();
let frameTimer = performance.now();

window.addEventListener('mousemove', handleMouseMove);
window.addEventListener('mousedown', handleMouseDown);
window.addEventListener('mouseup', handleMouseUp);
window.addEventListener('keydown', handleKeyDown);
window.addEventListener('keyup', handleKeyUp);

function handleMouseDown(event) {
  // check if the mouse is inside the canvas
  if (event.target.tagName === 'CANVAS') {
  
    mouseDown = true;
    lastMouseX = event.clientX;
    lastMouseY = event.clientY;
  }
}
  
function handleMouseUp(event) {
    mouseDown = false;
}

function handleMouseMove(event) {
    mouseX = event.clientX;
    mouseY = event.clientY;
}

function handleKeyDown(event) {
    pressedKeys.add(event.key.toLowerCase());
}

function handleKeyUp(event) {
    pressedKeys.delete(event.key.toLowerCase());
}

export function updateCamera(camera: Camera) {
    const currentTime = performance.now();
    const deltaTime = (currentTime - frameTimer) / 1000;
    frameTimer = currentTime;
  
    // rotation
    let deltaX = 0;
    let deltaY = 0;
    if (mouseDown) {
      deltaX = mouseX - lastMouseX;
      deltaY = mouseY - lastMouseY;
      lastMouseX = mouseX;
      lastMouseY = mouseY;
    }
  
    const sensitivity = 1 * deltaTime;
    const yaw = deltaX * sensitivity;
    const pitch = deltaY * sensitivity;
  
    camera.rotateYaw(-yaw);
    camera.rotatePitch(pitch);
  
    // movement
    const step = 1 * deltaTime;
    if (pressedKeys.has('w') || pressedKeys.has('arrowup')) {
      camera.moveForward(step);
    }
    if (pressedKeys.has('s') || pressedKeys.has('arrowdown')) {
      camera.moveBackward(step);
    }
    if (pressedKeys.has('a') || pressedKeys.has('arrowleft')) {
      camera.moveLeft(step);
    }
    if (pressedKeys.has('d') || pressedKeys.has('arrowright')) {
      camera.moveRight(step);
    }
    if (pressedKeys.has('shift')) {
      camera.moveDown(step);
    }
    if (pressedKeys.has(' ')) {
      camera.moveUp(step);
    }
  }

export class Camera {

    private position: vec3;
    private forwardVec: vec3;
    private up: vec3;
    private viewMatrix: mat4;
    private perspectiveMatrix: mat4;
    private aspect: number;

    constructor(aspect: number) {
        this.position = vec3.create();
        this.position[2] = 5;

        this.forwardVec = vec3.create();
        vec3.sub(this.forwardVec, vec3.create(), this.position);
        vec3.normalize(this.forwardVec, this.forwardVec);

        this.up = vec3.create();
        this.up[1] = 1;

        this.viewMatrix = mat4.create();
        this.aspect = aspect;

        this.perspectiveMatrix = mat4.create();
        mat4.perspective(this.perspectiveMatrix, Math.PI / 3, this.aspect, 0.1, 100);

        this.update();
    }

    getViewMatrix(): mat4 {
        return this.viewMatrix;
    }

    getProjectionMatrix(): mat4 {
        return this.perspectiveMatrix;
    }

    getViewProjectionMatrix(): mat4 {
        let viewProjectionMatrix = mat4.create();
        mat4.multiply(viewProjectionMatrix, this.perspectiveMatrix, this.viewMatrix);
        return viewProjectionMatrix;
    }

    setAspect(aspect: number) {
        this.aspect = aspect;
        mat4.perspective(this.perspectiveMatrix, Math.PI / 3, this.aspect, 0.1, 100);
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
        let upVec = vec3.create();
        vec3.cross(upVec, this.forwardVec, this.up);
        vec3.cross(upVec, upVec, this.forwardVec);
        vec3.normalize(upVec, upVec);
        vec3.scaleAndAdd(this.position, this.position, upVec, distance);

        this.update();
    }

    moveDown(distance: number) {
        this.moveUp(-distance);
    }
}