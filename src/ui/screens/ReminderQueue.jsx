import { useLiveQuery } from 'dexie-react-hooks';
import { useState, useEffect } from 'preact/hooks';
import { useUi } from '../../state/ui.jsx';
import { useSettingsMap } from '../../state/hooks.js';
import { buildQueue, dispatchReminder, skipReminder, undoDispatch, getSentToday, composeForRow } from '../../actions/reminders.js';
import { formatCurrency } from '../../lib/format.js';
import { TopBar } from '../components/TopBar.jsx';
import { BottomNav } from '../components/BottomNav.jsx';
import { EmptyState } from '../components/EmptyState.jsx';

const STAGE_LABEL_KEY = { advance: 'advance', due: 'dueTodayStage', overdue: 'overdue', final: 'finalNotice' };
const STAGE_STYLE = {
  final: 'background:var(--color-accent);color:#fff',
  overdue: 'background:var(--color-accent-200)',
  due: 'background:var(--color-neutral-200)',
  advance: 'background:var(--color-neutral-100)'
};

export function ReminderQueue() {
  const { toast, root, t } = useUi();
  const [mode, setMode] = useState('list');
  const [cardIdx, setCardIdx] = useState(0);

  const [stageFilter, setStageFilter] = useState('all');
  const queueResult = useLiveQuery(() => buildQueue(), [], null);
  const sent = useLiveQuery(() => getSentToday(), [], []);
  const settingsMap = useSettingsMap();
  const allRows = queueResult?.rows || [];
  // Once every message of a filtered stage is sent, fall back to showing everything.
  const activeFilter = stageFilter !== 'all' && !allRows.some((r) => r.stage === stageFilter) ? 'all' : stageFilter;
  const rows = activeFilter === 'all' ? allRows : allRows.filter((r) => r.stage === activeFilter);
  const hasQr = !!settingsMap?.payment_qr;
  const qrOn = hasQr && settingsMap.attach_qr !== false;

  async function onSend(row, opts) {
    const res = await dispatchReminder(row, opts);
    if (res.outcome !== 'cancelled') toast(t('openWhatsApp') + ' ✓');
  }
  async function onSkip(row) {
    await skipReminder(row, '');
    toast(t('skip') + ' ✓');
  }
  async function onUndo(logId) {
    await undoDispatch(logId);
  }

  const current = mode === 'cards' ? rows[Math.min(cardIdx, Math.max(0, rows.length - 1))] : null;

  return (
    <div style="min-height:100vh;display:flex;flex-direction:column">
      <TopBar title={t('queue')} eyebrow="S-03" />
      <div class="main-scroll scr">
        <div class="screen-pad">
          {queueResult?.quiet && <div class="banner banner-amber">{t('quietHoursNote')}</div>}

          {qrOn && <div class="banner banner-amber" style="font-size:12px">{t('qrPickChat')}</div>}

          {!queueResult?.quiet && allRows.length > 0 && mode === 'list' && (
            <div class="chip-scroll">
              {[['all', t('all')], ['final', t('finalNotice')], ['overdue', t('overdue')], ['due', t('dueTodayStage')], ['advance', t('advance')]].map(([key, label]) => {
                const count = key === 'all' ? allRows.length : allRows.filter((r) => r.stage === key).length;
                if (key !== 'all' && count === 0) return null;
                return (
                  <button key={key} class={`chip${activeFilter === key ? ' active' : ''}`} onClick={() => setStageFilter(key)}>
                    {label} ({count})
                  </button>
                );
              })}
            </div>
          )}

          {!queueResult?.quiet && rows.length > 0 && mode === 'list' && (
            <div class="card card-tight" style="display:flex;align-items:center;gap:10px">
              <div style="flex:1;font-size:12.5px;color:var(--color-neutral-800)">{rows.length} pending</div>
              <button
                class="btn btn-primary"
                onClick={() => {
                  setMode('cards');
                  setCardIdx(0);
                }}
              >
                {t('sendAll')}
              </button>
            </div>
          )}

          {mode === 'list' &&
            rows.map((row) => (
              <div key={row.key} class="card" style="padding:12px 14px;display:flex;flex-direction:column;gap:9px">
                <div style="display:flex;gap:10px;align-items:flex-start">
                  <div style="flex:1;min-width:0">
                    <div style="font-weight:800;font-size:16px">
                      {row.student_name} <span class="tag" style="vertical-align:middle;margin-left:4px">{row.language === 'english' ? 'English' : 'Hinglish'}</span>
                    </div>
                    <div style="font-size:11.5px;color:var(--color-neutral-700);margin-top:2px">
                      {row.class_name} · {row.pickup_point_name}
                    </div>
                  </div>
                  <div style="text-align:right">
                    <div style="font-weight:800;font-size:17px">{formatCurrency(row.amount)}</div>
                    <div class="tag" style={STAGE_STYLE[row.stage]}>{t(STAGE_LABEL_KEY[row.stage])}</div>
                  </div>
                </div>
                <div style="display:flex;gap:8px;align-items:center">
                  <div style="flex:1;min-width:0;font-size:12.5px">
                    <span style="font-weight:700">{row.recipient_name}</span>
                    <span style="color:var(--color-neutral-700)"> · {row.recipient_phone}</span>
                  </div>
                  <button class="btn btn-ghost" onClick={() => onSkip(row)}>{t('skip')}</button>
                  <button class="btn btn-accent" style="padding:9px 13px" onClick={() => onSend(row)}>{t('send')}</button>
                </div>
                {hasQr && (
                  <button class="btn btn-ghost" style="align-self:flex-start" onClick={() => onSend(row, { withQr: !qrOn })}>
                    {qrOn ? t('sendWithoutQr') : t('sendWithQr')}
                  </button>
                )}
              </div>
            ))}

          {mode === 'cards' && (
            <div style="display:flex;flex-direction:column;gap:12px">
              <div style="display:flex;align-items:center;gap:10px">
                <div style="flex:1;height:6px;background:var(--color-neutral-300);border:2px solid var(--color-text)">
                  <div style={`height:100%;background:var(--color-accent);width:${rows.length ? Math.round(((sent.length) / (sent.length + rows.length)) * 100) : 100}%`} />
                </div>
                <button class="btn btn-ghost" onClick={() => setMode('list')}>{t('close')}</button>
              </div>

              {current ? (
                <div class="card">
                  <div style={`padding:13px 14px;border-bottom:2px solid var(--color-text);${STAGE_STYLE[current.stage]}`}>
                    <span class="section-title">{t(STAGE_LABEL_KEY[current.stage])}</span>
                  </div>
                  <div style="padding:14px">
                    <div style="font-weight:800;font-size:24px">{current.student_name}</div>
                    <div style="font-size:12.5px;color:var(--color-neutral-700);margin-top:3px">{current.class_name} · {current.pickup_point_name} · {row_language(current)}</div>
                    <div style="display:flex;gap:14px;margin-top:14px;padding-top:12px;border-top:1px solid var(--color-neutral-300)">
                      <div style="flex:1">
                        <div class="stat-label">{t('amount')}</div>
                        <div style="font-weight:800;font-size:21px;margin-top:2px">{formatCurrency(current.amount)}</div>
                      </div>
                      <div style="flex:1.4;min-width:0">
                        <div class="stat-label">{t('sendingTo')}</div>
                        <div style="font-weight:700;font-size:14px;margin-top:2px">{current.recipient_name}</div>
                        <div style="font-size:12px;color:var(--color-neutral-700)">{current.recipient_phone}</div>
                      </div>
                    </div>
                  </div>
                  <div style="padding:12px 14px;border-top:2px solid var(--color-text);background:var(--color-neutral-200)">
                    <div class="stat-label" style="margin-bottom:6px">{t('messagePreview')}</div>
                    <MessagePreview key={current.key + qrOn} row={current} attachQr={qrOn} />
                  </div>
                  <div style="display:flex;gap:8px;padding:12px 14px;border-top:2px solid var(--color-text)">
                    <button class="btn btn-secondary" onClick={() => onSkip(current)}>{t('skip')}</button>
                    <button
                      class="btn btn-accent"
                      style="flex:1;justify-content:flex-start"
                      onClick={() => onSend(current)}
                    >
                      {t('openWhatsApp')}
                    </button>
                  </div>
                  {hasQr && (
                    <div style="padding:0 14px 12px">
                      <button class="btn btn-secondary btn-block" onClick={() => onSend(current, { withQr: !qrOn })}>
                        {qrOn ? t('sendWithoutQr') : t('sendWithQr')}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div class="card" style="padding:26px 16px">
                  <div style="font-weight:800;font-size:22px">{t('queueEmptyTitle')}</div>
                  <div style="font-size:13px;color:var(--color-neutral-800);margin-top:8px">
                    {sent.length} {t('sentToday').toLowerCase()}.
                  </div>
                  <button class="btn btn-primary" style="margin-top:16px" onClick={() => root('dash')}>{t('backToDash')}</button>
                </div>
              )}
            </div>
          )}

          {!queueResult?.quiet && rows.length === 0 && mode === 'list' && (
            <div class="card">
              <EmptyState>{t('queueEmptyBody')}</EmptyState>
            </div>
          )}

          <div style="border-top:2px solid var(--color-text);padding-top:10px">
            <div class="section-title" style="margin-bottom:8px">{t('sentToday')} · {sent.length}</div>
            {sent.map((r) => (
              <div key={r.id} style="display:flex;gap:9px;align-items:center;padding:7px 0;border-bottom:1px solid var(--color-neutral-300);font-size:12.5px">
                <span style="color:var(--color-success);font-weight:800">&#10003;</span>
                <span style="flex:1;min-width:0"><span style="font-weight:700">{r.student_name}</span> · {r.recipient_type}</span>
                <span style="font-size:11px;color:var(--color-neutral-700)">{r.time}</span>
                <button class="btn btn-ghost" onClick={() => onUndo(r.id)}>{t('undo')}</button>
              </div>
            ))}
          </div>
        </div>
      </div>
      <BottomNav />
    </div>
  );
}

const row_language = (r) => (r.language === 'english' ? 'English' : 'Hinglish');

function MessagePreview({ row, attachQr }) {
  const [text, setText] = useState('');
  useEffect(() => {
    let cancelled = false;
    composeForRow(row, { attachQr }).then((msg) => {
      if (!cancelled) setText(msg);
    });
    return () => { cancelled = true; };
  }, [row.key]);
  return <div style="white-space:pre-wrap;font-size:12.5px;line-height:1.5;max-height:190px;overflow-y:auto">{text}</div>;
}
