import "./style.css";
import { api, type Entry } from "./api";
import { formatDate, formatDuration, shiftDate, todayStr } from "./utils";
import { WheelPicker } from "./wheel-picker";
import { PresetPicker } from "./preset-picker";
import { CascadedTimePanel, type TimeStage } from "./cascaded-time-panel";
import { FlipCard } from "./flip-card";

interface State {
  entries: Entry[];
  selectedDate: string;
  timeStage: TimeStage;
  cardFlipped: boolean;
  draftTask: string;
  draftNotes: string;
}

const state: State = {
  entries: [],
  selectedDate: todayStr(),
  timeStage: "closed",
  cardFlipped: false,
  draftTask: "",
  draftNotes: "",
};

let wheel: WheelPicker | null = null;
let presetPicker: PresetPicker | null = null;
let timePanel: CascadedTimePanel | null = null;
let flipCard: FlipCard | null = null;

function showToast(message: string, isError = false) {
  document.querySelector(".toast")?.remove();
  const toast = document.createElement("div");
  toast.className = `toast${isError ? " error" : ""}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("show"));
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 2800);
}

function escapeHtml(s: string): string {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

function totalSeconds(entries: Entry[]): number {
  return entries.reduce((sum, e) => sum + (e.duration_seconds ?? 0), 0);
}

function captureFormDrafts() {
  const task = document.getElementById("task-name") as HTMLInputElement | null;
  const notes = document.getElementById("task-notes") as HTMLTextAreaElement | null;
  if (task) state.draftTask = task.value;
  if (notes) state.draftNotes = notes.value;
}

function renderFormSection(): string {
  const wheelOpen = state.timeStage !== "closed";
  const presetOpen = state.timeStage === "full";
  return `
    <section class="flip-card-host" id="record-flip-host">
      <div class="flip-card ${state.cardFlipped ? "flipped" : ""}" id="record-flip">
        <div class="flip-card-inner">
          <div class="flip-card-face flip-card-front card record-card">
            <form id="record-form">
              <div class="form-group">
                <label for="task-name">事情</label>
                <input type="text" id="task-name" placeholder="做了什么？" required autocomplete="off" />
              </div>

              <div class="scroll-reveal cascaded-time ${wheelOpen ? "open" : ""} ${presetOpen ? "preset-open" : ""}" id="scroll-time">
                <div class="scroll-grip" role="button" aria-label="下拉记录耗时">
                  <span class="scroll-hint">${wheelOpen ? "上推收起" : "下拉，记录耗时"}</span>
                  <div class="scroll-chevron" aria-hidden="true">⌄</div>
                </div>
                <div class="scroll-panel">
                  <div class="scroll-paper scroll-paper-wheel">
                    <div class="wheel-section-label">设定时间</div>
                    <div id="wheel-root"></div>
                  </div>

                  <div class="scroll-preset-grip" role="button" aria-label="下拉常用时间">
                    <span class="scroll-hint">${presetOpen ? "上推收起" : "下拉，常用时间"}</span>
                    <div class="scroll-chevron" aria-hidden="true">⌄</div>
                  </div>

                  <div class="scroll-preset-body">
                    <div class="scroll-paper scroll-paper-preset">
                      <div class="wheel-section-label">常用时间</div>
                      <div id="preset-root"></div>
                    </div>
                  </div>
                </div>
              </div>

              <p class="flip-card-hint">向右滑动可写下想法</p>
              <button type="submit" class="btn btn-primary">记下</button>
            </form>
          </div>

          <div class="flip-card-face flip-card-back card record-card-back">
            <div class="form-group form-group-grow">
              <label for="task-notes">想法</label>
              <textarea id="task-notes" placeholder="可选：关于这件事的感想、收获、备忘…" rows="10"></textarea>
            </div>
            <p class="flip-card-hint">向左滑动翻回正面</p>
          </div>
        </div>
      </div>
    </section>
  `;
}

function renderEntriesSection(): string {
  const total = totalSeconds(state.entries);
  const dateLabel =
    state.selectedDate === todayStr() ? "今天" : formatDate(state.selectedDate);

  const items =
    state.entries.length === 0
      ? `<div class="empty-state">这一天还没有记录</div>`
      : `<ul class="entry-list">${state.entries
          .map(
            (e) => `
            <li class="entry-item">
              <div class="entry-body">
                <div class="entry-name">${escapeHtml(e.task_name)}</div>
                ${
                  e.duration_seconds != null
                    ? `<div class="entry-duration">${formatDuration(e.duration_seconds)}</div>`
                    : ""
                }
                ${
                  e.notes
                    ? `<div class="entry-notes">${escapeHtml(e.notes)}</div>`
                    : ""
                }
              </div>
              <button class="btn btn-danger btn-delete" data-id="${e.id}">删除</button>
            </li>
          `
          )
          .join("")}</ul>`;

  return `
    <section class="card">
      <div class="date-nav">
        <button type="button" id="btn-prev" aria-label="前一天">‹</button>
        <span class="current-date">${dateLabel}</span>
        <button type="button" id="btn-next" aria-label="后一天" ${state.selectedDate >= todayStr() ? "disabled" : ""}>›</button>
      </div>
      ${
        state.entries.length > 0
          ? `<div class="summary-bar"><span>合计</span><strong>${formatDuration(total)}</strong></div>`
          : ""
      }
      ${items}
    </section>
  `;
}

function render(options: { preserveDrafts?: boolean } = {}) {
  if (options.preserveDrafts !== false) {
    captureFormDrafts();
  }
  timePanel?.destroy();
  flipCard?.destroy();
  const app = document.getElementById("app");
  if (!app) return;

  app.innerHTML = `
    <header class="header">
      <h1>Lyube</h1>
      <p class="tagline">记下事情，感知时间</p>
    </header>
    ${renderFormSection()}
    ${renderEntriesSection()}
  `;

  bindEvents();
  mountPickers();
  mountFlipCard();
}

function restoreFormDrafts() {
  const task = document.getElementById("task-name") as HTMLInputElement | null;
  const notes = document.getElementById("task-notes") as HTMLTextAreaElement | null;
  if (task) task.value = state.draftTask;
  if (notes) notes.value = state.draftNotes;
}

function mountFlipCard() {
  const host = document.getElementById("record-flip-host");
  if (!host) return;

  restoreFormDrafts();

  flipCard = new FlipCard();
  flipCard.mount(host, state.cardFlipped, (flipped) => {
    state.cardFlipped = flipped;
  });
}

function mountPickers() {
  const wheelRoot = document.getElementById("wheel-root");
  const presetRoot = document.getElementById("preset-root");
  const timeContainer = document.getElementById("scroll-time");

  if (wheelRoot) {
    wheel = new WheelPicker();
    wheel.mount(wheelRoot);
  }

  if (presetRoot && wheel) {
    presetPicker = new PresetPicker();
    presetPicker.mount(presetRoot, wheel);
  }

  if (timeContainer) {
    timePanel = new CascadedTimePanel();
    timePanel.mount(
      timeContainer,
      (stage) => {
        state.timeStage = stage;
        timeContainer.classList.toggle("open", stage !== "closed");
        timeContainer.classList.toggle("preset-open", stage === "full");
      },
      {
        onPresetTap: (cell) => presetPicker?.applyCell(cell),
      }
    );
    if (state.timeStage !== "closed") {
      timePanel.setStage(state.timeStage, false);
    }
  }
}

function bindEvents() {
  document.getElementById("record-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const task_name = (document.getElementById("task-name") as HTMLInputElement).value.trim();
    if (!task_name) return;

    const notesRaw = (document.getElementById("task-notes") as HTMLTextAreaElement | null)?.value.trim() ?? "";
    const includeDuration = timePanel?.isWheelOpen() ?? false;
    const duration_seconds =
      includeDuration && wheel ? wheel.getDurationSeconds() : null;

    try {
      await api.create({
        task_name,
        duration_seconds: duration_seconds || null,
        notes: notesRaw || null,
        recorded_date: state.selectedDate,
      });
      state.timeStage = "closed";
      state.cardFlipped = false;
      state.draftTask = "";
      state.draftNotes = "";
      await refreshEntries();
      render({ preserveDrafts: false });
      showToast("已记下");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "保存失败", true);
    }
  });

  document.getElementById("btn-prev")?.addEventListener("click", async () => {
    state.selectedDate = shiftDate(state.selectedDate, -1);
    await refreshEntries();
    render();
  });

  document.getElementById("btn-next")?.addEventListener("click", async () => {
    if (state.selectedDate >= todayStr()) return;
    state.selectedDate = shiftDate(state.selectedDate, 1);
    await refreshEntries();
    render();
  });

  document.querySelectorAll(".btn-delete").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = Number((btn as HTMLElement).dataset.id);
      if (!confirm("确定删除？")) return;
      try {
        await api.delete(id);
        await refreshEntries();
        render();
        showToast("已删除");
      } catch (err) {
        showToast(err instanceof Error ? err.message : "删除失败", true);
      }
    });
  });
}

async function refreshEntries() {
  state.entries = await api.listEntries(state.selectedDate);
}

async function init() {
  try {
    await api.health();
    await refreshEntries();
    render();
  } catch {
    const app = document.getElementById("app");
    const hint =
      location.port === "5173"
        ? "请确认后端已启动（backend 目录执行 python run.py）"
        : "请执行项目根目录的 start.ps1";
    if (app) {
      app.innerHTML = `
        <header class="header"><h1>Lyube</h1></header>
        <section class="card">
          <p class="empty-state">无法连接后端<br/>${hint}</p>
        </section>
      `;
    }
  }
}

init();
