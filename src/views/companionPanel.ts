/**
 * Companion Panel Webview Provider
 * Simplified focus timer UI with animated SVG companions
 */

import * as vscode from "vscode";
import { FocusService } from "../services/focus";
import { CompanionService } from "../services/companion";
import { formatTime } from "../utils/dateUtils";
import { FocusState } from "../models/focus";
import {
  CompanionType,
  ALL_COMPANIONS,
  COMPANION_NAMES,
} from "../models/companion";

/**
 * Companion Panel WebviewViewProvider
 */
export class CompanionPanelProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "cmdify.focus";

  private view?: vscode.WebviewView;
  private disposables: vscode.Disposable[] = [];

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly focusService: FocusService,
    private readonly companionService: CompanionService
  ) {
    this.disposables.push(
      focusService.onTick(() => this.updateWebview()),
      focusService.onStateChange(() => this.updateWebview()),
      companionService.onStateChange(() => this.updateWebview())
    );
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.extensionUri],
    };

    webviewView.webview.html = this.getHtmlContent(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case "start":
            await this.focusService.start();
            break;
          case "pause":
            await this.focusService.pause();
            break;
          case "resume":
            await this.focusService.resume();
            break;
          case "stop":
            await this.focusService.stop();
            break;
          case "skip":
            await this.focusService.skip();
            break;
          case "changeCompanion":
            await this.showCompanionPicker();
            break;
        }
      },
      undefined,
      this.disposables
    );

    this.updateWebview();
  }

  private updateWebview(): void {
    if (this.view) {
      const focusState = this.focusService.getState();
      const companionState = this.companionService.getState();
      const stats = this.focusService.getStats();
      const svgState = this.companionService.getSvgState();

      this.view.webview.postMessage({
        type: "update",
        focusState,
        companionType: companionState.type,
        svgState,
        streak: stats.currentStreak,
        timeFormatted: formatTime(focusState.timeRemaining),
      });
    }
  }

  private async showCompanionPicker(): Promise<void> {
    const current = this.companionService.getState().type;
    const items = ALL_COMPANIONS.map((type) => ({
      label: `${type === current ? "✓ " : ""}${COMPANION_NAMES[type]}`,
      value: type,
      picked: type === current,
    }));

    const selected = await vscode.window.showQuickPick(items, {
      title: "Choose Companion",
      placeHolder: "Select your focus companion",
    });

    if (selected) {
      await this.companionService.setCompanionType(selected.value);
    }
  }

  private getSvgUri(
    webview: vscode.Webview,
    type: CompanionType,
    state: string
  ): string {
    return webview
      .asWebviewUri(
        vscode.Uri.joinPath(
          this.extensionUri,
          "media",
          "companions",
          `${type}-${state}.svg`
        )
      )
      .toString();
  }

  private getHtmlContent(webview: vscode.Webview): string {
    const focusState = this.focusService.getState();
    const companionState = this.companionService.getState();
    const stats = this.focusService.getStats();
    const svgState = this.companionService.getSvgState();

    // Build SVG URI map for all companions and states
    const svgUris: Record<string, Record<string, string>> = {};
    for (const type of ALL_COMPANIONS) {
      svgUris[type] = {
        idle: this.getSvgUri(webview, type, "idle"),
        focus: this.getSvgUri(webview, type, "focus"),
        break: this.getSvgUri(webview, type, "break"),
        celebrate: this.getSvgUri(webview, type, "celebrate"),
      };
    }

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Focus</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-foreground);
      padding: 12px;
    }
    
    .timer-row {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    
    .companion {
      width: 56px;
      height: 56px;
      cursor: pointer;
      transition: transform 0.2s;
    }
    .companion:hover { transform: scale(1.08); }
    
    .timer-info { flex: 1; }
    
    .timer-display {
      font-size: 32px;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      line-height: 1.1;
    }
    .timer-display.idle { opacity: 0.4; }
    
    .status {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-top: 2px;
    }
    .status.focusing { color: var(--vscode-charts-orange); }
    .status.break { color: var(--vscode-charts-green); }
    
    .controls { display: flex; gap: 4px; }
    
    .btn {
      border: none;
      background: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      width: 32px;
      height: 32px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .btn:hover { background: var(--vscode-button-secondaryHoverBackground); }
    .btn.primary {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      width: auto;
      padding: 0 14px;
    }
    .btn.primary:hover { background: var(--vscode-button-hoverBackground); }
    
    .divider {
      height: 1px;
      background: var(--vscode-widget-border);
      margin: 12px 0;
    }
    
    .stats-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 12px;
    }
    .stats-label { color: var(--vscode-descriptionForeground); }
    .stats-value { font-weight: 500; }
    
    .dots { display: flex; gap: 6px; }
    .dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: var(--vscode-widget-border);
    }
    .dot.done { background: var(--vscode-charts-green); }
    .dot.active { 
      background: var(--vscode-charts-yellow); 
      animation: pulse 1s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.6; transform: scale(0.9); }
    }
  </style>
</head>
<body>
  <div class="timer-row">
    <img class="companion" id="companion" 
         src="${svgUris[companionState.type][svgState]}" 
         title="Click to change"/>
    
    <div class="timer-info">
      <div class="timer-display ${focusState.status}" id="timer">
        ${
          focusState.status === "idle"
            ? "--:--"
            : formatTime(focusState.timeRemaining)
        }
      </div>
      <div class="status ${focusState.status}" id="status">
        ${this.getStatusText(focusState.status)}
      </div>
    </div>
    
    <div class="controls" id="controls">
      ${this.getControlButtons(focusState.status)}
    </div>
  </div>
  
  <div class="divider"></div>
  
  <div class="stats-row">
    <span class="stats-label">Sessions</span>
    <div class="dots" id="dots">${this.getSessionDots(focusState)}</div>
  </div>
  
  <div class="stats-row" style="margin-top: 8px;">
    <span class="stats-label">🔥 Streak</span>
    <span class="stats-value" id="streak">${stats.currentStreak} days</span>
  </div>
  
  <script>
    const vscode = acquireVsCodeApi();
    const svgUris = ${JSON.stringify(svgUris)};
    
    document.getElementById('controls').addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (btn?.dataset.action) vscode.postMessage({ command: btn.dataset.action });
    });
    
    document.getElementById('companion').addEventListener('click', () => {
      vscode.postMessage({ command: 'changeCompanion' });
    });
    
    window.addEventListener('message', (e) => {
      const msg = e.data;
      if (msg.type !== 'update') return;
      
      const { focusState, companionType, svgState, streak, timeFormatted } = msg;
      
      document.getElementById('timer').textContent = focusState.status === 'idle' ? '--:--' : timeFormatted;
      document.getElementById('timer').className = 'timer-display ' + focusState.status;
      document.getElementById('status').textContent = getStatus(focusState.status);
      document.getElementById('status').className = 'status ' + focusState.status;
      document.getElementById('companion').src = svgUris[companionType][svgState];
      document.getElementById('controls').innerHTML = getButtons(focusState.status);
      document.getElementById('dots').innerHTML = getDots(focusState);
      document.getElementById('streak').textContent = streak + ' days';
    });
    
    function getStatus(s) {
      return { focusing: 'Focusing', break: 'Break', paused: 'Paused', idle: 'Ready' }[s] || 'Ready';
    }
    
    function getButtons(s) {
      if (s === 'idle') return '<button class="btn primary" data-action="start">▶ Start</button>';
      if (s === 'focusing' || s === 'break') return \`
        <button class="btn" data-action="pause" title="Pause">⏸</button>
        <button class="btn" data-action="skip" title="Skip">⏭</button>
        <button class="btn" data-action="stop" title="Stop">⏹</button>\`;
      if (s === 'paused') return \`
        <button class="btn primary" data-action="resume">▶</button>
        <button class="btn" data-action="stop" title="Stop">⏹</button>\`;
      return '';
    }
    
    function getDots(state) {
      let h = '';
      for (let i = 1; i <= 4; i++) {
        let c = 'dot';
        if (i < state.currentSession || (i === state.currentSession && state.status === 'break')) c += ' done';
        else if (i === state.currentSession && state.status === 'focusing') c += ' active';
        h += '<div class="' + c + '"></div>';
      }
      return h;
    }
  </script>
</body>
</html>`;
  }

  private getStatusText(status: string): string {
    return (
      { focusing: "Focusing", break: "Break", paused: "Paused", idle: "Ready" }[
        status
      ] || "Ready"
    );
  }

  private getControlButtons(status: string): string {
    if (status === "idle") {
      return '<button class="btn primary" data-action="start">▶ Start</button>';
    }
    if (status === "focusing" || status === "break") {
      return `<button class="btn" data-action="pause" title="Pause">⏸</button>
              <button class="btn" data-action="skip" title="Skip">⏭</button>
              <button class="btn" data-action="stop" title="Stop">⏹</button>`;
    }
    if (status === "paused") {
      return `<button class="btn primary" data-action="resume">▶</button>
              <button class="btn" data-action="stop" title="Stop">⏹</button>`;
    }
    return "";
  }

  private getSessionDots(focusState: FocusState): string {
    let html = "";
    for (let i = 1; i <= 4; i++) {
      let cls = "dot";
      if (
        i < focusState.currentSession ||
        (i === focusState.currentSession && focusState.status === "break")
      ) {
        cls += " done";
      } else if (
        i === focusState.currentSession &&
        focusState.status === "focusing"
      ) {
        cls += " active";
      }
      html += `<div class="${cls}"></div>`;
    }
    return html;
  }

  dispose(): void {
    this.disposables.forEach((d) => d.dispose());
  }
}
