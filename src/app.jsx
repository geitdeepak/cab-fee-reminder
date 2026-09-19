import { useEffect } from 'preact/hooks';
import { UiProvider, useUi } from './state/ui.jsx';
import { ready } from './db/index.js';
import { isMpinSet } from './actions/auth.js';
import { Toast } from './ui/components/Toast.jsx';
import { DialogHost } from './ui/components/Dialog.jsx';
import { BackupInterstitial } from './ui/components/BackupInterstitial.jsx';

import { Lock } from './ui/screens/Lock.jsx';
import { Dashboard } from './ui/screens/Dashboard.jsx';
import { ReminderQueue } from './ui/screens/ReminderQueue.jsx';
import { StudentList } from './ui/screens/StudentList.jsx';
import { StudentDetail } from './ui/screens/StudentDetail.jsx';
import { StudentForm } from './ui/screens/StudentForm.jsx';
import { PickupPoints } from './ui/screens/PickupPoints.jsx';
import { EnrolmentForm } from './ui/screens/EnrolmentForm.jsx';
import { Invoices } from './ui/screens/Invoices.jsx';
import { PaymentEntry } from './ui/screens/PaymentEntry.jsx';
import { Templates } from './ui/screens/Templates.jsx';
import { Backup } from './ui/screens/Backup.jsx';
import { Reports } from './ui/screens/Reports.jsx';
import { Settings } from './ui/screens/Settings.jsx';
import { More } from './ui/screens/More.jsx';
import { ImportStudents } from './ui/screens/ImportStudents.jsx';

const SCREENS = {
  dash: Dashboard,
  queue: ReminderQueue,
  students: StudentList,
  student: StudentDetail,
  form: StudentForm,
  pickups: PickupPoints,
  enrol: EnrolmentForm,
  invoices: Invoices,
  pay: PaymentEntry,
  templates: Templates,
  backup: Backup,
  reports: Reports,
  settings: Settings,
  more: More,
  import: ImportStudents
};

function Router() {
  const { state } = useUi();
  if (state.screen === 'boot') return null;
  if (state.screen === 'lock' || state.screen === 'setup') return <Lock />;
  const Screen = SCREENS[state.screen] || Dashboard;
  return <Screen />;
}

function Boot() {
  const { bootDone } = useUi();
  useEffect(() => {
    ready().then(async () => {
      const needsSetup = !(await isMpinSet());
      bootDone(needsSetup);
    });
  }, []);
  return null;
}

function UpdateBar({ needRefresh, onRefresh }) {
  if (!needRefresh) return null;
  return (
    <div class="update-bar">
      <span>Update available.</span>
      <button onClick={onRefresh}>Refresh</button>
    </div>
  );
}

export function App({ needRefresh, onRefresh }) {
  return (
    <UiProvider>
      <UpdateBar needRefresh={needRefresh} onRefresh={onRefresh} />
      <div class="app-shell">
        <Boot />
        <Router />
      </div>
      <BackupInterstitial />
      <Toast />
      <DialogHost />
    </UiProvider>
  );
}
