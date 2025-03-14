import { vec3, mat4 } from 'gl-matrix';

function rotateVectorAroundAxis(vector: vec3, axis: vec3, angle: number): vec3 {
    const rotationMatrix = mat4.create();
    mat4.fromRotation(rotationMatrix, angle, axis);

    vec3.transformMat4(vector, vector, rotationMatrix);
    vec3.normalize(vector, vector);
}

export class CameraController {
    private camera: Camera;
    private mouseDown = false;
    private lastMouseX = 0;
    private lastMouseY = 0;
    private mouseX = 0;
    private mouseY = 0;
    private pressedKeys: Set<string>;
    private frameTimer: number;

    constructor(aspect: number) {
        this.camera = new Camera(aspect);
        this.pressedKeys = new Set<string>();
        this.frameTimer = performance.now();

        // Bind the event handlers to the current instance
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleMouseDown = this.handleMouseDown.bind(this);
        this.handleMouseUp = this.handleMouseUp.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleKeyUp = this.handleKeyUp.bind(this);

        window.addEventListener('mousemove', this.handleMouseMove);
        window.addEventListener('mousedown', this.handleMouseDown);
        window.addEventListener('mouseup', this.handleMouseUp);
        window.addEventListener('keydown', this.handleKeyDown);
        window.addEventListener('keyup', this.handleKeyUp);
    }

    getCamera(): Camera {
        return this.camera;
    }

    getPosition(): vec3 {
        return this.camera.getPosition();
    }

    getViewMatrix(): mat4 {
        return this.camera.getViewMatrix();
    }

    getViewMatrixInverse(): mat4 {
        let viewMatrix = this.camera.getViewMatrix();
        let inverse = mat4.create();
        mat4.invert(inverse, viewMatrix);
        return inverse;
    }

    getProjectionMatrix(): mat4 {
        return this.camera.getProjectionMatrix();
    }

    update() {
        this.updateCamera(this.camera);
    }

    setAspect(aspect: number) {
        this.camera.setAspect(aspect);
    }

    handleMouseDown(event) {
        // check if the mouse is inside the canvas
        if (event.target.tagName === 'CANVAS') {
        
            this.mouseDown = true;
            this.lastMouseX = event.clientX;
            this.lastMouseY = event.clientY;
        }
    }
        
    handleMouseUp(event) {
        this.mouseDown = false;
    }
    
    handleMouseMove(event) {
        this.mouseX = event.clientX;
        this.mouseY = event.clientY;
    }
    
    handleKeyDown(event) {
        this.pressedKeys.add(event.key.toLowerCase());
    }
      
    handleKeyUp(event) {
        this.pressedKeys.delete(event.key.toLowerCase());
    }

    updateCamera() {
        const currentTime = performance.now();
        const deltaTime = (currentTime - this.frameTimer) / 1000;
        this.frameTimer = currentTime;
        
        // rotation
        let deltaX = 0;
        let deltaY = 0;
        if (this.mouseDown) {
            deltaX = this.mouseX - this.lastMouseX;
            deltaY = this.mouseY - this.lastMouseY;
            this.lastMouseX = this.mouseX;
            this.lastMouseY = this.mouseY;
        }
        
        const sensitivity = 1 * deltaTime;
        const yaw = deltaX * sensitivity;
        const pitch = deltaY * sensitivity;
        
        this.camera.rotateYaw(-yaw);
        this.camera.rotatePitch(pitch);
        
        // movement
        const step = 1 * deltaTime;
        if (this.pressedKeys.has('w') || this.pressedKeys.has('arrowup')) {
            this.camera.moveForward(step);
        }
        if (this.pressedKeys.has('s') || this.pressedKeys.has('arrowdown')) {
            this.camera.moveBackward(step);
        }
        if (this.pressedKeys.has('a') || this.pressedKeys.has('arrowleft')) {
            this.camera.moveLeft(step);
        }
        if (this.pressedKeys.has('d') || this.pressedKeys.has('arrowright')) {
            this.camera.moveRight(step);
        }
        if (this.pressedKeys.has('shift')) {
            this.camera.moveDown(step);
        }
        if (this.pressedKeys.has(' ')) {
            this.camera.moveUp(step);
        }
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

    getPosition(): vec3 {
        return this.position;
    }

    setPosition(position: vec3) {
        this.position = position;
        this.update();
    }

    setForwardVec(forwardVec: vec3) {
        this.forwardVec = forwardVec;
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