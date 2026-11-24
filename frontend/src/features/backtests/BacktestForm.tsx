import { Alert, Button, Card, Checkbox, Col, Input, InputNumber, Radio, Row, Segmented, Select, Space, Statistic, Tag, Typography } from 'antd'
import { useState, type ReactNode } from 'react'

import type { BacktestInput } from '../../domain/backtest'
import {
  BACKTEST_RULES,
  CHECKLISTS,
  calculateDraft,
  EXIT_REASONS,
  familyFor,
  quantityOf,
  reward1RiskRatio,
  SETUP_FAMILIES,
  SETUP_TYPES,
  TIMEFRAMES,
  toBacktestInput,
  type BacktestDraft,
  validateDraft,
} from '../../domain/backtest'
import type { OptionType, Segment, Side } from '../../domain/tradeGate'
import { labelOf, pnlColor, plain, ratio, rupees } from './format'

interface BacktestFormProps {
  initial: BacktestDraft
  saving: boolean
  /** The last save's error, shown above the buttons. */
  error: string | null
  onSave: (input: BacktestInput) => void
  onCancel: () => void
}

/**
 * The backtest form. The parent gives it a starting draft and remounts it (with a `key`) for each new log.
 * Segment decides which contract fields show. The summary and the blocking list come from the domain rules.
 */
export default function BacktestForm({ initial, saving, error, onSave, onCancel }: BacktestFormProps) {
  const [draft, setDraft] = useState<BacktestDraft>(initial)
  const update = (patch: Partial<BacktestDraft>) => setDraft((prev) => ({ ...prev, ...patch }))

  const isFno = draft.segment !== 'equity'
  const checklist = CHECKLISTS[draft.setupType]
  const blockers = validateDraft(draft)
  const results = calculateDraft(draft)
  const rr = reward1RiskRatio(draft)
  const rrBelowMinimum = rr !== null && rr < BACKTEST_RULES.minRewardRisk - 1e-9

  /** Switching segment keeps what the new segment uses and clears what it does not. */
  const switchSegment = (segment: Segment) =>
    update({
      segment,
      optionType: segment === 'options' ? draft.optionType : null,
      strike: segment === 'options' ? draft.strike : null,
      expiryDate: segment === 'equity' ? '' : draft.expiryDate,
      lotSize: segment === 'equity' ? null : draft.lotSize,
      lots: segment === 'equity' ? null : draft.lots,
      quantity: segment === 'equity' ? draft.quantity : null,
    })

  const submit = () => {
    const input = toBacktestInput(draft)
    if (input) onSave(input)
  }

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Card size="small" title="Setup">
        <Row gutter={[16, 12]}>
          <Col xs={24}>
            <Segmented<Segment>
              block
              value={draft.segment}
              onChange={switchSegment}
              options={[
                { label: 'Futures', value: 'futures' },
                { label: 'Options', value: 'options' },
                { label: 'Equity', value: 'equity' },
              ]}
            />
          </Col>
          <Col xs={24} md={12}>
            <Field label="Side">
              <Radio.Group
                value={draft.side}
                onChange={(e) => update({ side: e.target.value as Side })}
                options={[
                  { label: 'Buy / Long', value: 'buy' },
                  { label: 'Sell / Short', value: 'sell' },
                ]}
                optionType="button"
                buttonStyle="solid"
              />
            </Field>
          </Col>
          <Col xs={24} md={12}>
            <Field label="Instrument">
              <Input aria-label="Instrument" placeholder="e.g. NIFTY, NG, RELIANCE" value={draft.instrument} onChange={(e) => update({ instrument: e.target.value })} />
            </Field>
          </Col>
          <Col xs={24} md={12}>
            <Field label="Setup type">
              <Select
                aria-label="Setup type"
                style={{ width: '100%' }}
                value={draft.setupType}
                onChange={(setupType) => update({ setupType, setupFamily: familyFor(setupType) })}
                options={SETUP_TYPES.map((setup) => ({ value: setup.id, label: setup.label }))}
              />
            </Field>
          </Col>
          <Col xs={24} md={12}>
            <Field label="Setup family (follows the setup type)">
              <div>
                <Tag>{labelOf(SETUP_FAMILIES, draft.setupFamily)}</Tag>
              </div>
            </Field>
          </Col>
          <Col xs={24} md={12}>
            <Field label="Pattern (optional)">
              <Input aria-label="Pattern" value={draft.pattern} onChange={(e) => update({ pattern: e.target.value })} />
            </Field>
          </Col>
        </Row>
      </Card>

      <Card size="small" title="Contract">
        <Row gutter={[16, 12]}>
          {draft.segment === 'options' && (
            <Col xs={24} md={12}>
              <Field label="Option type">
                <Radio.Group
                  value={draft.optionType}
                  onChange={(e) => update({ optionType: e.target.value as OptionType })}
                  optionType="button"
                  buttonStyle="solid"
                  options={[
                    { label: 'CE (call)', value: 'CE' },
                    { label: 'PE (put)', value: 'PE' },
                  ]}
                />
              </Field>
            </Col>
          )}
          {draft.segment === 'options' && (
            <Col xs={24} md={12}>
              <Field label="Strike">
                <InputNumber aria-label="Strike" style={{ width: '100%' }} min={0} value={draft.strike} onChange={(strike) => update({ strike })} />
              </Field>
            </Col>
          )}
          {isFno && (
            <>
              <Col xs={24} md={12}>
                <Field label="Expiry date">
                  <Input type="date" aria-label="Expiry date" value={draft.expiryDate} onChange={(e) => update({ expiryDate: e.target.value })} />
                </Field>
              </Col>
              <Col xs={12} md={6}>
                <Field label="Lot size">
                  <InputNumber aria-label="Lot size" style={{ width: '100%' }} min={1} precision={0} value={draft.lotSize} onChange={(lotSize) => update({ lotSize })} />
                </Field>
              </Col>
              <Col xs={12} md={6}>
                <Field label="Lots">
                  <InputNumber aria-label="Lots" style={{ width: '100%' }} min={1} precision={0} value={draft.lots} onChange={(lots) => update({ lots })} />
                </Field>
              </Col>
              <Col xs={24}>
                <Typography.Text type="secondary">Quantity: {quantityOf(draft) ?? '—'} (lots × lot size)</Typography.Text>
              </Col>
            </>
          )}
          {draft.segment === 'equity' && (
            <Col xs={24} md={12}>
              <Field label="Quantity (shares)">
                <InputNumber aria-label="Quantity (shares)" style={{ width: '100%' }} min={1} precision={0} value={draft.quantity} onChange={(quantity) => update({ quantity })} />
              </Field>
            </Col>
          )}
        </Row>
      </Card>

      <Card size="small" title="Timeframes">
        <Row gutter={[16, 12]}>
          {(
            [
              ['Tide timeframe', 'tideTf'],
              ['Wave timeframe', 'waveTf'],
              ['Ripple timeframe', 'rippleTf'],
            ] as const
          ).map(([label, key]) => (
            <Col xs={24} md={8} key={key}>
              <Field label={label}>
                <Select
                  aria-label={label}
                  allowClear
                  style={{ width: '100%' }}
                  value={draft[key]}
                  onChange={(value) => update({ [key]: value ?? null })}
                  options={TIMEFRAMES.map((tf) => ({ value: tf.id, label: tf.label }))}
                />
              </Field>
            </Col>
          ))}
        </Row>
      </Card>

      <Card size="small" title="Entry">
        <Row gutter={[16, 12]}>
          <Col xs={12} md={6}>
            <Field label="Entry date">
              <Input type="date" aria-label="Entry date" value={draft.entryDate} onChange={(e) => update({ entryDate: e.target.value })} />
            </Field>
          </Col>
          <Col xs={12} md={6}>
            <Field label="Entry time">
              <Input type="time" aria-label="Entry time" value={draft.entryTime} onChange={(e) => update({ entryTime: e.target.value })} />
            </Field>
          </Col>
          <Col xs={12} md={4}>
            <Field label="Entry price">
              <InputNumber aria-label="Entry price" style={{ width: '100%' }} min={0} value={draft.entryPrice} onChange={(entryPrice) => update({ entryPrice })} />
            </Field>
          </Col>
          <Col xs={12} md={4}>
            <Field label="Stop loss">
              <InputNumber aria-label="Stop loss" style={{ width: '100%' }} min={0} value={draft.stopLoss} onChange={(stopLoss) => update({ stopLoss })} />
            </Field>
          </Col>
          <Col xs={12} md={4}>
            <Field label="Target 1">
              <InputNumber aria-label="Target 1" style={{ width: '100%' }} min={0} value={draft.target1} onChange={(target1) => update({ target1 })} />
            </Field>
          </Col>
          <Col xs={12} md={4}>
            <Field label="Target 2 (optional)">
              <InputNumber aria-label="Target 2" style={{ width: '100%' }} min={0} value={draft.target2} onChange={(target2) => update({ target2 })} />
            </Field>
          </Col>
          <Col xs={24}>
            <Field label="Entry criteria">
              <Input.TextArea aria-label="Entry criteria" autoSize={{ minRows: 2, maxRows: 6 }} value={draft.entryCriteria} onChange={(e) => update({ entryCriteria: e.target.value })} />
            </Field>
          </Col>
        </Row>
      </Card>

      <Card size="small" title="Exit">
        <Row gutter={[16, 12]}>
          <Col xs={12} md={6}>
            <Field label="Exit date">
              <Input type="date" aria-label="Exit date" value={draft.exitDate} onChange={(e) => update({ exitDate: e.target.value })} />
            </Field>
          </Col>
          <Col xs={12} md={6}>
            <Field label="Exit time">
              <Input type="time" aria-label="Exit time" value={draft.exitTime} onChange={(e) => update({ exitTime: e.target.value })} />
            </Field>
          </Col>
          <Col xs={12} md={6}>
            <Field label="Exit price">
              <InputNumber aria-label="Exit price" style={{ width: '100%' }} min={0} value={draft.exitPrice} onChange={(exitPrice) => update({ exitPrice })} />
            </Field>
          </Col>
          <Col xs={12} md={6}>
            <Field label="Exit reason">
              <Select
                aria-label="Exit reason"
                placeholder="Choose"
                style={{ width: '100%' }}
                value={draft.exitReason}
                onChange={(exitReason) => update({ exitReason })}
                options={EXIT_REASONS.map((reason) => ({ value: reason.id, label: reason.label }))}
              />
            </Field>
          </Col>
          <Col xs={24}>
            <Field label="Exit criteria">
              <Input.TextArea aria-label="Exit criteria" autoSize={{ minRows: 2, maxRows: 6 }} value={draft.exitCriteria} onChange={(e) => update({ exitCriteria: e.target.value })} />
            </Field>
          </Col>
        </Row>
      </Card>

      <Card size="small" title="Capital and notes">
        <Row gutter={[16, 12]}>
          <Col xs={12} md={8}>
            <Field label="Capital">
              <InputNumber aria-label="Capital" style={{ width: '100%' }} min={0} value={draft.capital} onChange={(capital) => update({ capital })} />
            </Field>
          </Col>
          <Col xs={12} md={8}>
            <Field label="Spot price (optional)">
              <InputNumber aria-label="Spot price" style={{ width: '100%' }} min={0} value={draft.spotPrice} onChange={(spotPrice) => update({ spotPrice })} />
            </Field>
          </Col>
          <Col xs={12} md={8}>
            <Field label="Margin used (optional)">
              <InputNumber aria-label="Margin used" style={{ width: '100%' }} min={0} value={draft.marginUsed} onChange={(marginUsed) => update({ marginUsed })} />
            </Field>
          </Col>
          <Col xs={24}>
            <Field label="Observations">
              <Input.TextArea aria-label="Observations" autoSize={{ minRows: 2, maxRows: 6 }} value={draft.observations} onChange={(e) => update({ observations: e.target.value })} />
            </Field>
          </Col>
          <Col xs={24} md={12}>
            <Field label="Chart link">
              <Input aria-label="Chart link" value={draft.chartLink} onChange={(e) => update({ chartLink: e.target.value })} />
            </Field>
          </Col>
          <Col xs={24}>
            <Field label="Lesson">
              <Input.TextArea aria-label="Lesson" autoSize={{ minRows: 2, maxRows: 6 }} value={draft.lesson} onChange={(e) => update({ lesson: e.target.value })} />
            </Field>
          </Col>
        </Row>
      </Card>

      <Card size="small" title="Setup checklist">
        {checklist ? (
          <Space direction="vertical">
            {checklist.map((item) => (
              <Checkbox
                key={item.id}
                checked={draft.ticks[item.id] === true}
                onChange={(e) => update({ ticks: { ...draft.ticks, [item.id]: e.target.checked } })}
              >
                {item.label}
              </Checkbox>
            ))}
          </Space>
        ) : (
          <Typography.Text type="secondary">No checklist for this setup yet. Its conditions are still to be defined.</Typography.Text>
        )}
      </Card>

      <Card size="small" title="Result">
        <Row gutter={[16, 16]}>
          <Col xs={12} md={6}><Statistic title="Quantity" value={quantityOf(draft) ?? '—'} /></Col>
          <Col xs={12} md={6}><Statistic title="Risk per unit" value={results ? plain(results.riskPerUnit) : '—'} /></Col>
          <Col xs={12} md={6}><Statistic title="Risk taken" value={results ? rupees(results.riskTaken) : '—'} /></Col>
          <Col xs={12} md={6}>
            <Statistic
              title="R:R to target 1"
              value={ratio(rr)}
              valueStyle={rrBelowMinimum ? { color: '#ff4d4f' } : undefined}
            />
          </Col>
          <Col xs={12} md={6}>
            <Statistic title="Points" value={results ? plain(results.points) : '—'} valueStyle={results ? { color: pnlColor(results.points) } : undefined} />
          </Col>
          <Col xs={12} md={6}>
            <Statistic title="P/L" value={results ? rupees(results.pnl) : '—'} valueStyle={results ? { color: pnlColor(results.pnl) } : undefined} />
          </Col>
          <Col xs={12} md={6}><Statistic title="ROI" value={results ? `${plain(results.roi)}%` : '—'} /></Col>
          <Col xs={12} md={6}>
            <Statistic title="Holding days" value={results ? results.holdingDays : '—'} />
          </Col>
          <Col xs={24}>
            {results && <Tag color={results.pnlCategory === 'win' ? 'green' : results.pnlCategory === 'loss' ? 'red' : 'default'}>{results.pnlCategory}</Tag>}
          </Col>
        </Row>
        {rrBelowMinimum && (
          <Alert style={{ marginTop: 16 }} type="warning" showIcon message={`R:R is below 1:${BACKTEST_RULES.minRewardRisk}. Save will be refused.`} />
        )}
      </Card>

      {blockers.length > 0 && (
        <ul aria-label="Why saving is blocked" style={{ margin: 0, paddingInlineStart: 20 }}>
          {blockers.map((reason) => (
            <li key={reason}>
              <Typography.Text type="secondary">{reason}</Typography.Text>
            </li>
          ))}
        </ul>
      )}
      {error && <Alert type="error" showIcon message={error} />}

      <Space>
        <Button type="primary" disabled={blockers.length > 0 || saving} loading={saving} onClick={submit}>
          Save backtest
        </Button>
        <Button onClick={onCancel}>Cancel</Button>
      </Space>
    </Space>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <Typography.Text type="secondary">{label}</Typography.Text>
      <div>{children}</div>
    </div>
  )
}
