import { Alert, Button, Card, Checkbox, Col, Input, InputNumber, Radio, Row, Segmented, Select, Space, Statistic, Table, Tag, Typography } from 'antd'
import { useMemo, useState } from 'react'

import {
  CONVICTION_LEVELS,
  type ConvictionLevel,
  evaluateSizing,
  riskRangeRows,
  type RiskRangeRow,
  TRADE_GATE_RULES,
  type Segment,
  type SizingInput,
} from '../../domain/tradeGate'
import { useLogTradePlan, useTradeGateStatus } from './useTradeGate'

const rupees = (value: number) => `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`

const INITIAL: SizingInput = {
  instrument: '',
  segment: 'equity',
  equityDirection: 'long',
  capital: 50_000,
  conviction: 'medium',
  entry: null,
  stopLoss: null,
  target: null,
  lotSize: null,
}

function GateStatusCard() {
  const { data: status } = useTradeGateStatus()
  return (
    <Card title="Gate status">
      <Row gutter={[16, 16]}>
        <Col xs={12} md={6}>
          <Typography.Text type="secondary">Readiness</Typography.Text>
          <div><Tag>Not yet available (E-03)</Tag></div>
        </Col>
        <Col xs={12} md={6}>
          <Typography.Text type="secondary">Locks</Typography.Text>
          <div><Tag>Not yet available (E-06)</Tag></div>
        </Col>
        <Col xs={12} md={6}>
          <Statistic title="Plans this week" value={status?.counts.weekly ?? 0} suffix={`/ ${TRADE_GATE_RULES.weeklyTradeCap}`} />
        </Col>
        <Col xs={12} md={6}>
          <Statistic title="Plans this month" value={status?.counts.monthly ?? 0} suffix={`/ ${TRADE_GATE_RULES.monthlyTradeCap}`} />
        </Col>
      </Row>
    </Card>
  )
}

type RangeLine = { key: string; label: string } & Record<string, string>

/** Horizontal risk range: conviction levels across the top, risk % and risk allowed below. */
function RiskRangeTable({ capital, conviction }: { capital: number | null; conviction: ConvictionLevel }) {
  const levels: RiskRangeRow[] = riskRangeRows(capital)
  const dataSource: RangeLine[] = [
    { key: 'pct', label: 'Risk of capital', ...Object.fromEntries(levels.map((l) => [l.id, `${l.pct}%`])) },
    {
      key: 'amount',
      label: 'Risk allowed',
      ...Object.fromEntries(levels.map((l) => [l.id, l.amount === null ? '—' : rupees(l.amount)])),
    },
  ]
  const columns = [
    { title: '', dataIndex: 'label', key: 'label', render: (label: string) => <strong>{label}</strong> },
    ...levels.map((l) => ({
      title: l.id === 'max' ? <strong>Maximum</strong> : l.label,
      dataIndex: l.id,
      key: l.id,
      align: 'right' as const,
      className: l.id === conviction ? 'risk-range-selected' : undefined,
    })),
  ]
  return (
    <div className="risk-range-table">
      <Table<RangeLine> size="small" pagination={false} rowKey="key" dataSource={dataSource} columns={columns} scroll={{ x: 'max-content' }} />
      <Typography.Text type="secondary">Above High keeps a 0.25% buffer under the 2% maximum.</Typography.Text>
    </div>
  )
}

export default function TradeGatePage() {
  const [form, setForm] = useState<SizingInput>(INITIAL)
  const [lossAccepted, setLossAccepted] = useState(false)
  const [slWithin30Seconds, setSlWithin30Seconds] = useState(false)
  const { data: status } = useTradeGateStatus()
  const logPlan = useLogTradePlan()

  const result = useMemo(() => evaluateSizing(form), [form])
  const isFno = form.segment !== 'equity'
  const update = (patch: Partial<SizingInput>) => {
    logPlan.reset()
    setForm((prev) => ({ ...prev, ...patch }))
  }

  const blockers = [...result.errors, ...(status?.capReasons ?? [])]
  if (!lossAccepted || !slWithin30Seconds) blockers.push('Tick both commitments.')
  const canLog = blockers.length === 0 && !logPlan.isPending

  const submit = () =>
    logPlan.mutate(
      { sizing: form, lossAccepted, slWithin30Seconds },
      {
        onSuccess: () => {
          setLossAccepted(false)
          setSlWithin30Seconds(false)
        },
      },
    )

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <GateStatusCard />

      <Card className="sizing-card" title="Risk and position sizing" extra={<Tag>Max risk {TRADE_GATE_RULES.maxRiskPct}% · min R:R 1:{TRADE_GATE_RULES.minRewardRisk}</Tag>}>
        <Space direction="vertical" size="middle" style={{ width: '100%', marginBottom: 24 }}>
          <div style={{ maxWidth: 320 }}>
            <Typography.Text type="secondary">Capital</Typography.Text>
            <InputNumber aria-label="Capital" style={{ width: '100%' }} min={0} value={form.capital} onChange={(capital) => update({ capital })} />
          </div>
          <RiskRangeTable capital={form.capital} conviction={form.conviction} />
        </Space>
        <Row gutter={[24, 16]}>
          <Col xs={24} md={12}>
            <Space direction="vertical" style={{ width: '100%' }}>
              <Segmented<Segment>
                block
                value={form.segment}
                onChange={(segment) => update({ segment })}
                options={[
                  { label: 'Equity', value: 'equity' },
                  { label: 'F&O Buy / Long', value: 'fno_buy' },
                  { label: 'F&O Sell / Short', value: 'fno_sell' },
                ]}
              />
              {!isFno && (
                <Radio.Group value={form.equityDirection} onChange={(e) => update({ equityDirection: e.target.value })}>
                  <Radio.Button value="long">Buy / Long</Radio.Button>
                  <Radio.Button value="short">Sell / Short</Radio.Button>
                </Radio.Group>
              )}
              <Input aria-label="Instrument" placeholder="Instrument" value={form.instrument} onChange={(e) => update({ instrument: e.target.value })} />
              <div>
                <Typography.Text type="secondary">Conviction</Typography.Text>
                <Select
                  aria-label="Conviction"
                  style={{ width: '100%' }}
                  value={form.conviction}
                  onChange={(conviction) => update({ conviction })}
                  options={CONVICTION_LEVELS.map((c) => ({ value: c.id, label: `${c.label} · ${c.pct}%` }))}
                />
              </div>
              <Row gutter={8}>
                <Col span={8}>
                  <Typography.Text type="secondary">Entry</Typography.Text>
                  <InputNumber aria-label="Entry" style={{ width: '100%' }} min={0} value={form.entry} onChange={(entry) => update({ entry })} />
                </Col>
                <Col span={8}>
                  <Typography.Text type="secondary">Stop loss</Typography.Text>
                  <InputNumber aria-label="Stop loss" style={{ width: '100%' }} min={0} value={form.stopLoss} onChange={(stopLoss) => update({ stopLoss })} />
                </Col>
                <Col span={8}>
                  <Typography.Text type="secondary">Target</Typography.Text>
                  <InputNumber aria-label="Target" style={{ width: '100%' }} min={0} value={form.target} onChange={(target) => update({ target })} />
                </Col>
              </Row>
              {isFno && (
                <div>
                  <Typography.Text type="secondary">Lot size</Typography.Text>
                  <InputNumber aria-label="Lot size" style={{ width: '100%' }} min={1} precision={0} value={form.lotSize} onChange={(lotSize) => update({ lotSize })} />
                </div>
              )}
            </Space>
          </Col>

          <Col xs={24} md={12}>
            <Row gutter={[16, 16]}>
              <Col span={12}><Statistic title="Risk allowed" value={rupees(result.riskAllowed)} /></Col>
              <Col span={12}><Statistic title="Risk per unit" value={result.riskPerUnit} /></Col>
              <Col span={12}>
                {isFno
                  ? <Statistic title="Lots" value={result.lots ?? 0} suffix={result.quantity ? `(${result.quantity} qty)` : undefined} />
                  : <Statistic title="Shares" value={result.quantity} suffix={result.maxByEntry !== null ? `(entry limit ${result.maxByEntry})` : undefined} />}
              </Col>
              <Col span={12}><Statistic title="Actual risk" value={rupees(result.actualRisk)} /></Col>
              <Col span={12}>
                <Statistic title="Reward : risk" value={result.rewardRisk === null ? '—' : `1:${result.rewardRisk}`} valueStyle={result.rewardRisk !== null && !result.rewardRiskOk ? { color: '#ff4d4f' } : undefined} />
              </Col>
              {!isFno && <Col span={12}><Statistic title="Investment" value={rupees(result.investment ?? 0)} /></Col>}
            </Row>
            {result.adjustedEntry !== null && (
              <Alert
                style={{ marginTop: 16 }}
                type="warning"
                showIcon
                message={`R:R is below 1:${TRADE_GATE_RULES.minRewardRisk}. Adjusted entry: ${result.adjustedEntry}`}
                action={<Button size="small" onClick={() => update({ entry: result.adjustedEntry })}>Use adjusted entry</Button>}
              />
            )}
            {isFno && <Typography.Paragraph type="secondary" style={{ marginTop: 16 }}>Check margin with your broker.</Typography.Paragraph>}
          </Col>
        </Row>
      </Card>

      <Card title="Commitment">
        <Space direction="vertical" style={{ width: '100%' }}>
          <Checkbox checked={lossAccepted} onChange={(e) => setLossAccepted(e.target.checked)}>
            I accept losing {rupees(result.actualRisk)} on this trade without averaging.
          </Checkbox>
          <Checkbox checked={slWithin30Seconds} onChange={(e) => setSlWithin30Seconds(e.target.checked)}>
            My stop-loss order goes in within 30 seconds of entry.
          </Checkbox>
          <Button type="primary" disabled={!canLog} onClick={submit}>Log plan</Button>
          {blockers.length > 0 && (
            <ul aria-label="Why logging is blocked" style={{ margin: 0, paddingInlineStart: 20 }}>
              {blockers.map((reason) => <li key={reason}><Typography.Text type="secondary">{reason}</Typography.Text></li>)}
            </ul>
          )}
          {logPlan.isSuccess && (
            <Alert type="success" showIcon message={`Plan saved: ${logPlan.data.instrument}, risk ${rupees(logPlan.data.actualRisk)}, R:R 1:${logPlan.data.rewardRisk}.`} />
          )}
          {logPlan.error && <Alert type="error" showIcon message={logPlan.error.message} />}
        </Space>
      </Card>
    </Space>
  )
}
