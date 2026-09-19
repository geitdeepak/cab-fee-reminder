// English versions of the parent-facing messages. Same structure and the same
// payment block as the Hinglish set (src/db/seed.js), so a driver can send either
// to any parent. Ids end in "_en"; language is 'english'. Plain "Rs." and no
// rupee sign: some older Android fonts draw a box for it (SRS 8.3).
const PAY_BLOCK =
  '{qr_note}\n' +
  'UPI ID: {upi_id}\n' +
  'Mobile number: {operator_phone}\n' +
  'Payment link: {pay_link}\n\n';

const SIGN_OFF = 'Thank you 🙏\n{operator_name}\n{operator_phone}';

export const ENGLISH_TEMPLATES = [
  {
    id: 'advance_en',
    label: 'Advance Notice (D − 3)',
    language: 'english',
    active: true,
    body:
      'Dear {parent_name},\n\n' +
      'A gentle reminder about the cab fee for {student_name} ({class}).\n\n' +
      'Period   : {period}\n' +
      'Amount   : *Rs. {amount}*\n' +
      'Due date : *{due_date}*\n' +
      'Pickup   : {pickup_point}\n\n' +
      'Kindly pay by the due date.\n' +
      PAY_BLOCK +
      'A receipt will be sent once the payment is received. If you have already paid, please let me know.\n\n' +
      SIGN_OFF
  },
  {
    id: 'due_en',
    label: 'Due Today (D + 0)',
    language: 'english',
    active: true,
    body:
      'Dear {parent_name},\n\n' +
      'The cab fee for {student_name} ({class}) is *due today*.\n\n' +
      'Period : {period}\n' +
      'Amount : *Rs. {amount}*\n\n' +
      'Kindly pay today.\n' +
      PAY_BLOCK +
      'If you have already paid, please let me know and I will update my records.\n\n' +
      SIGN_OFF
  },
  {
    id: 'overdue_en',
    label: 'Overdue (D + 5)',
    language: 'english',
    active: true,
    body:
      'Dear {parent_name},\n\n' +
      'The cab fee for {student_name} ({class}) has been pending for *{days_overdue} days*.\n\n' +
      'Period   : {period}\n' +
      'Amount   : *Rs. {amount}*\n' +
      'Due date : {due_date}\n\n' +
      'Kindly pay at the earliest.\n' +
      PAY_BLOCK +
      'If you have already paid, please send a screenshot and I will correct my records. ' +
      'If there is any difficulty, please call me and we will sort it out.\n\n' +
      SIGN_OFF
  },
  {
    id: 'final_en',
    label: 'Final Notice (D + 15)',
    language: 'english',
    active: true,
    body:
      'Dear {parent_name},\n\n' +
      'The cab fee for {student_name} ({class}) has been pending for *{days_overdue} days*. ' +
      'I have reminded you earlier.\n\n' +
      'Amount   : *Rs. {amount}*\n' +
      'Due date : {due_date}\n\n' +
      'If the payment is not cleared, I may have to pause the cab service temporarily, which I would like to avoid. ' +
      'Kindly pay today, or call me so we can talk.\n' +
      PAY_BLOCK +
      'If you have already paid, please let me know right away.\n\n' +
      SIGN_OFF
  },
  {
    id: 'receipt_en',
    label: 'Payment Receipt',
    language: 'english',
    active: true,
    body:
      'Dear {parent_name},\n\n' +
      'We have received your payment. Thank you.\n\n' +
      'Receipt : {receipt_no}\n' +
      'Student : {student_name} ({class})\n' +
      'Period  : {period}\n' +
      'Amount  : *Rs. {amount}*\n' +
      'Mode    : {mode}\n' +
      'Date    : {paid_on}\n\n' +
      '{operator_name}\n{operator_phone}'
  }
];
