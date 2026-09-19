// Hindi (Devanagari) versions of the parent-facing messages. Same structure and the same payment
// block as the English set (src/db/templatesEn.js). These keep the plain ids (advance, due, overdue,
// final, receipt); English ones end in "_en". "रु." is used instead of the rupee sign so the amount
// draws correctly on older phones. The wording avoids gendered verb endings so it reads correctly
// whoever the driver is.
const PAY_BLOCK =
  '{qr_note}\n' +
  'UPI ID: {upi_id}\n' +
  'मोबाइल नंबर: {operator_phone}\n' +
  'पेमेंट लिंक: {pay_link}\n\n';

const SIGN_OFF = 'धन्यवाद 🙏\n{operator_name}\n{operator_phone}';

export const HINDI_TEMPLATES = [
  {
    id: 'advance',
    label: 'पहले से सूचना (D − 3)',
    language: 'hindi',
    active: true,
    body:
      'नमस्ते {parent_name} जी 🙏\n\n' +
      '{student_name} ({class}) की कैब फ़ीस का एक छोटा-सा रिमाइंडर।\n\n' +
      'अवधि: {period}\n' +
      'रकम: *रु. {amount}*\n' +
      'देय तारीख़: *{due_date}*\n' +
      'पिकअप: {pickup_point}\n\n' +
      'कृपया देय तारीख़ तक पेमेंट कर दीजिएगा।\n' +
      PAY_BLOCK +
      'पेमेंट मिलने पर रसीद भेज दी जाएगी। अगर आप पेमेंट कर चुके हैं तो कृपया बता दीजिए।\n\n' +
      SIGN_OFF
  },
  {
    id: 'due',
    label: 'आज देय (D + 0)',
    language: 'hindi',
    active: true,
    body:
      'नमस्ते {parent_name} जी 🙏\n\n' +
      '{student_name} ({class}) की कैब फ़ीस *आज देय* है।\n\n' +
      'अवधि: {period}\n' +
      'रकम: *रु. {amount}*\n\n' +
      'कृपया आज ही पेमेंट कर दीजिए।\n' +
      PAY_BLOCK +
      'अगर पेमेंट हो चुका है तो कृपया बता दीजिए, रिकॉर्ड अपडेट कर दिया जाएगा।\n\n' +
      SIGN_OFF
  },
  {
    id: 'overdue',
    label: 'लेट (D + 5)',
    language: 'hindi',
    active: true,
    body:
      'नमस्ते {parent_name} जी 🙏\n\n' +
      '{student_name} ({class}) की कैब फ़ीस *{days_overdue} दिन* से बाकी है।\n\n' +
      'अवधि: {period}\n' +
      'रकम: *रु. {amount}*\n' +
      'देय तारीख़: {due_date}\n\n' +
      'कृपया जल्दी पेमेंट कर दीजिए।\n' +
      PAY_BLOCK +
      'अगर आप पेमेंट कर चुके हैं तो स्क्रीनशॉट भेज दीजिए, रिकॉर्ड ठीक कर दिया जाएगा। ' +
      'कोई परेशानी हो तो कृपया कॉल कर लीजिए, बात करके हल निकाल लेंगे।\n\n' +
      SIGN_OFF
  },
  {
    id: 'final',
    label: 'आख़िरी सूचना (D + 15)',
    language: 'hindi',
    active: true,
    body:
      'नमस्ते {parent_name} जी,\n\n' +
      '{student_name} ({class}) की कैब फ़ीस *{days_overdue} दिन* से बाकी है। ' +
      'पहले भी रिमाइंडर भेजा था।\n\n' +
      'रकम: *रु. {amount}*\n' +
      'देय तारीख़: {due_date}\n\n' +
      'पेमेंट न होने पर कैब सर्विस कुछ समय के लिए रोकनी पड़ सकती है, जो हम नहीं चाहते। ' +
      'कृपया आज ही पेमेंट कर दीजिए या कॉल करके बता दीजिए।\n' +
      PAY_BLOCK +
      'अगर पेमेंट हो चुका है तो कृपया तुरंत बता दीजिए।\n\n' +
      SIGN_OFF
  },
  {
    id: 'receipt',
    label: 'पेमेंट रसीद',
    language: 'hindi',
    active: true,
    body:
      'नमस्ते {parent_name} जी 🙏\n\n' +
      'आपका पेमेंट मिल गया है। बहुत धन्यवाद।\n\n' +
      'रसीद: {receipt_no}\n' +
      'बच्चा: {student_name} ({class})\n' +
      'अवधि: {period}\n' +
      'रकम: *रु. {amount}*\n' +
      'तरीका: {mode}\n' +
      'तारीख़: {paid_on}\n\n' +
      '{operator_name}\n{operator_phone}'
  }
];
