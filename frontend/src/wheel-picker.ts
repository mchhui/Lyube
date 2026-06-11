import { lockAxis } from "./gesture-axis";

const ITEM_H = 44;
const PAD = 2;
const HOUR_CHUNK = 50;
const MAX_HOUR = 9999;
const WHEEL_STEP_THRESHOLD = 40;

type ChangeHandler = (hours: number, minutes: number) => void;
type EditKind = "hour" | "minute";

export class WheelPicker {
  private hours = 0;
  private minutes = 30;
  private hourCount = 100;
  private hourEl: HTMLElement | null = null;
  private minuteEl: HTMLElement | null = null;
  private onChange: ChangeHandler | null = null;
  private activeInput: HTMLInputElement | null = null;

  mount(wrap: HTMLElement, onChange?: ChangeHandler) {
    this.onChange = onChange ?? null;
    wrap.innerHTML = `
      <div class="wheel-picker-shell">
        <div class="wheel-picker">
          <div class="wheel-col" data-kind="hour">
            <div class="wheel-label">时</div>
            <div class="wheel-viewport">
              <div class="wheel-highlight" title="双击输入"></div>
              <div class="wheel-scroll" data-wheel="hour"></div>
            </div>
          </div>
          <div class="wheel-col" data-kind="minute">
            <div class="wheel-label">分</div>
            <div class="wheel-viewport">
              <div class="wheel-highlight" title="双击输入"></div>
              <div class="wheel-scroll" data-wheel="minute"></div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.hourEl = wrap.querySelector('[data-wheel="hour"]');
    this.minuteEl = wrap.querySelector('[data-wheel="minute"]');

    this.fillColumn(this.hourEl!, this.hourCount, (i) => String(i));
    this.fillColumn(this.minuteEl!, 60, (i) => String(i).padStart(2, "0"));

    this.bindScroll(
      this.hourEl!,
      () => this.hourCount,
      () => this.hours,
      (v) => {
        this.hours = v;
        this.maybeExtendHours(v);
        this.emitChange();
      }
    );
    this.bindScroll(
      this.minuteEl!,
      () => 60,
      () => this.minutes,
      (v) => {
        this.minutes = v;
        this.emitChange();
      }
    );

    this.bindDirectEdit(wrap);

    requestAnimationFrame(() => {
      this.scrollToIndex(this.hourEl!, this.hours);
      this.scrollToIndex(this.minuteEl!, this.minutes);
    });
  }

  getValues() {
    return { hours: this.hours, minutes: this.minutes };
  }

  getDurationSeconds(): number {
    return this.hours * 3600 + this.minutes * 60;
  }

  setHours(value: number) {
    this.hours = Math.max(0, value);
    this.ensureHourCapacity(this.hours);
    if (this.hourEl) this.scrollToIndex(this.hourEl, this.hours);
    this.emitChange();
  }

  setMinutes(value: number) {
    this.minutes = Math.max(0, Math.min(59, value));
    if (this.minuteEl) this.scrollToIndex(this.minuteEl, this.minutes);
    this.emitChange();
  }

  private emitChange() {
    this.onChange?.(this.hours, this.minutes);
  }

  private bindDirectEdit(wrap: HTMLElement) {
    wrap.querySelectorAll<HTMLElement>(".wheel-viewport").forEach((viewport) => {
      viewport.addEventListener("dblclick", (e) => {
        if (!this.isCenterHit(viewport, e.clientY)) return;
        const kind = viewport.closest<HTMLElement>(".wheel-col")?.dataset.kind as EditKind;
        if (kind === "hour" || kind === "minute") this.openEditor(kind, viewport);
      });
    });
  }

  private isCenterHit(viewport: HTMLElement, clientY: number): boolean {
    const highlight = viewport.querySelector<HTMLElement>(".wheel-highlight");
    if (highlight) {
      const rect = highlight.getBoundingClientRect();
      return clientY >= rect.top && clientY <= rect.bottom;
    }
    const rect = viewport.getBoundingClientRect();
    const center = rect.top + rect.height / 2;
    return Math.abs(clientY - center) <= ITEM_H / 2;
  }

  private isScrollDragZone(el: HTMLElement, clientX: number, clientY: number): boolean {
    const viewport = el.closest<HTMLElement>(".wheel-viewport");
    if (!viewport) return false;
    const highlight = viewport.querySelector<HTMLElement>(".wheel-highlight");
    if (!highlight) return this.isCenterHit(viewport, clientY);
    const rect = highlight.getBoundingClientRect();
    return (
      clientX >= rect.left &&
      clientX <= rect.right &&
      clientY >= rect.top &&
      clientY <= rect.bottom
    );
  }

  private openEditor(kind: EditKind, viewport: HTMLElement) {
    this.closeEditor(false);

    const highlight = viewport.querySelector<HTMLElement>(".wheel-highlight");
    if (!highlight) return;

    viewport.classList.add("editing");
    const input = document.createElement("input");
    input.className = "wheel-input-overlay";
    input.type = "text";
    input.inputMode = "numeric";
    input.autocomplete = "off";
    input.value = kind === "hour" ? String(this.hours) : String(this.minutes);
    input.setAttribute("aria-label", kind === "hour" ? "输入小时" : "输入分钟");

    highlight.appendChild(input);
    this.activeInput = input;
    input.focus();
    input.select();

    const commit = () => this.commitEditor(kind, input);
    input.addEventListener("blur", commit);
    input.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        commit();
      }
      if (ev.key === "Escape") {
        ev.preventDefault();
        this.closeEditor(false);
      }
    });
  }

  private parseHour(raw: string): number | null {
    const s = raw.trim();
    if (!/^\d+$/.test(s)) return null;
    const n = Number(s);
    if (!Number.isInteger(n) || n < 0 || n > MAX_HOUR) return null;
    return n;
  }

  private parseMinute(raw: string): number | null {
    const s = raw.trim();
    if (!/^\d+$/.test(s)) return null;
    const n = Number(s);
    if (!Number.isInteger(n) || n < 0 || n > 59) return null;
    return n;
  }

  private commitEditor(kind: EditKind, input: HTMLInputElement) {
    if (this.activeInput !== input) return;

    const parsed = kind === "hour" ? this.parseHour(input.value) : this.parseMinute(input.value);
    if (parsed === null) {
      this.closeEditor(false);
      return;
    }

    if (kind === "hour") this.setHours(parsed);
    else this.setMinutes(parsed);

    this.closeEditor(true);
  }

  private closeEditor(committed: boolean) {
    if (this.activeInput) {
      const viewport = this.activeInput.closest(".wheel-viewport");
      this.activeInput.remove();
      this.activeInput = null;
      viewport?.classList.remove("editing");
      if (!committed) {
        /* keep current wheel value */
      }
    }
  }

  private ensureHourCapacity(index: number) {
    if (!this.hourEl) return;
    while (index >= this.hourCount - 8) {
      this.maybeExtendHours(index);
    }
  }

  private maybeExtendHours(currentIndex: number) {
    if (!this.hourEl || currentIndex < this.hourCount - 8) return;

    const scrollBefore = this.hourEl.scrollTop;
    const oldCount = this.hourCount;
    this.hourCount += HOUR_CHUNK;

    for (let p = 0; p < PAD; p++) {
      const pads = this.hourEl.querySelectorAll(".wheel-pad");
      pads[pads.length - 1]?.remove();
    }

    for (let i = oldCount; i < this.hourCount; i++) {
      const el = document.createElement("div");
      el.className = "wheel-item";
      el.dataset.value = String(i);
      el.textContent = String(i);
      this.hourEl.appendChild(el);
    }
    for (let p = 0; p < PAD; p++) {
      const el = document.createElement("div");
      el.className = "wheel-item wheel-pad";
      this.hourEl.appendChild(el);
    }

    this.hourEl.scrollTop = scrollBefore;
  }

  private fillColumn(el: HTMLElement, count: number, label: (i: number) => string) {
    const parts: string[] = [];
    for (let p = 0; p < PAD; p++) parts.push(`<div class="wheel-item wheel-pad"></div>`);
    for (let i = 0; i < count; i++) {
      parts.push(`<div class="wheel-item" data-value="${i}">${label(i)}</div>`);
    }
    for (let p = 0; p < PAD; p++) parts.push(`<div class="wheel-item wheel-pad"></div>`);
    el.innerHTML = parts.join("");
  }

  private scrollToIndex(el: HTMLElement, index: number) {
    el.scrollTop = index * ITEM_H;
  }

  private bindScroll(
    el: HTMLElement,
    getCount: () => number,
    getIndex: () => number,
    setIndex: (v: number) => void
  ) {
    let wheelAccum = 0;
    let dragging = false;

    const applyIndex = (index: number) => {
      const clamped = Math.max(0, Math.min(getCount() - 1, index));
      if (clamped === getIndex() && Math.abs(el.scrollTop - clamped * ITEM_H) < 1) return;

      setIndex(clamped);
      this.scrollToIndex(el, clamped);
    };

    const snapToNearest = () => {
      const index = Math.round(el.scrollTop / ITEM_H);
      applyIndex(index);
    };

    el.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        e.stopPropagation();

        wheelAccum += e.deltaY;
        if (Math.abs(wheelAccum) < WHEEL_STEP_THRESHOLD) return;

        const steps = Math.trunc(wheelAccum / WHEEL_STEP_THRESHOLD);
        wheelAccum -= steps * WHEEL_STEP_THRESHOLD;
        applyIndex(getIndex() + steps);
      },
      { passive: false }
    );

    el.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      if ((e.target as HTMLElement).closest(".wheel-input-overlay")) return;
      if (!this.isScrollDragZone(el, e.clientX, e.clientY)) return;

      wheelAccum = 0;
      let tracking = true;
      let active = false;
      const originX = e.clientX;
      const originY = e.clientY;
      let dragStartY = originY;
      let dragStartScroll = el.scrollTop;

      const cleanup = () => {
        tracking = false;
        active = false;
        dragging = false;
        window.removeEventListener("pointermove", onPtrMove);
        window.removeEventListener("pointerup", endDrag);
        window.removeEventListener("pointercancel", endDrag);
      };

      const onPtrMove = (ev: PointerEvent) => {
        if (!tracking || ev.pointerId !== e.pointerId) return;

        if (!active) {
          const axis = lockAxis(ev.clientX - originX, ev.clientY - originY);
          if (!axis) return;
          if (axis === "x") {
            cleanup();
            return;
          }
          active = true;
          dragging = true;
          dragStartY = ev.clientY;
          dragStartScroll = el.scrollTop;
          el.setPointerCapture(e.pointerId);
        }

        el.scrollTop = dragStartScroll - (ev.clientY - dragStartY);
      };

      const endDrag = (ev: PointerEvent) => {
        if (ev.pointerId !== e.pointerId) return;
        if (active) {
          try {
            el.releasePointerCapture(e.pointerId);
          } catch {
            /* noop */
          }
          snapToNearest();
        }
        cleanup();
      };

      window.addEventListener("pointermove", onPtrMove);
      window.addEventListener("pointerup", endDrag);
      window.addEventListener("pointercancel", endDrag);
    });

    el.addEventListener(
      "scroll",
      () => {
        if (dragging) return;
        snapToNearest();
      },
      { passive: true }
    );

    el.addEventListener("click", (e) => {
      const item = (e.target as HTMLElement).closest(
        ".wheel-item[data-value]"
      ) as HTMLElement | null;
      if (!item) return;
      wheelAccum = 0;
      applyIndex(Number(item.dataset.value));
    });
  }
}
