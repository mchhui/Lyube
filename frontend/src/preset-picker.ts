import type { WheelPicker } from "./wheel-picker";

const HOUR_PRESETS = [1, 2, 8];
const MINUTE_PRESETS = [15, 30, 45];

export class PresetPicker {
  private wheel: WheelPicker | null = null;

  mount(wrap: HTMLElement, wheel: WheelPicker) {
    this.wheel = wheel;

    const rows = HOUR_PRESETS.map((h, i) => {
      const m = MINUTE_PRESETS[i];
      return `
        <button type="button" class="preset-cell" data-type="hour" data-value="${h}">${h}小时</button>
        <button type="button" class="preset-cell" data-type="minute" data-value="${m}">${m}分钟</button>
      `;
    }).join("");

    wrap.innerHTML = `<div class="preset-grid">${rows}</div>`;
  }

  applyCell(btn: HTMLElement) {
    if (!this.wheel) return;
    const type = btn.dataset.type;
    const value = Number(btn.dataset.value);
    if (type === "hour") this.wheel.setHours(value);
    else if (type === "minute") this.wheel.setMinutes(value);
  }
}
