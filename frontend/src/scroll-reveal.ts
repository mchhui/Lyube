const MOVE_THRESHOLD = 8;

export interface ScrollRevealOptions {
  openHeight: number;
  openSnap?: number;
  closePush?: number;
  hintClosed: string;
  hintOpen?: string;
}

export class ScrollReveal {
  private opts: Required<ScrollRevealOptions>;
  private open = false;
  private dragging = false;
  private dragStartedOpen = false;
  private moved = false;
  private tapToggle = false;
  private startY = 0;
  private pull = 0;
  private pointerId = -1;
  private captureEl: HTMLElement | null = null;
  private container: HTMLElement | null = null;
  private panel: HTMLElement | null = null;
  private paper: HTMLElement | null = null;
  private hint: HTMLElement | null = null;
  private onChange: ((open: boolean) => void) | null = null;

  constructor(options: ScrollRevealOptions) {
    this.opts = {
      openSnap: 96,
      closePush: 96,
      hintOpen: "上推收起",
      ...options,
    };
  }

  mount(container: HTMLElement, onChange: (open: boolean) => void) {
    this.container = container;
    this.onChange = onChange;
    this.panel = container.querySelector(".scroll-panel");
    this.paper = container.querySelector(".scroll-paper");
    this.hint = container.querySelector(".scroll-hint");

    container.querySelector<HTMLElement>(".scroll-grip")?.addEventListener("pointerdown", this.onGripDown);
    this.paper?.addEventListener("pointerdown", this.onPaperDown, true);

    window.addEventListener("pointermove", this.onMove);
    window.addEventListener("pointerup", this.onUp);
    window.addEventListener("pointercancel", this.onUp);
  }

  isOpen() {
    return this.open;
  }

  setOpen(value: boolean, animate = true) {
    this.open = value;
    this.pull = value ? this.opts.openHeight : 0;
    this.apply(animate);
    this.onChange?.(value);
  }

  resizeOpen(height: number, animate = true) {
    this.opts.openHeight = height;
    if (!this.open) return;
    this.pull = height;
    this.apply(animate);
  }

  destroy() {
    if (!this.container) return;
    this.container.querySelector<HTMLElement>(".scroll-grip")?.removeEventListener("pointerdown", this.onGripDown);
    this.paper?.removeEventListener("pointerdown", this.onPaperDown, true);
    window.removeEventListener("pointermove", this.onMove);
    window.removeEventListener("pointerup", this.onUp);
    window.removeEventListener("pointercancel", this.onUp);
  }

  private get closeSnap() {
    return this.opts.openHeight - this.opts.closePush;
  }

  private onGripDown = (e: Event) => {
    const ev = e as PointerEvent;
    this.beginDrag(ev, ev.currentTarget as HTMLElement, true);
  };

  private onPaperDown = (e: Event) => {
    if (!this.open || !this.paper) return;
    const ev = e as PointerEvent;
    const target = ev.target as HTMLElement;
    if (target.closest(".preset-cell")) return;
    if (this.isInSelectBand(ev.clientX, ev.clientY)) return;

    ev.preventDefault();
    ev.stopPropagation();
    this.beginDrag(ev, this.paper, false);
  };

  private isInSelectBand(clientX: number, clientY: number): boolean {
    const bands = this.container?.querySelectorAll<HTMLElement>(".wheel-highlight");
    if (!bands?.length) return false;
    for (const band of bands) {
      const rect = band.getBoundingClientRect();
      if (
        clientX >= rect.left &&
        clientX <= rect.right &&
        clientY >= rect.top &&
        clientY <= rect.bottom
      ) {
        return true;
      }
    }
    return false;
  }

  private shouldStayOpen(pull: number): boolean {
    return this.dragStartedOpen ? pull > this.closeSnap : pull > this.opts.openSnap;
  }

  private beginDrag(e: PointerEvent, el: HTMLElement, tapToggle: boolean) {
    this.dragging = true;
    this.dragStartedOpen = this.open;
    this.moved = false;
    this.tapToggle = tapToggle;
    this.startY = e.clientY;
    this.pointerId = e.pointerId;
    this.captureEl = el;
    el.setPointerCapture(e.pointerId);
    this.container?.classList.add("dragging");
  }

  private onMove = (e: PointerEvent) => {
    if (!this.dragging || e.pointerId !== this.pointerId) return;
    const delta = e.clientY - this.startY;
    if (Math.abs(delta) > MOVE_THRESHOLD) this.moved = true;

    const base = this.open ? this.opts.openHeight : 0;
    this.pull = Math.max(0, Math.min(this.opts.openHeight, base + delta));
    this.apply(false);
  };

  private onUp = (e: PointerEvent) => {
    if (!this.dragging || e.pointerId !== this.pointerId) return;
    this.dragging = false;
    this.container?.classList.remove("dragging");
    this.captureEl?.releasePointerCapture(e.pointerId);
    this.captureEl = null;

    if (this.moved) {
      this.setOpen(this.shouldStayOpen(this.pull));
    } else if (this.tapToggle) {
      this.setOpen(!this.open);
    }
  };

  private apply(animate: boolean) {
    if (!this.panel || !this.container || !this.hint) return;
    this.panel.style.height = `${this.pull}px`;
    const stayOpen = this.dragging ? this.shouldStayOpen(this.pull) : this.open;
    this.container.classList.toggle("open", stayOpen);
    this.container.classList.toggle("animating", animate);

    const chevron = this.container.querySelector(".scroll-chevron");
    if (chevron) {
      (chevron as HTMLElement).style.transform = stayOpen ? "rotate(180deg)" : "rotate(0deg)";
    }

    this.hint.textContent = stayOpen ? this.opts.hintOpen : this.opts.hintClosed;
  }
}
