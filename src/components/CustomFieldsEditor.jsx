const FIELD_TYPES = ['text', 'textarea', 'url', 'number', 'date']

const inputStyle = {
  padding: '7px 9px',
  border: '1px solid #E7EBF1',
  borderRadius: 6,
  fontSize: 13,
}

// Editor for `jobs.custom_fields`, e.g. [{"label":"Portfolio link","type":"url","required":false}]
export default function CustomFieldsEditor({ fields, onChange }) {
  function updateField(index, patch) {
    onChange(fields.map((f, i) => (i === index ? { ...f, ...patch } : f)))
  }

  function removeField(index) {
    onChange(fields.filter((_, i) => i !== index))
  }

  function addField() {
    onChange([...fields, { label: '', type: 'text', required: false }])
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {fields.map((field, index) => (
        <div
          key={index}
          style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1fr auto auto',
            gap: 8,
            alignItems: 'center',
          }}
        >
          <input
            style={inputStyle}
            placeholder="Field label (e.g. Portfolio link)"
            value={field.label}
            onChange={(e) => updateField(index, { label: e.target.value })}
          />
          <select
            style={inputStyle}
            value={field.type}
            onChange={(e) => updateField(index, { type: e.target.value })}
          >
            {FIELD_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#475569' }}>
            <input
              type="checkbox"
              checked={field.required}
              onChange={(e) => updateField(index, { required: e.target.checked })}
            />
            Required
          </label>
          <button
            type="button"
            onClick={() => removeField(index)}
            style={{
              background: 'none',
              border: 'none',
              color: '#EF4444',
              fontSize: 12.5,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Remove
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={addField}
        style={{
          alignSelf: 'flex-start',
          background: '#fff',
          border: '1px solid #E7EBF1',
          borderRadius: 7,
          padding: '7px 12px',
          fontSize: 12.5,
          fontWeight: 600,
          color: '#475569',
          cursor: 'pointer',
        }}
      >
        + Add custom field
      </button>
    </div>
  )
}
