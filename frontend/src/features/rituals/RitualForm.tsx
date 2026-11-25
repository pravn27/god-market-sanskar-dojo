import { Alert, Checkbox, Form, Input, InputNumber, Select, Typography, type FormInstance } from 'antd'
import { useEffect } from 'react'

import type { RitualDefinition, RitualInput, RitualSchedule } from '../../api/client'
import { WEEKDAY_NAMES } from './schedule'

export interface RitualFormValues {
  label: string
  minutes: number
  schedule: RitualSchedule
  weekdays: number[]
  monthlyLastMarketDays: number
}

const SCHEDULE_OPTIONS: { value: RitualSchedule; label: string }[] = [
  { value: 'daily', label: 'Every day' },
  { value: 'weekdays', label: 'Selected weekdays' },
  { value: 'weekend', label: 'Weekend (Saturday and Sunday)' },
  { value: 'monthly', label: 'Last market days of the month' },
]

const WEEKDAY_OPTIONS = WEEKDAY_NAMES.map((name, index) => ({ label: name, value: index }))

interface RitualFormProps {
  /** The form instance is owned by the drawer, so its footer can submit it. */
  form: FormInstance<RitualFormValues>
  /** `null` creates a ritual; a definition edits it. */
  ritual: RitualDefinition | null
  error?: string
  onDirtyChange: (dirty: boolean) => void
  onSubmit: (input: RitualInput) => void
}

/**
 * Fields for one ritual. Validation runs on submit and on blur; a failed check shows under its field.
 * Enter in a field submits the form, as the drawer's Save button does.
 */
export default function RitualForm({ form, ritual, error, onDirtyChange, onSubmit }: RitualFormProps) {
  const schedule = Form.useWatch('schedule', form)

  useEffect(() => {
    form.setFieldsValue({
      label: ritual?.label ?? '',
      minutes: ritual?.minutes ?? 20,
      schedule: ritual?.schedule ?? 'daily',
      weekdays: ritual?.weekdays ?? [1, 2, 3, 4, 5],
      monthlyLastMarketDays: ritual?.monthlyLastMarketDays ?? 2,
    })
  }, [ritual, form])

  const finish = (values: RitualFormValues) => {
    onSubmit({
      label: values.label.trim(),
      minutes: values.minutes,
      schedule: values.schedule,
      weekdays: values.schedule === 'weekdays' ? [...values.weekdays].sort((a, b) => a - b) : null,
      monthlyLastMarketDays: values.schedule === 'monthly' ? values.monthlyLastMarketDays : null,
      // Keep the existing flag when editing; a new ritual counts only if it is daily.
      countsForStreak: ritual ? ritual.countsForStreak : values.schedule === 'daily',
    })
  }

  return (
    <div>
      <Typography.Paragraph type="secondary">
        The change applies from today. Past days keep the ritual as it was.
      </Typography.Paragraph>
      {error && <Alert type="error" showIcon style={{ marginBottom: 16 }} message={error} />}
      <Form
        form={form}
        layout="vertical"
        requiredMark="optional"
        onFinish={finish}
        onValuesChange={() => onDirtyChange(form.isFieldsTouched())}
      >
        <Form.Item
          name="label"
          label="Name"
          rules={[
            { required: true, whitespace: true, message: 'Enter a name for the ritual.' },
            { max: 120, message: 'Keep the name to 120 characters or fewer.' },
          ]}
        >
          <Input maxLength={120} showCount placeholder="For example: Chart review" autoFocus />
        </Form.Item>
        <Form.Item
          name="minutes"
          label="Time it takes"
          rules={[
            { required: true, message: 'Enter the minutes this takes.' },
            { type: 'number', min: 1, max: 240, message: 'Use 1 to 240 minutes.' },
          ]}
        >
          <InputNumber min={1} max={240} addonAfter="min" style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="schedule" label="How often">
          <Select options={SCHEDULE_OPTIONS} />
        </Form.Item>
        {schedule === 'weekdays' && (
          <Form.Item
            name="weekdays"
            label="Days"
            rules={[{ required: true, type: 'array', min: 1, message: 'Pick at least one day.' }]}
          >
            <Checkbox.Group options={WEEKDAY_OPTIONS} />
          </Form.Item>
        )}
        {schedule === 'monthly' && (
          <Form.Item
            name="monthlyLastMarketDays"
            label="How many of the last market days of the month"
            rules={[{ required: true, message: 'Enter a number from 1 to 5.' }]}
          >
            <InputNumber min={1} max={5} style={{ width: '100%' }} />
          </Form.Item>
        )}
      </Form>
    </div>
  )
}
