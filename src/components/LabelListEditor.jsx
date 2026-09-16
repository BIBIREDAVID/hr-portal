const inputStyle = {
  padding: '7px 9px',
  border: '1px solid #E7EBF1',
  borderRadius: 6,
  fontSize: 13,
  flex: 1,
}

// Simple repeatable "list of labels" editor — shared by the job page
// builder's Benefits / Tasks / Requirements blocks (Section 6, job page
// builder). Each item is `{label}`; kept minimal since these render as
// plain bullet lists on the public job page, nothing more structured.
export default function LabelListEditor({ items, onChange, placeholder }) {
  function updateItem(index, label) {
    onChange(items.map((item, i) => (i === index ? { label } : item)))
  }

  function removeItem(index) {
    onChange(items.filter((_, i) => i !== index))
  }

  function addItem() {
    onChange([...items, { label: '' }])
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {items.map((item, index) => (
        <div key={index} style={{ display: 'flex', gap: 6 }}>
          <input
            style={inputStyle}
            placeholder={placeholder}
            value={item.label}
            onChange={(e) => updateItem(index, e.target.value)}
          />
          <button
            type="button"
            onClick={() => removeItem(index)}
            style={{ background: 'none', border: 'none', color: '#EF4444', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addItem}
        style={{
          alignSelf: 'flex-start',
          background: '#fff',
          border: '1px solid #E7EBF1',
          borderRadius: 7,
          padding: '6px 12px',
          fontSize: 12,
          fontWeight: 600,
          color: '#475569',
          cursor: 'pointer',
        }}
      >
        + Add
      </button>
    </div>
  )
}
