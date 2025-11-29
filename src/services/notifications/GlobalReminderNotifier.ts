/**
 * Global Reminder Notification Handler
 * Handles notifications for global reminders
 */

import * as vscode from 'vscode';
import { GlobalReminder } from '../../models/todo';

export class GlobalReminderNotifier {
  /**
   * Show notification for a global reminder
   */
  async showReminderNotification(
    reminder: GlobalReminder,
    onComplete: (id: string) => Promise<void>,
    onSnooze: (id: string, until: Date) => Promise<void>
  ): Promise<void> {
    const message = `🔔 Reminder: ${reminder.title}`;

    const action = await vscode.window.showInformationMessage(
      message,
      'Snooze 1h',
      'Snooze 1d',
      'Complete'
    );

    switch (action) {
      case 'Snooze 1h':
        const snooze1h = new Date();
        snooze1h.setHours(snooze1h.getHours() + 1);
        await onSnooze(reminder.id, snooze1h);
        break;
      case 'Snooze 1d':
        const snooze1d = new Date();
        snooze1d.setDate(snooze1d.getDate() + 1);
        await onSnooze(reminder.id, snooze1d);
        break;
      case 'Complete':
        await onComplete(reminder.id);
        break;
    }
  }

  /**
   * Check if a reminder should be shown
   */
  shouldShowReminder(reminder: GlobalReminder, now: Date = new Date()): boolean {
    // Skip if not pending
    if (reminder.status !== 'pending') {
      return false;
    }

    // Skip if snoozed
    if (reminder.snoozedUntil && reminder.snoozedUntil > now) {
      return false;
    }

    // Show if due
    return reminder.dueAt <= now;
  }
}
