// Overlay

export class GUI {
    fpsOverlay: HTMLElement | null = null;
    sizeRangeInput: HTMLInputElement | null = null;
    sizeNumberInput: HTMLInputElement | null = null;

    fpsTimer = performance.now();
    frameCount = 0;

    pointSize = 1.0;

    constructor() {
        this.fpsOverlay = document.getElementById("fps");
        this.sizeRangeInput = document.getElementById("size") as HTMLInputElement;
        this.sizeNumberInput = document.getElementById("size-number") as HTMLInputElement;

        this.sizeRangeInput.addEventListener("input", () => {
            if (!this.sizeRangeInput) return;
            if (!this.sizeNumberInput) return;
            this.sizeNumberInput.value = this.sizeRangeInput.value;
            this.pointSize = parseFloat(this.sizeRangeInput.value);
        });
        this.sizeNumberInput.addEventListener("input", () => {
            if (!this.sizeRangeInput) return;
            if (!this.sizeNumberInput) return;
            this.sizeRangeInput.value = this.sizeNumberInput.value;
            this.pointSize = parseFloat(this.sizeNumberInput.value);
        }); 
    }

    updateFPS() {
        const currentTime = performance.now();
        this.frameCount++;
        if (currentTime - this.fpsTimer >= 1000) {
          if (this.fpsOverlay)
            this.fpsOverlay.textContent = 'FPS: ' + this.frameCount.toString();
          this.frameCount = 0;
          this.fpsTimer = currentTime;
        }
    }

    getSize() {
        return this.pointSize;
    }
}