import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, dark } from '../theme/colors';

// ── Date helpers ──────────────────────────────────────────────────────────────

export function toISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

export function addMonths(date, n) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
}

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

// ── Month Calendar ────────────────────────────────────────────────────────────

export function MonthCalendar({ year, month, selected, onSelect, dotDates = new Set() }) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = toISO(new Date());

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  return (
    <View>
      <View style={s.dayLabelsRow}>
        {DAY_LABELS.map((d) => (
          <Text key={d} style={s.dayLabel}>{d}</Text>
        ))}
      </View>
      {weeks.map((week, wi) => (
        <View key={wi} style={s.weekRow}>
          {week.map((day, di) => {
            if (!day) return <View key={di} style={s.dayCell} />;
            const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const isToday = iso === today;
            const isSelected = iso === selected;
            const hasDot = dotDates.has(iso);
            return (
              <TouchableOpacity
                key={di}
                style={s.dayCell}
                onPress={() => onSelect(iso)}
                activeOpacity={0.7}
              >
                <View style={[s.dayCircle, isSelected && s.daySelected, isToday && !isSelected && s.dayToday]}>
                  <Text style={[s.dayNum, isSelected && s.dayNumSelected, isToday && !isSelected && s.dayNumToday]}>
                    {day}
                  </Text>
                </View>
                <View style={[s.dot, hasDot && s.dotVisible, isSelected && hasDot && s.dotOnSelected]} />
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
    </View>
  );
}

// ── Week Strip ────────────────────────────────────────────────────────────────

export function WeekStrip({ selectedDate, onSelect, dotDates = new Set() }) {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const weekStart = addDays(today, -dayOfWeek);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const todayISO = toISO(today);

  return (
    <View style={s.weekStrip}>
      {days.map((date) => {
        const iso = toISO(date);
        const isToday = iso === todayISO;
        const isSelected = iso === selectedDate;
        const hasDot = dotDates.has(iso);
        const label = DAY_LABELS[date.getDay()];
        return (
          <TouchableOpacity key={iso} style={s.stripCell} onPress={() => onSelect(iso)} activeOpacity={0.7}>
            <Text style={[s.stripLabel, isToday && s.stripLabelToday]}>{label}</Text>
            <View style={[s.dayCircle, isSelected && s.daySelected, isToday && !isSelected && s.dayToday]}>
              <Text style={[s.dayNum, isSelected && s.dayNumSelected, isToday && !isSelected && s.dayNumToday]}>
                {date.getDate()}
              </Text>
            </View>
            <View style={[s.dot, hasDot && s.dotVisible, isSelected && hasDot && s.dotOnSelected]} />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const CELL = 44;

const s = StyleSheet.create({
  dayLabelsRow: { flexDirection: 'row', marginBottom: 2 },
  dayLabel: {
    width: CELL, textAlign: 'center',
    fontFamily: 'Sora-SemiBold', fontSize: 11,
    color: colors.textMuted, letterSpacing: 0.3,
  },
  weekRow: { flexDirection: 'row' },
  dayCell: { width: CELL, alignItems: 'center', paddingVertical: 2 },
  dayCircle: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
  },
  daySelected: { backgroundColor: colors.accent },
  dayToday: { backgroundColor: dark.bg2, borderWidth: 1, borderColor: colors.accent },
  dayNum: { fontFamily: 'Sora-Regular', fontSize: 14, color: colors.textSecondary },
  dayNumSelected: { color: '#fff', fontFamily: 'Sora-SemiBold' },
  dayNumToday: { color: colors.accent },
  dot: { width: 4, height: 4, borderRadius: 2, marginTop: 2 },
  dotVisible: { backgroundColor: colors.accent },
  dotOnSelected: { backgroundColor: 'rgba(255,255,255,0.7)' },

  weekStrip: { flexDirection: 'row' },
  stripCell: { flex: 1, alignItems: 'center', paddingVertical: 4, gap: 3 },
  stripLabel: { fontFamily: 'Sora-SemiBold', fontSize: 10, color: colors.textMuted },
  stripLabelToday: { color: colors.accent },
});
