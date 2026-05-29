interface Props {
  status: 'accepted' | 'attempted' | 'unattempted'
}

const variants: Record<string, { bg: string; text: string; label: string }> = {
  accepted: { bg: 'rgba(0,175,155,0.15)', text: 'var(--green)', label: '已通过' },
  attempted: { bg: 'rgba(255,184,0,0.12)', text: 'var(--yellow)', label: '已尝试' },
  unattempted: { bg: 'rgba(160,160,160,0.06)', text: 'var(--text-tertiary)', label: '未开始' },
}

export default function StatusBadge({ status }: Props) {
  const v = variants[status]
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold shrink-0"
      style={{ background: v.bg, color: v.text }}
    >
      {status === 'accepted' && <CheckIcon />}
      {v.label}
    </span>
  )
}

function CheckIcon() {
  return (
    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  )
}
