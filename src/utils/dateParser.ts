/**
 * Date Parser Utilities
 * Centralized date parsing logic extracted from ReminderService
 */

/**
 * Parse custom date string
 * Supports formats:
 * - YYYY-MM-DD
 * - Relative: "3 days", "2 weeks", "5 hours", "1 month"
 */
export function parseCustomDate(dateStr: string): Date {
  // Try YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day, 9, 0, 0);
  }

  // Try relative format
  const match = dateStr.match(/^(\d+)\s*(day|week|month|hour)s?$/i);
  if (match) {
    const amount = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();
    const date = new Date();

    switch (unit) {
      case 'hour':
        date.setHours(date.getHours() + amount);
        break;
      case 'day':
        date.setDate(date.getDate() + amount);
        break;
      case 'week':
        date.setDate(date.getDate() + amount * 7);
        break;
      case 'month':
        date.setMonth(date.getMonth() + amount);
        break;
    }

    return date;
  }

  // Fallback to tomorrow at 9 AM
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);
  return tomorrow;
}

/**
 * Validate date string format
 * Returns error message if invalid, undefined if valid
 */
export function validateDateString(value: string): string | undefined {
  if (!value) {
    return 'Date is required';
  }

  // Check YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return undefined;
  }

  // Check relative format
  if (/^\d+\s*(day|week|month|hour)s?$/i.test(value)) {
    return undefined;
  }

  return 'Invalid format. Use YYYY-MM-DD or "3 days"';
}

/**
 * Create date options for quick picks
 */
export interface DateOption {
  label: string;
  description: string;
  getDate: () => Date;
}

export function getCommonDateOptions(): DateOption[] {
  const now = new Date();

  return [
    {
      label: '$(clock) In 1 hour',
      description: 'Remind me in 1 hour',
      getDate: () => new Date(now.getTime() + 60 * 60 * 1000),
    },
    {
      label: '$(calendar) Later today',
      description: 'Remind me at 5 PM',
      getDate: () => {
        const date = new Date(now);
        date.setHours(17, 0, 0, 0);
        if (date <= now) {
          date.setDate(date.getDate() + 1);
        }
        return date;
      },
    },
    {
      label: '$(arrow-right) Tomorrow',
      description: 'Remind me tomorrow at 9 AM',
      getDate: () => {
        const date = new Date(now);
        date.setDate(date.getDate() + 1);
        date.setHours(9, 0, 0, 0);
        return date;
      },
    },
    {
      label: '$(calendar) Next week',
      description: 'Remind me next Monday',
      getDate: () => {
        const date = new Date(now);
        const daysUntilMonday = (8 - date.getDay()) % 7 || 7;
        date.setDate(date.getDate() + daysUntilMonday);
        date.setHours(9, 0, 0, 0);
        return date;
      },
    },
  ];
}

/**
 * Format a date offset for display
 */
export function formatDateOffset(daysFromNow: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toLocaleDateString();
}

/**
 * Get days until Monday from a given date
 */
export function getDaysUntilMonday(date: Date = new Date()): number {
  return (8 - date.getDay()) % 7 || 7;
}

/**
 * Set time on a date (hours, minutes, seconds, milliseconds)
 */
export function setDateTime(
  date: Date,
  hours: number,
  minutes: number = 0,
  seconds: number = 0,
  milliseconds: number = 0
): Date {
  const newDate = new Date(date);
  newDate.setHours(hours, minutes, seconds, milliseconds);
  return newDate;
}
