/* Unified keyboard + touch input with edge detection for jump/pause/mute. */

export type TouchControl = "left" | "right" | "jump" | "run";

const PREVENT = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Space",
]);

export class Input {
  left = false;
  right = false;
  run = false;
  jumpHeld = false;
  jumpPressed = false;
  pausePressed = false;
  mutePressed = false;
  anyPressed = false;

  private touchState: Record<TouchControl, boolean> = {
    left: false,
    right: false,
    jump: false,
    run: false,
  };

  private onKeyDown = (e: KeyboardEvent) => {
    if (PREVENT.has(e.code)) e.preventDefault();
    if (e.repeat) return;
    switch (e.code) {
      case "ArrowLeft":
      case "KeyA":
        this.left = true;
        this.anyPressed = true;
        break;
      case "ArrowRight":
      case "KeyD":
        this.right = true;
        this.anyPressed = true;
        break;
      case "ArrowUp":
      case "KeyW":
      case "Space":
      case "KeyZ":
        this.jumpHeld = true;
        this.jumpPressed = true;
        this.anyPressed = true;
        break;
      case "ShiftLeft":
      case "ShiftRight":
      case "KeyX":
        this.run = true;
        break;
      case "KeyP":
      case "Escape":
        this.pausePressed = true;
        break;
      case "KeyM":
        this.mutePressed = true;
        break;
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    switch (e.code) {
      case "ArrowLeft":
      case "KeyA":
        this.left = false;
        break;
      case "ArrowRight":
      case "KeyD":
        this.right = false;
        break;
      case "ArrowUp":
      case "KeyW":
      case "Space":
      case "KeyZ":
        this.jumpHeld = false;
        break;
      case "ShiftLeft":
      case "ShiftRight":
      case "KeyX":
        this.run = false;
        break;
    }
  };

  private onBlur = () => {
    this.left = this.right = this.run = this.jumpHeld = false;
    this.touchState.left = this.touchState.right = false;
    this.touchState.jump = this.touchState.run = false;
  };

  attach() {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
  }

  detach() {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
  }

  setTouch(c: TouchControl, active: boolean) {
    this.touchState[c] = active;
    if (active) this.anyPressed = true;
  }

  /** Recompute held flags from both sources (call once per frame). */
  private sync() {
    this.left = this.left || this.touchState.left;
    this.right = this.right || this.touchState.right;
    this.run = this.run || this.touchState.run;
    this.jumpHeld = this.jumpHeld || this.touchState.jump;
  }

  beginFrame() {
    this.sync();
  }

  /** Clear per-frame edges — call at end of each game update. */
  endFrame() {
    this.jumpPressed = false;
    this.pausePressed = false;
    this.mutePressed = false;
    this.anyPressed = false;
  }

  clearAll() {
    this.left = this.right = this.run = this.jumpHeld = false;
    this.jumpPressed = this.pausePressed = this.mutePressed = false;
    this.anyPressed = false;
    this.touchState.left = this.touchState.right = false;
    this.touchState.jump = this.touchState.run = false;
  }
}
