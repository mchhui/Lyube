import { lockAxis } from "./gesture-axis";

const OPEN_SNAP = 96;
const CLOSE_PUSH = 96;
const MOVE_THRESHOLD = 8;
const PRESET_MIN_HEIGHT = 196;
const PRESET_GRIP_MIN = 52;

export type TimeStage = "closed" | "wheel" | "full";

export class CascadedTimePanel {
  private container: HTMLElement | null = null;
  private panel: HTMLElement | null = null;
  private outerHint: HTMLElement | null = null;
  private innerHint: HTMLElement | null = null;
  private stage1 = 360;
  private stage2 = 560;
  private pull = 0;
  private stage: TimeStage = "closed";
  private pointerTracking = false;
  private dragging = false;
  private dragStartedStage: TimeStage = "closed";
  private dragFromPresetGrip = false;
  private moved = false;
  private tapToggle = false;
  private startX = 0;
  private startY = 0;
  private pointerId = -1;
  private captureEl: HTMLElement | null = null;
  private pendingPresetCell: HTMLElement | null = null;
  private onChange: ((stage: TimeStage) => void) | null = null;
  private onPresetTap: ((cell: HTMLElement) => void) | null = null;

  mount(
    container: HTMLElement,
    onChange: (stage: TimeStage) => void,
    options?: { onPresetTap?: (cell: HTMLElement) => void }
  ) {
    this.container = container;
    this.onChange = onChange;
    this.onPresetTap = options?.onPresetTap ?? null;
    this.panel = container.querySelector(":scope > .scroll-panel");
    this.outerHint = container.querySelector(":scope > .scroll-grip .scroll-hint");
    this.innerHint = container.querySelector(".scroll-preset-grip .scroll-hint");

    this.measure();
    this.applyStage(this.stage, false);
    requestAnimationFrame(() => {
      this.measure();
      if (this.stage !== "closed") this.applyStage(this.stage, false);
    });

    container.querySelector<HTMLElement>(":scope > .scroll-grip")?.addEventListener("pointerdown", this.onOuterGripDown);
    container.querySelector<HTMLElement>(".scroll-paper-wheel")?.addEventListener("pointerdown", this.onWheelPaperDown, true);
    container.querySelector<HTMLElement>(".scroll-preset-grip")?.addEventListener("pointerdown", this.onPresetGripDown);
    container.querySelector<HTMLElement>(".scroll-preset-body")?.addEventListener("pointerdown", this.onPresetBodyDown, true);

    window.addEventListener("pointermove", this.onMove);
    window.addEventListener("pointerup", this.onUp);
    window.addEventListener("pointercancel", this.onUp);
  }

  isWheelOpen() {
    return this.stage !== "closed";
  }

  getStage() {
    return this.stage;
  }

  setStage(stage: TimeStage, animate = true) {
    this.applyStage(stage, animate);
  }

  destroy() {
    if (!this.container) return;
    this.container.querySelector(":scope > .scroll-grip")?.removeEventListener("pointerdown", this.onOuterGripDown);
    this.container.querySelector(".scroll-paper-wheel")?.removeEventListener("pointerdown", this.onWheelPaperDown, true);
    this.container.querySelector(".scroll-preset-grip")?.removeEventListener("pointerdown", this.onPresetGripDown);
    this.container.querySelector(".scroll-preset-body")?.removeEventListener("pointerdown", this.onPresetBodyDown, true);
    window.removeEventListener("pointermove", this.onMove);
    window.removeEventListener("pointerup", this.onUp);
    window.removeEventListener("pointercancel", this.onUp);
  }

  private measure() {
    if (!this.container || !this.panel) return;
    const wheel = this.container.querySelector<HTMLElement>(".scroll-paper-wheel");
    const grip = this.container.querySelector<HTMLElement>(".scroll-preset-grip");
    const presetBody = this.container.querySelector<HTMLElement>(".scroll-preset-body");
    const presetPaper = this.container.querySelector<HTMLElement>(".scroll-paper-preset");
    if (!wheel || !grip || !presetBody || !presetPaper) return;

    const prevPanel = this.panel.style.height;
    const prevBody = presetBody.style.height;
    const prevOverflow = presetBody.style.overflow;

    this.panel.style.height = "auto";
    presetBody.style.height = "auto";
    presetBody.style.overflow = "visible";

    this.stage1 = wheel.offsetHeight + Math.max(grip.offsetHeight, PRESET_GRIP_MIN);
    const presetH = Math.max(presetPaper.offsetHeight, PRESET_MIN_HEIGHT);
    this.stage2 = this.stage1 + presetH;

    this.panel.style.height = prevPanel;
    presetBody.style.height = prevBody;
    presetBody.style.overflow = prevOverflow;
  }

  private onOuterGripDown = (e: Event) => {
    const ev = e as PointerEvent;
    ev.preventDefault();
    this.armPointer(ev, ev.currentTarget as HTMLElement, true, false, null);
  };

  private onWheelPaperDown = (e: Event) => {
    if (this.stage === "closed") return;
    const ev = e as PointerEvent;
    if (!(ev.target instanceof HTMLElement)) return;
    if (ev.target.closest(".wheel-input-overlay")) return;
    if (
      ev.target.closest(".wheel-scroll, #wheel-root, .wheel-picker, .wheel-picker-shell") &&
      this.isInWheelDragZone(ev.clientX, ev.clientY, ev.pointerType)
    ) {
      return;
    }

    if (ev.pointerType === "touch") ev.preventDefault();
    this.armPointer(ev, ev.currentTarget as HTMLElement, false, false, null);
  };

  /** 鼠标仅中央高亮带交给轮盘；触摸整块滚轮区域交给轮盘 */
  private isInWheelDragZone(clientX: number, clientY: number, pointerType: string): boolean {
    const viewports = this.container?.querySelectorAll<HTMLElement>(".wheel-viewport");
    if (!viewports?.length) return false;

    for (const viewport of viewports) {
      const rect = viewport.getBoundingClientRect();
      const inViewport =
        clientX >= rect.left &&
        clientX <= rect.right &&
        clientY >= rect.top &&
        clientY <= rect.bottom;
      if (!inViewport) continue;

      if (pointerType === "touch") return true;

      const band = viewport.querySelector<HTMLElement>(".wheel-highlight");
      if (!band) return true;
      const bandRect = band.getBoundingClientRect();
      if (
        clientX >= bandRect.left &&
        clientX <= bandRect.right &&
        clientY >= bandRect.top &&
        clientY <= bandRect.bottom
      ) {
        return true;
      }
    }
    return false;
  }

  private onPresetGripDown = (e: Event) => {
    if (this.stage === "closed") return;
    const ev = e as PointerEvent;
    ev.preventDefault();
    this.armPointer(ev, ev.currentTarget as HTMLElement, false, true, null);
  };

  private onPresetBodyDown = (e: Event) => {
    if (this.stage === "closed") return;
    const ev = e as PointerEvent;
    const cell =
      ev.target instanceof HTMLElement
        ? (ev.target.closest(".preset-cell") as HTMLElement | null)
        : null;

    this.armPointer(ev, (cell ?? ev.currentTarget) as HTMLElement, false, false, cell);
  };

  private armPointer(
    e: PointerEvent,
    el: HTMLElement,
    tapToggle: boolean,
    fromPresetGrip: boolean,
    presetCell: HTMLElement | null
  ) {
    this.pointerTracking = true;
    this.dragging = false;
    this.dragFromPresetGrip = fromPresetGrip;
    this.pendingPresetCell = presetCell;
    this.tapToggle = tapToggle;
    this.captureEl = el;
    this.startX = e.clientX;
    this.startY = e.clientY;
    this.pointerId = e.pointerId;
    this.dragStartedStage = this.stage;
    this.moved = false;
  }

  private activateDrag(e: PointerEvent) {
    this.measure();
    this.pointerTracking = false;
    this.dragging = true;
    this.captureEl?.setPointerCapture(this.pointerId);
    this.container?.classList.add("dragging");
    e.preventDefault();
  }

  private basePull(): number {
    if (this.stage === "full") return this.stage2;
    if (this.stage === "wheel") return this.stage1;
    return 0;
  }

  private onMove = (e: PointerEvent) => {
    if (this.pointerTracking && !this.dragging && e.pointerId === this.pointerId) {
      const dx = e.clientX - this.startX;
      const dy = e.clientY - this.startY;

      if (this.tapToggle || this.dragFromPresetGrip) {
        if (Math.abs(dy) < 2 && Math.abs(dx) < 2) return;
        if (Math.abs(dx) > Math.abs(dy) * 1.2) {
          this.pointerTracking = false;
          this.pendingPresetCell = null;
          this.dragFromPresetGrip = false;
          return;
        }
        this.activateDrag(e);
      } else {
        const axis = lockAxis(dx, dy);
        if (!axis) return;
        if (axis === "x") {
          this.pointerTracking = false;
          this.pendingPresetCell = null;
          this.dragFromPresetGrip = false;
          return;
        }
        this.activateDrag(e);
      }
    }

    if (!this.dragging || e.pointerId !== this.pointerId) return;
    e.preventDefault();
    const delta = e.clientY - this.startY;
    if (Math.abs(delta) > MOVE_THRESHOLD) this.moved = true;
    this.pull = Math.max(0, Math.min(this.stage2, this.basePull() + delta));
    this.applyPull(this.pull, false);
  };

  private onUp = (e: PointerEvent) => {
    if (this.pointerTracking && e.pointerId === this.pointerId) {
      const dx = e.clientX - this.startX;
      const dy = e.clientY - this.startY;
      this.pointerTracking = false;

      if (Math.abs(dx) < MOVE_THRESHOLD && Math.abs(dy) < MOVE_THRESHOLD) {
        if (this.pendingPresetCell) {
          this.onPresetTap?.(this.pendingPresetCell);
        } else if (this.tapToggle) {
          const next: TimeStage =
            this.stage === "closed" ? "wheel" : this.stage === "wheel" ? "closed" : "wheel";
          this.applyStage(next, true);
        } else if (this.dragFromPresetGrip) {
          this.applyStage(this.stage === "full" ? "wheel" : "full", true);
        }
      }

      this.pendingPresetCell = null;
      this.dragFromPresetGrip = false;
      this.captureEl = null;
      return;
    }

    if (!this.dragging || e.pointerId !== this.pointerId) return;
    this.dragging = false;
    this.container?.classList.remove("dragging");
    this.captureEl?.releasePointerCapture(e.pointerId);
    this.captureEl = null;

    if (this.moved) {
      this.applyStage(this.snapStage(this.pull, this.dragStartedStage), true);
    } else if (this.pendingPresetCell) {
      this.onPresetTap?.(this.pendingPresetCell);
    } else if (this.tapToggle) {
      const next: TimeStage =
        this.stage === "closed" ? "wheel" : this.stage === "wheel" ? "closed" : "wheel";
      this.applyStage(next, true);
    } else if (this.dragFromPresetGrip) {
      this.applyStage(this.stage === "full" ? "wheel" : "full", true);
    }
    this.pendingPresetCell = null;
    this.dragFromPresetGrip = false;
  };

  private snapStage(pull: number, from: TimeStage): TimeStage {
    const presetTravel = this.stage2 - this.stage1;
    const presetMid = this.stage1 + presetTravel * 0.4;

    if (from === "closed") {
      if (pull < OPEN_SNAP) return "closed";
      if (presetTravel < 8 || pull < presetMid) return "wheel";
      return "full";
    }
    if (from === "wheel") {
      if (pull < this.stage1 - CLOSE_PUSH) return "closed";
      if (presetTravel < 8 || pull < this.stage1 + OPEN_SNAP) return "wheel";
      return "full";
    }
    if (pull < this.stage2 - CLOSE_PUSH) return "wheel";
    return "full";
  }

  private applyStage(stage: TimeStage, animate: boolean) {
    this.measure();
    this.stage = stage;
    this.pull = stage === "closed" ? 0 : stage === "wheel" ? this.stage1 : this.stage2;
    this.applyPull(this.pull, animate);
    this.onChange?.(stage);
  }

  private applyPull(pull: number, animate: boolean) {
    if (!this.panel || !this.container) return;

    this.panel.style.height = `${pull}px`;
    this.container.classList.toggle("animating", animate);
    this.container.classList.toggle("open", pull > OPEN_SNAP);
    this.container.classList.toggle("preset-open", pull > this.stage1 + 8);

    const presetBody = this.container.querySelector<HTMLElement>(".scroll-preset-body");
    if (presetBody) {
      const presetPull = Math.max(0, pull - this.stage1);
      presetBody.style.height = `${presetPull}px`;
    }

    const outerChevron = this.container.querySelector<HTMLElement>(":scope > .scroll-grip .scroll-chevron");
    const innerChevron = this.container.querySelector<HTMLElement>(".scroll-preset-grip .scroll-chevron");
    const wheelOpen = pull > OPEN_SNAP;
    const presetOpen = pull > this.stage1 + 8;

    if (outerChevron) outerChevron.style.transform = wheelOpen ? "rotate(180deg)" : "rotate(0deg)";
    if (innerChevron) innerChevron.style.transform = presetOpen ? "rotate(180deg)" : "rotate(0deg)";

    if (this.outerHint) {
      this.outerHint.textContent = wheelOpen ? "上推收起" : "下拉，记录耗时";
    }
    if (this.innerHint) {
      this.innerHint.textContent = presetOpen ? "上推收起" : "下拉，常用时间";
    }
  }
}
