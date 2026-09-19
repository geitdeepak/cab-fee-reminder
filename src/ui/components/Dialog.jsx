import { useUi } from '../../state/ui.jsx';

export function DialogHost() {
  const { state, closeDialog, t } = useUi();
  const d = state.dialog;
  if (!d) return null;

  return (
    <div class="dialog-backdrop" onClick={(e) => e.target === e.currentTarget && closeDialog()}>
      <div class="dialog-sheet">
        <div class="dialog-title">{d.title}</div>
        <div class="dialog-body">{d.body}</div>
        <div class="dialog-actions">
          <button class="btn btn-secondary" onClick={closeDialog}>{d.cancelLabel || t('cancel')}</button>
          <button
            class={`btn ${d.danger ? 'btn-danger' : 'btn-primary'}`}
            style="flex:1;justify-content:flex-start"
            onClick={async () => {
              await d.onConfirm();
              closeDialog();
            }}
          >
            {d.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
