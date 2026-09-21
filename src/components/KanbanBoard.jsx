import { Link } from 'react-router-dom'
import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { STAGES } from '../lib/applications'

const stageMeta = {
  new: { label: 'New', color: '#475569', bg: '#E7EBF1' },
  screening: { label: 'Screening', color: '#8B5CF6', bg: '#F1EBFF' },
  shortlisted: { label: 'Shortlisted', color: '#3F3D69', bg: '#E9E6F2' },
  interview: { label: 'Interview', color: '#F97316', bg: '#FFEEE2' },
  offer: { label: 'Offer', color: '#F97316', bg: '#FFEEE2' },
  hired: { label: 'Hired', color: '#16A34A', bg: '#E6F7EC' },
  rejected: { label: 'Rejected', color: '#EF4444', bg: '#FDEAEA' },
}

function initials(name) {
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function KanbanCard({ app, meta, onStageChange }) {
  // A small activation distance keeps a plain click on the candidate
  // link working as navigation — dragging only kicks in once the
  // pointer has actually moved, not on every mousedown.
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: app.id })

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{
        background: '#fff',
        border: '1px solid #E7EBF1',
        borderRadius: 12,
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        boxShadow: isDragging ? '0 8px 20px rgba(15,23,42,0.15)' : '0 1px 2px rgba(15,23,42,0.04), 0 4px 12px rgba(15,23,42,0.05)',
        cursor: 'grab',
        opacity: isDragging ? 0.4 : 1,
        transform: transform ? CSS.Translate.toString(transform) : undefined,
        touchAction: 'none',
      }}
    >
      <Link
        to={`/dashboard/candidates/${app.candidate.id}`}
        onClick={(e) => isDragging && e.preventDefault()}
        style={{ display: 'flex', gap: 10, alignItems: 'center', color: 'inherit', textDecoration: 'none', minWidth: 0 }}
      >
        <div style={{ width: 30, height: 30, borderRadius: 999, background: meta.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, flex: '0 0 auto' }}>
          {initials(app.candidate.name)}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{app.candidate.name}</div>
          <div style={{ fontSize: 11.5, color: '#94A3B8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{app.job.title}</div>
        </div>
      </Link>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        {app.score != null ? <span style={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>Score {app.score}</span> : <span />}
        <select
          value={app.stage}
          onPointerDown={(e) => e.stopPropagation()}
          onChange={(e) => onStageChange(app.id, e.target.value)}
          style={{ fontSize: 11.5, border: '1px solid #E7EBF1', borderRadius: 6, padding: '3px 5px' }}
        >
          {STAGES.map((s) => (
            <option key={s} value={s}>
              {stageMeta[s].label}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

function KanbanColumn({ stage, items, onStageChange }) {
  const meta = stageMeta[stage]
  const { setNodeRef, isOver } = useDroppable({ id: stage })

  return (
    <div
      ref={setNodeRef}
      style={{
        flex: '0 0 260px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        background: isOver ? `${meta.bg}80` : 'transparent',
        borderRadius: 12,
        padding: isOver ? 6 : 0,
        transition: 'background 0.15s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 10, borderBottom: `2px solid ${meta.bg}` }}>
        <div style={{ fontSize: 12.5, fontWeight: 800, color: meta.color, letterSpacing: 0.3 }}>{meta.label.toUpperCase()}</div>
        <div style={{ fontSize: 11, fontWeight: 700, color: meta.color, background: meta.bg, padding: '2px 8px', borderRadius: 999 }}>
          {items.length}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minHeight: 60 }}>
        {items.length === 0 && !isOver && <div style={{ fontSize: 11.5, color: '#CBD5E1', padding: '4px 2px' }}>Drop here</div>}
        {items.map((app) => (
          <KanbanCard key={app.id} app={app} meta={meta} onStageChange={onStageChange} />
        ))}
      </div>
    </div>
  )
}

// Real drag-and-drop columns via @dnd-kit — dragging a card onto a
// different column's droppable area calls onStageChange the same way
// the per-card stage <select> does, so both paths stay in sync and
// the select remains as an accessible/no-drag fallback.
export default function KanbanBoard({ applications, onStageChange }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const byStage = STAGES.reduce((acc, stage) => {
    acc[stage] = applications.filter((a) => a.stage === stage)
    return acc
  }, {})

  function handleDragEnd(event) {
    const { active, over } = event
    if (!over) return
    const targetStage = over.id
    const app = applications.find((a) => a.id === active.id)
    if (app && app.stage !== targetStage) {
      onStageChange(app.id, targetStage)
    }
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div style={{ display: 'flex', gap: 20, overflowX: 'auto', paddingBottom: 8 }}>
        {STAGES.map((stage) => (
          <KanbanColumn key={stage} stage={stage} items={byStage[stage]} onStageChange={onStageChange} />
        ))}
      </div>
    </DndContext>
  )
}
