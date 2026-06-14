import { lockAxis } from "./gesture-axis";

const FLIP_THRESHOLD = 128;
const DRAG_DEG_PER_PX = 0.42;

export class FlipCard {
  private card: HTMLElement | null = null;
  private inner: HTMLElement | null = null;
  private flipped = false;
  private currentAngle = 0;
  private dragStartAngle = 0;
  private tracking = false;
  private active = false;
  private startX = 0;
  private startY = 0;
  private pointerId = -1;
  private resizeObserver: ResizeObserver | null = null;
  private onChange: ((flipped: boolean) => void) | null = null;

  mount(
    host: HTMLElement,
    flipped: boolean,
    onChange?: (flipped: boolean) => void
  ) {
    this.card = host.querySelector(".flip-card");
    this.inner = host.querySelector(".flip-card-inner");
    this.onChange = onChange ?? null;
    this.flipped = flipped;
    this.currentAngle = flipped ? 180 : 0;
    this.syncRestingTransform(false);
    this.setupHeightObserver();

    this.inner?.addEventListener("pointerdown", this.onDown);
    window.addEventListener("pointermove", this.onMove);
    window.addEventListener("pointerup", this.onUp);
    window.addEventListener("pointercancel", this.onUp);
  }

  isFlipped() {
    return this.flipped;
  }

  setFlipped(flipped: boolean, animate = true) {
    this.flipped = flipped;
    this.card?.classList.toggle("flipped", flipped);
    this.onChange?.(flipped);
    this.currentAngle = flipped ? 180 : 0;
    this.syncRestingTransform(animate);
  }

  destroy() {
    this.inner?.removeEventListener("pointerdown", this.onDown);
    window.removeEventListener("pointermove", this.onMove);
    window.removeEventListener("pointerup", this.onUp);
    window.removeEventListener("pointercancel", this.onUp);
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.resetGesture();
    this.card = null;
    this.inner = null;
  }

  private setupHeightObserver() {
    if (!this.inner) return;
    const front = this.inner.querySelector<HTMLElement>(".flip-card-front");
    const back = this.inner.querySelector<HTMLElement>(".flip-card-back");
    if (!front || !back) return;

    this.resizeObserver?.disconnect();
    this.resizeObserver = new ResizeObserver(() => this.syncFaceHeight());
    this.resizeObserver.observe(front);
    this.resizeObserver.observe(back);
    requestAnimationFrame(() => this.syncFaceHeight());
  }

  private syncFaceHeight() {
    if (!this.inner) return;
    const front = this.inner.querySelector<HTMLElement>(".flip-card-front");
    const back = this.inner.querySelector<HTMLElement>(".flip-card-back");
    if (!front || !back) return;

    const nextHeight = Math.ceil(
      Math.max(front.offsetHeight, back.scrollHeight, back.offsetHeight)
    );
    this.inner.style.minHeight = `${nextHeight}px`;
  }

  private pointerAngle(dx: number): number {
    const delta = Math.max(-120, Math.min(120, dx * DRAG_DEG_PER_PX));
    return this.dragStartAngle + delta;
  }

  private restingAngle(): number {
    return this.currentAngle;
  }

  private shouldCommitFlip(dx: number): boolean {
    if (!this.active) return false;
    return Math.abs(dx) >= FLIP_THRESHOLD;
  }

  private directionalTarget(base: number, fromAngle: number, dx: number): number {
    let target = base;
    if (dx >= 0) {
      while (target <= fromAngle) target += 360;
    } else {
      while (target >= fromAngle) target -= 360;
    }
    return target;
  }

  private syncRestingTransform(animate: boolean) {
    if (!this.card || !this.inner) return;
    this.card.classList.toggle("animating", animate);
    if (animate) {
      this.animateTo(this.restingAngle());
      return;
    }
    this.inner.style.transition = "none";
    this.inner.style.transform = `rotateY(${this.currentAngle}deg)`;
    requestAnimationFrame(() => {
      if (this.inner) this.inner.style.transition = "";
    });
  }

  private animateTo(deg: number, finalAngle = deg) {
    if (!this.inner || !this.card) return;

    let target = deg;
    let from = this.readRenderedAngle();

    // Avoid 360/-360 endpoints: browsers may normalize them to 0 during
    // interpolation, which creates a surprising full-spin path.
    if (target >= 360) {
      from -= 360;
      target -= 360;
      this.rebaseRenderedAngle(from);
    } else if (target <= -360) {
      from += 360;
      target += 360;
      this.rebaseRenderedAngle(from);
    }

    this.card.classList.add("animating");
    this.inner.style.transition = "transform 0.48s cubic-bezier(0.4, 0.2, 0.2, 1)";
    this.inner.style.transform = `rotateY(${target}deg)`;

    const onEnd = (ev: TransitionEvent) => {
      if (ev.propertyName !== "transform") return;
      this.inner?.removeEventListener("transitionend", onEnd);
      if (!this.inner || !this.card) return;

      this.inner.style.transition = "";
      this.currentAngle = finalAngle;
      this.inner.style.transform = `rotateY(${this.currentAngle}deg)`;
      this.card.classList.remove("animating");
    };
    this.inner.addEventListener("transitionend", onEnd);
  }

  private readRenderedAngle(): number {
    if (!this.inner) return this.currentAngle;
    const match = this.inner.style.transform.match(/rotateY\((-?\d+(?:\.\d+)?)deg\)/);
    return match ? Number(match[1]) : this.currentAngle;
  }

  private rebaseRenderedAngle(angle: number) {
    if (!this.inner) return;
    this.inner.style.transition = "none";
    this.inner.style.transform = `rotateY(${angle}deg)`;
    this.inner.offsetWidth;
  }

  private isFlipExcluded(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return true;
    return !!target.closest(
      "button, .wheel-input-overlay, .scroll-reveal, .wheel-picker, .wheel-picker-shell, .preset-cell"
    );
  }

  private resetGesture() {
    const pid = this.pointerId;
    this.tracking = false;
    this.active = false;
    this.pointerId = -1;
    this.card?.classList.remove("dragging");
    if (this.inner && pid >= 0) {
      try {
        this.inner.releasePointerCapture(pid);
      } catch {
        /* already released */
      }
    }
  }

  private onDown = (e: PointerEvent) => {
    if (e.button !== 0 || this.isFlipExcluded(e.target)) return;

    this.tracking = true;
    this.active = false;
    this.startX = e.clientX;
    this.startY = e.clientY;
    this.dragStartAngle = this.currentAngle;
    this.pointerId = e.pointerId;
    this.card?.classList.remove("animating");
    if (this.inner) {
      this.inner.style.transition = "none";
    }
  };

  private onMove = (e: PointerEvent) => {
    if (!this.tracking || e.pointerId !== this.pointerId || !this.inner) return;

    const dx = e.clientX - this.startX;
    const dy = e.clientY - this.startY;

    if (!this.active) {
      const axis = lockAxis(dx, dy);
      if (!axis) return;
      if (axis === "y") {
        this.tracking = false;
        return;
      }
      this.active = true;
      this.inner.setPointerCapture(e.pointerId);
    }

    e.preventDefault();
    this.card?.classList.add("dragging");

    const angle = this.pointerAngle(dx);
    this.inner.style.transition = "none";
    this.inner.style.transform = `rotateY(${angle}deg)`;
  };

  private onUp = (e: PointerEvent) => {
    if (!this.tracking && !this.active) return;
    if (e.pointerId !== this.pointerId) return;

    const dx = e.clientX - this.startX;
    const commit = this.shouldCommitFlip(dx);

    if (this.inner && this.active) {
      try {
        this.inner.releasePointerCapture(this.pointerId);
      } catch {
        /* noop */
      }
    }

    this.card?.classList.remove("dragging");
    this.tracking = false;
    this.active = false;
    this.pointerId = -1;

    if (!this.inner) return;

    if (commit) {
      const next = !this.flipped;
      const finalAngle = next ? (dx >= 0 ? 180 : -180) : 0;
      const target = this.directionalTarget(finalAngle, this.pointerAngle(dx), dx);

      this.flipped = next;
      this.card?.classList.toggle("flipped", next);
      this.onChange?.(next);
      this.animateTo(target, finalAngle);
      return;
    }

    this.animateTo(this.restingAngle());
  };
}
