import { useState, useMemo } from 'preact/hooks';
import { useUi } from '../../state/ui.jsx';
import { useStudents, usePickupPoints } from '../../state/hooks.js';
import { outstandingBalance, isSettled, daysOverdue } from '../../domain/invoices.js';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/index.js';
import { todayISO } from '../../domain/dates.js';
import { formatCurrency, initials } from '../../lib/format.js';
import { TopBar } from '../components/TopBar.jsx';
import { BottomNav } from '../components/BottomNav.jsx';
import { EmptyState } from '../components/EmptyState.jsx';

export function StudentList() {
  const { go, t } = useUi();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const students = useStudents();
  const pickups = usePickupPoints();
  const invoices = useLiveQuery(() => db.invoices.toArray(), [], []);

  const pickupById = useMemo(() => new Map(pickups.map((p) => [p.id, p])), [pickups]);
  const statusByStudent = useMemo(() => {
    const today = todayISO();
    const map = new Map();
    for (const s of students) map.set(s.id, { balance: 0, status: 'paid', worstDays: 0 });
    for (const inv of invoices) {
      const cur = map.get(inv.student_id);
      if (!cur) continue;
      if (!isSettled(inv)) {
        cur.balance += outstandingBalance(inv);
        cur.status = 'pending';
        const d = daysOverdue(inv, today);
        if (d > 0) {
          cur.status = 'overdue';
          cur.worstDays = Math.max(cur.worstDays, d);
        }
      }
    }
    return map;
  }, [students, invoices]);

  const filters = [
    { key: 'all', label: t('all') },
    { key: 'overdue', label: t('overdue') },
    { key: 'pending', label: t('pending') },
    { key: 'paid', label: t('paid') }
  ];

  const searchLc = search.trim().toLowerCase();
  const filtered = students.filter((s) => {
    const pickup = pickupById.get(s.pickup_point_id);
    const hay = `${s.name} ${s.school_name} ${s.father_name} ${s.mother_name} ${s.father_phone} ${s.mother_phone} ${s.class_name} ${pickup?.name || ''}`.toLowerCase();
    const okSearch = !searchLc || hay.includes(searchLc);
    const st = statusByStudent.get(s.id)?.status || 'paid';
    const okFilter = filter === 'all' || filter === st;
    return okSearch && okFilter;
  });

  return (
    <div style="min-height:100vh;display:flex;flex-direction:column">
      <TopBar title={t('students')} eyebrow="S-04" />
      <div class="main-scroll scr">
        <div style="padding:12px 14px;border-bottom:2px solid var(--color-text);background:var(--color-neutral-100);display:flex;flex-direction:column;gap:9px">
          <input class="input" value={search} onInput={(e) => setSearch(e.currentTarget.value)} placeholder={t('searchPlaceholder')} />
          <div class="chip-scroll">
            {filters.map((f) => (
              <button key={f.key} class={`chip${filter === f.key ? ' active' : ''}`} onClick={() => setFilter(f.key)}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {filtered.map((s) => {
          const st = statusByStudent.get(s.id) || { balance: 0, status: 'paid' };
          const pickup = pickupById.get(s.pickup_point_id);
          return (
            <button key={s.id} class="list-row" onClick={() => go('student', { studentId: s.id, tab: 'record' })}>
              <span class="avatar" style={st.status === 'overdue' ? 'background:var(--color-accent);color:#fff;border-color:var(--color-accent)' : ''}>
                {initials(s.name)}
              </span>
              <span style="flex:1;min-width:0">
                <span style="display:block;font-weight:700;font-size:14.5px">{s.name}</span>
                <span style="display:block;font-size:11.5px;color:var(--color-neutral-700);margin-top:1px">
                  {s.class_name} · {s.school_name} · {pickup?.name || '—'}
                </span>
              </span>
              <span style="text-align:right;flex:0 0 auto">
                <span style="display:block;font-weight:800;font-size:14px">{formatCurrency(st.balance)}</span>
                <span style={`display:block;font-size:10px;font-weight:700;margin-top:2px;${st.status === 'overdue' ? 'color:var(--color-accent-700)' : 'color:var(--color-neutral-600)'}`}>
                  {t(st.status)}
                </span>
              </span>
            </button>
          );
        })}
        {filtered.length === 0 && <EmptyState>{t('noResults')}</EmptyState>}
        <div style="padding:14px">
          <button class="btn btn-primary btn-block" onClick={() => go('form', {})}>{t('addStudent')}</button>
          <button class="btn btn-secondary btn-block" style="margin-top:8px" onClick={() => go('import')}>{t('importStudents')}</button>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
