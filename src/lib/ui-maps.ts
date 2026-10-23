import type { Area, Priority, ReminderKind } from '../types';
import type { StatusKind, Tone } from './calc';

export const AREAS: Area[] = ['Car', 'House', 'Career', 'Content', 'Business', 'Learning', 'Family', 'Other'];
export const AREA_COLOR: Record<Area, string> = {
  Car: '#7C97DD', House: '#6DBE9A', Career: '#A08ADB', Content: '#D98BB5', Business: '#E3A867', Learning: '#64B5C4', Family: '#E58E9E', Other: '#9AA5B4',
};
export const KIND_TONE: Record<StatusKind, Tone> = { good: 'blue', done: 'mint', bad: 'amber', idle: 'gray' };
export const PRIO_TONE: Record<Priority, Tone> = { High: 'rose', Med: 'blue', Low: 'gray' };
export const REMINDER_COLOR: Record<ReminderKind, string> = {
  Bill: '#7C97DD', Tax: '#E3A867', Birthday: '#E58E9E', Anniversary: '#D98BB5', Renewal: '#64B5C4', Event: '#6DBE9A', Other: '#9AA5B4',
};
export const WALLET_COLORS = ['#7C97DD', '#6DBE9A', '#E3A867', '#D98BB5', '#64B5C4', '#A08ADB', '#E58E9E'];
