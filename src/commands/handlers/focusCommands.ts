/**
 * Focus Timer Command Handlers
 * Handles focus timer commands (start, pause, resume, stop, skip)
 */

import * as vscode from 'vscode';
import { FocusService } from '../../services/focus';
import { SESSION_TYPES } from '../../models/companion';
import { CommandGroup, defineCommand, defineCommandGroup } from '../registry';

/**
 * Dependencies for focus commands
 */
export interface FocusCommandDependencies {
  focusService: FocusService;
}

/**
 * Session type quick pick item
 */
interface SessionPickItem extends vscode.QuickPickItem {
  sessionType: (typeof SESSION_TYPES)[number] | null;
}

/**
 * Create focus command handlers
 */
export function createFocusCommands(deps: FocusCommandDependencies): CommandGroup {
  const { focusService } = deps;

  return defineCommandGroup('Focus Timer Commands', [
    defineCommand('cmdify.focus.start', async () => {
      const config = vscode.workspace.getConfiguration('cmdify.focus');
      const showSessionPicker = config.get<boolean>('showSessionTypePicker', true);

      if (showSessionPicker) {
        const items: SessionPickItem[] = SESSION_TYPES.map((type) => ({
          label: `${type.icon} ${type.name}`,
          description: `${type.focusMinutes}/${type.breakMinutes} min`,
          detail: type.description,
          sessionType: type,
        }));

        items.push({
          label: '⚙️ Custom',
          description: `${config.get('focusDuration')}/${config.get('shortBreakDuration')} min`,
          detail: 'Use settings values',
          sessionType: null,
        });

        const selected = await vscode.window.showQuickPick(items, {
          placeHolder: 'Select session type',
          title: 'Start Focus Session',
        });

        if (!selected) {
          return;
        }

        if (selected.sessionType) {
          await focusService.startWithConfig({
            focusDuration: selected.sessionType.focusMinutes,
            shortBreakDuration: selected.sessionType.breakMinutes,
          });
        } else {
          await focusService.start();
        }
      } else {
        await focusService.start();
      }
    }),

    defineCommand('cmdify.focus.pause', () => focusService.pause()),

    defineCommand('cmdify.focus.resume', () => focusService.resume()),

    defineCommand('cmdify.focus.stop', () => focusService.stop()),

    defineCommand('cmdify.focus.skip', () => focusService.skip()),

    defineCommand('cmdify.focus.showPanel', () =>
      vscode.commands.executeCommand('cmdify.focus.focus')
    ),
  ]);
}
