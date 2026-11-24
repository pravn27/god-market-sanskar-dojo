import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import { Alert, Button, Card, Col, Descriptions, Drawer, Input, Popconfirm, Row, Segmented, Select, Space, Statistic, Table, Tag, Typography, type TableColumnsType } from 'antd'
import { useState } from 'react'
import { useLocation } from 'react-router-dom'

import type { BacktestFilters, BacktestLog, TradePlan } from '../../api/client'
import type { BacktestDraft, BacktestInput, PnlCategory, SetupType } from '../../domain/backtest'
import {
  CHECKLISTS,
  draftFromInput,
  draftFromPlan,
  EXIT_REASONS,
  emptyDraft,
  SETUP_FAMILIES,
  SETUP_TYPES,
  TIMEFRAMES,
} from '../../domain/backtest'
import type { Segment } from '../../domain/tradeGate'
import BacktestForm from './BacktestForm'
import { labelOf, pnlColor, plain, ratio, rupees } from './format'
import { useBacktests, useCreateBacktest, useDeleteBacktest, useUpdateBacktest } from './useBacktests'

const SEGMENTS: { id: Segment; label: string }[] = [
  { id: 'futures', label: 'Futures' },
  { id: 'options', label: 'Options' },
  { id: 'equity', label: 'Equity' },
]

const OUTCOMES: { id: PnlCategory; label: string }[] = [
  { id: 'win', label: 'Win' },
  { id: 'loss', label: 'Loss' },
  { id: 'breakeven', label: 'Breakeven' },
]

type SegmentFilter = Segment | 'all'

/** The Trade Gate plan that opened this page, if any. Arrives in the router's location state. */
function planFromLocation(state: unknown): TradePlan | undefined {
  return (state as { fromPlan?: TradePlan } | null)?.fromPlan
}

/** What the form drawer is editing. `logId` is null for a new log. */
interface Editor {
  open: boolean
  logId: number | null
  draft: BacktestDraft
}

export default function BacktestsPage() {
  const location = useLocation()
  const fromPlan = planFromLocation(location.state)

  const [segment, setSegment] = useState<SegmentFilter>('all')
  const [setupType, setSetupType] = useState<SetupType | undefined>(undefined)
  const [outcome, setOutcome] = useState<PnlCategory | undefined>(undefined)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [editor, setEditor] = useState<Editor>(() =>
    fromPlan ? { open: true, logId: null, draft: draftFromPlan(fromPlan) } : { open: false, logId: null, draft: emptyDraft() },
  )

  const filters: BacktestFilters = {
    segment: segment === 'all' ? undefined : segment,
    setupType,
    outcome,
    from: from || undefined,
    to: to || undefined,
  }
  const list = useBacktests(filters)
  const create = useCreateBacktest()
  const update = useUpdateBacktest()
  const remove = useDeleteBacktest()

  const logs = list.data ?? []
  const selected = logs.find((log) => log.id === selectedId) ?? null

  const openNew = () => {
    create.reset()
    setEditor({ open: true, logId: null, draft: emptyDraft() })
  }
  const openEdit = (log: BacktestLog) => {
    update.reset()
    setDetailOpen(false)
    setEditor({ open: true, logId: log.id, draft: draftFromInput(log) })
  }
  const openDetail = (log: BacktestLog) => {
    setSelectedId(log.id)
    setDetailOpen(true)
  }
  const closeEditorAndShow = (log: BacktestLog) => {
    setEditor((prev) => ({ ...prev, open: false }))
    openDetail(log)
  }

  const save = (input: BacktestInput) => {
    if (editor.logId === null) {
      create.mutate(input, { onSuccess: closeEditorAndShow })
    } else {
      update.mutate({ id: editor.logId, input }, { onSuccess: closeEditorAndShow })
    }
  }
  const saving = create.isPending || update.isPending
  const saveError = (editor.logId === null ? create.error : update.error)?.message ?? null

  const netPnl = logs.reduce((sum, log) => sum + log.pnl, 0)
  const wins = logs.filter((log) => log.pnlCategory === 'win').length
  const losses = logs.filter((log) => log.pnlCategory === 'loss').length
  const decided = wins + losses
  const winRate = decided === 0 ? null : Math.round((wins / decided) * 1000) / 10

  const columns: TableColumnsType<BacktestLog> = [
    { title: 'Entry date', dataIndex: 'entryDate', key: 'entryDate' },
    {
      title: 'Instrument',
      key: 'instrument',
      render: (_, log) => (
        <Space size={4}>
          <span>{contractLabel(log)}</span>
          <Tag>{labelOf(SEGMENTS, log.segment)}</Tag>
        </Space>
      ),
    },
    { title: 'Setup', key: 'setup', render: (_, log) => labelOf(SETUP_TYPES, log.setupType) },
    { title: 'Side', key: 'side', render: (_, log) => (log.side === 'buy' ? 'Buy' : 'Sell') },
    { title: 'Entry', dataIndex: 'entryPrice', key: 'entryPrice', align: 'right' },
    { title: 'Stop', dataIndex: 'stopLoss', key: 'stopLoss', align: 'right' },
    { title: 'T1', dataIndex: 'target1', key: 'target1', align: 'right' },
    { title: 'R:R', key: 'rr', align: 'right', render: (_, log) => ratio(log.rr1) },
    { title: 'Exit', dataIndex: 'exitPrice', key: 'exitPrice', align: 'right' },
    { title: 'Qty', dataIndex: 'quantity', key: 'quantity', align: 'right' },
    {
      title: 'P/L',
      key: 'pnl',
      align: 'right',
      render: (_, log) => <span style={{ color: pnlColor(log.pnl) }}>{rupees(log.pnl)}</span>,
    },
    {
      title: 'Result',
      key: 'result',
      render: (_, log) => <Tag color={RESULT_COLOR[log.pnlCategory]}>{log.pnlCategory}</Tag>,
    },
    { title: 'Days', dataIndex: 'holdingDays', key: 'holdingDays', align: 'right' },
    {
      title: '',
      key: 'actions',
      render: (_, log) => (
        // Stop the row's click from also opening the detail drawer.
        <span onClick={(e) => e.stopPropagation()}>
          <Space size={4}>
            <Button size="small" icon={<EditOutlined />} aria-label={`Edit backtest ${log.id}`} onClick={() => openEdit(log)} />
            <Popconfirm
              title="Delete this backtest?"
              okText="Delete"
              okButtonProps={{ danger: true }}
              onConfirm={() => remove.mutate(log.id, { onSuccess: () => setDetailOpen(false) })}
            >
              <Button size="small" danger icon={<DeleteOutlined />} aria-label={`Delete backtest ${log.id}`} />
            </Popconfirm>
          </Space>
        </span>
      ),
    },
  ]

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Typography.Title level={4} style={{ margin: 0 }}>
        Backtesting log
      </Typography.Title>

      <Card size="small">
        <Row gutter={[16, 16]}>
          <Col xs={12} md={6}><Statistic title="Logs" value={logs.length} /></Col>
          <Col xs={12} md={6}>
            <Statistic title="Net P/L" value={rupees(netPnl)} valueStyle={{ color: pnlColor(netPnl) }} />
          </Col>
          <Col xs={12} md={6}><Statistic title="Wins / losses" value={`${wins} / ${losses}`} /></Col>
          <Col xs={12} md={6}><Statistic title="Win rate" value={winRate === null ? '—' : `${winRate}%`} /></Col>
        </Row>
      </Card>

      <Space wrap>
        <Segmented<SegmentFilter>
          value={segment}
          onChange={setSegment}
          options={[{ label: 'All', value: 'all' }, ...SEGMENTS.map((s) => ({ label: s.label, value: s.id }))]}
        />
        <Select
          aria-label="Setup filter"
          allowClear
          placeholder="All setups"
          style={{ width: 170 }}
          value={setupType}
          onChange={(value) => setSetupType(value ?? undefined)}
          options={SETUP_TYPES.map((setup) => ({ value: setup.id, label: setup.label }))}
        />
        <Select
          aria-label="Outcome filter"
          allowClear
          placeholder="All outcomes"
          style={{ width: 150 }}
          value={outcome}
          onChange={(value) => setOutcome(value ?? undefined)}
          options={OUTCOMES.map((o) => ({ value: o.id, label: o.label }))}
        />
        <Input type="date" aria-label="From date" style={{ width: 160 }} value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input type="date" aria-label="To date" style={{ width: 160 }} value={to} onChange={(e) => setTo(e.target.value)} />
        <Button type="primary" icon={<PlusOutlined />} onClick={openNew}>
          New backtest
        </Button>
      </Space>

      {list.error && <Alert type="error" showIcon message={list.error.message} />}

      <Table<BacktestLog>
        size="small"
        rowKey="id"
        loading={list.isLoading}
        dataSource={logs}
        columns={columns}
        scroll={{ x: 'max-content' }}
        pagination={{ pageSize: 20, hideOnSinglePage: true }}
        locale={{ emptyText: 'No backtests yet. Log one with New backtest.' }}
        onRow={(log) => ({ onClick: () => openDetail(log), style: { cursor: 'pointer' } })}
      />

      <Drawer
        title={selected ? `${contractLabel(selected)} · ${labelOf(SETUP_TYPES, selected.setupType)}` : 'Backtest'}
        open={detailOpen && selected !== null}
        onClose={() => setDetailOpen(false)}
        width={720}
        destroyOnHidden
        extra={
          selected && (
            <Space>
              <Button icon={<EditOutlined />} onClick={() => openEdit(selected)}>Edit</Button>
            </Space>
          )
        }
      >
        {selected && <LogDetail log={selected} />}
      </Drawer>

      <Drawer
        title={editor.logId === null ? 'New backtest' : `Edit backtest ${editor.logId}`}
        open={editor.open}
        onClose={() => setEditor((prev) => ({ ...prev, open: false }))}
        width={760}
        destroyOnHidden
      >
        <BacktestForm
          key={editor.logId ?? 'new'}
          initial={editor.draft}
          saving={saving}
          error={saveError}
          onSave={save}
          onCancel={() => setEditor((prev) => ({ ...prev, open: false }))}
        />
      </Drawer>
    </Space>
  )
}

const RESULT_COLOR: Record<PnlCategory, string> = { win: 'green', loss: 'red', breakeven: 'default' }

/** "NIFTY 24000 CE" for options, the plain instrument otherwise. */
function contractLabel(log: BacktestLog): string {
  if (log.segment === 'options' && log.strike !== null && log.optionType) {
    return `${log.instrument} ${log.strike} ${log.optionType}`
  }
  return log.instrument
}

function LogDetail({ log }: { log: BacktestLog }) {
  const checklist = CHECKLISTS[log.setupType] ?? []
  const ticked = checklist.filter((item) => log.checks.some((c) => c.itemId === item.id && c.ticked))
  const side = log.side === 'buy' ? 'Buy / Long' : 'Sell / Short'
  const fno = log.segment !== 'equity'

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Descriptions bordered size="small" column={2} title="Trade">
        <Descriptions.Item label="Segment">{labelOf(SEGMENTS, log.segment)}</Descriptions.Item>
        <Descriptions.Item label="Side">{side}</Descriptions.Item>
        <Descriptions.Item label="Setup">{labelOf(SETUP_TYPES, log.setupType)}</Descriptions.Item>
        <Descriptions.Item label="Family">{labelOf(SETUP_FAMILIES, log.setupFamily)}</Descriptions.Item>
        <Descriptions.Item label="Pattern">{log.pattern ?? '—'}</Descriptions.Item>
        <Descriptions.Item label="Instrument">{log.instrument}</Descriptions.Item>
        {log.segment === 'options' && <Descriptions.Item label="Option">{log.optionType} {log.strike}</Descriptions.Item>}
        {fno && <Descriptions.Item label="Expiry">{log.expiryDate ?? '—'}</Descriptions.Item>}
        {fno && <Descriptions.Item label="Lot size × lots">{log.lotSize} × {log.lots}</Descriptions.Item>}
        <Descriptions.Item label="Quantity">{log.quantity}</Descriptions.Item>
        <Descriptions.Item label="Tide">{labelOf(TIMEFRAMES, log.tideTf)}</Descriptions.Item>
        <Descriptions.Item label="Wave">{labelOf(TIMEFRAMES, log.waveTf)}</Descriptions.Item>
        <Descriptions.Item label="Ripple">{labelOf(TIMEFRAMES, log.rippleTf)}</Descriptions.Item>
      </Descriptions>

      <Descriptions bordered size="small" column={2} title="Entry and exit">
        <Descriptions.Item label="Entry">{log.entryDate} {log.entryTime ?? ''}</Descriptions.Item>
        <Descriptions.Item label="Entry price">{log.entryPrice}</Descriptions.Item>
        <Descriptions.Item label="Stop loss">{log.stopLoss}</Descriptions.Item>
        <Descriptions.Item label="Target 1">{log.target1}</Descriptions.Item>
        <Descriptions.Item label="Target 2">{log.target2 ?? '—'}</Descriptions.Item>
        <Descriptions.Item label="Exit">{log.exitDate} {log.exitTime ?? ''}</Descriptions.Item>
        <Descriptions.Item label="Exit price">{log.exitPrice}</Descriptions.Item>
        <Descriptions.Item label="Exit reason">{labelOf(EXIT_REASONS, log.exitReason)}</Descriptions.Item>
        <Descriptions.Item label="Entry criteria" span={2}>{log.entryCriteria}</Descriptions.Item>
        <Descriptions.Item label="Exit criteria" span={2}>{log.exitCriteria ?? '—'}</Descriptions.Item>
      </Descriptions>

      <Descriptions bordered size="small" column={2} title="Result">
        <Descriptions.Item label="Capital">{rupees(log.capital)}</Descriptions.Item>
        <Descriptions.Item label="Risk per unit">{plain(log.riskPerUnit)}</Descriptions.Item>
        <Descriptions.Item label="Risk taken">{rupees(log.riskTaken)}</Descriptions.Item>
        <Descriptions.Item label="R:R to target 1">{ratio(log.rr1)}</Descriptions.Item>
        <Descriptions.Item label="Points">{plain(log.points)}</Descriptions.Item>
        <Descriptions.Item label="P/L"><span style={{ color: pnlColor(log.pnl) }}>{rupees(log.pnl)}</span></Descriptions.Item>
        <Descriptions.Item label="Return on entry">{plain(log.pct)}%</Descriptions.Item>
        <Descriptions.Item label="ROI on capital">{plain(log.roi)}%</Descriptions.Item>
        <Descriptions.Item label="Holding days">{log.holdingDays}</Descriptions.Item>
        <Descriptions.Item label="Outcome"><Tag color={RESULT_COLOR[log.pnlCategory]}>{log.pnlCategory}</Tag></Descriptions.Item>
      </Descriptions>

      <Card size="small" title="Checklist ticked">
        {checklist.length === 0 ? (
          <Typography.Text type="secondary">No checklist for this setup yet.</Typography.Text>
        ) : ticked.length === 0 ? (
          <Typography.Text type="secondary">Nothing ticked.</Typography.Text>
        ) : (
          <ul style={{ margin: 0, paddingInlineStart: 20 }}>
            {ticked.map((item) => <li key={item.id}>{item.label}</li>)}
          </ul>
        )}
      </Card>

      <Card size="small" title="Notes">
        <Descriptions column={1} size="small">
          <Descriptions.Item label="Spot price">{log.spotPrice ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="Margin used">{log.marginUsed ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="Observations">{log.observations ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="Chart link">{log.chartLink ?? '—'}</Descriptions.Item>
          <Descriptions.Item label="Lesson">{log.lesson}</Descriptions.Item>
        </Descriptions>
      </Card>
    </Space>
  )
}
