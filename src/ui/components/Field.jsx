export function Field({ label, error, required, children }) {
  return (
    <div class="field">
      <label>
        {label}
        {required && ' *'}
      </label>
      {children}
      {error && <div class="field-error">{error}</div>}
    </div>
  );
}

export function TextInput({ value, onChange, placeholder, type = 'text', inputMode }) {
  return (
    <input
      class="input"
      type={type}
      inputMode={inputMode}
      value={value ?? ''}
      placeholder={placeholder}
      onInput={(e) => onChange(e.currentTarget.value)}
    />
  );
}

export function TextArea({ value, onChange, placeholder, rows = 4 }) {
  return (
    <textarea
      class="input"
      rows={rows}
      value={value ?? ''}
      placeholder={placeholder}
      onInput={(e) => onChange(e.currentTarget.value)}
    />
  );
}
