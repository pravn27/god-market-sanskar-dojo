import { ArrowDownOutlined, ArrowUpOutlined, DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import { Alert, Button, Drawer, Popconfirm, Space, Tag, Tooltip, Typography } from 'antd'
import { useState } from 'react'

import { useDojoApi } from '../../api/DojoApiContext'
import type { RitualDefinition, RitualInput } from '../../api/client'
import RitualForm from './RitualForm'
import { describeSchedule } from './schedule'
import { MAX_ACTIVE_RITUALS, useRitualDefinitions, useRitualMutations } from './useRitualSettings'

interface RitualSettingsDrawerProps {
  open: boolean
  onClose: () => void
}

type FormState = { mode: 'closed' } | { mode: 'create' } | { mode: 'edit'; ritual: RitualDefinition }

function messageOf(error: unknown): string | undefined {
  return error instanceof Error ? error.message : undefined
}

export default function RitualSettingsDrawer({ open, onClose }: RitualSettingsDrawerProps) {
  const api = useDojoApi()
  const today = api.today()
  const { data: rituals = [], isLoading, error: loadError } = useRitualDefinitions(today, open)
  const mutations = useRitualMutations()
  const [form, setForm] = useState<FormState>({ mode: 'closed' })

  const busy = mutations.create.isPending || mutations.update.isPending || mutations.retire.isPending || mutations.reorder.isPending
  const atLimit = rituals.length >= MAX_ACTIVE_RITUALS
  const actionError =
    messageOf(mutations.retire.error) ?? messageOf(mutations.reorder.error) ?? messageOf(loadError)

  const submit = (input: RitualInput) => {
    const done = () => setForm({ mode: 'closed' })
    if (form.mode === 'edit') {
      mutations.update.mutate({ key: form.ritual.key, input }, { onSuccess: done })
    } else {
      mutations.create.mutate(input, { onSuccess: done })
    }
  }

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= rituals.length) return
    const keys = rituals.map((r) => r.key)
    ;[keys[index], keys[target]] = [keys[target], keys[index]]
    mutations.reorder.mutate(keys)
  }

  const formError =
    form.mode === 'create' ? messageOf(mutations.create.error) : form.mode === 'edit' ? messageOf(mutations.update.error) : undefined

  return (
    <Drawer title="Ritual settings" open={open} onClose={onClose} width={520} destroyOnHidden>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="Changes apply from today. Past days keep the rituals and their order as they were."
      />
      {actionError && <Alert type="error" showIcon style={{ marginBottom: 16 }} message={actionError} />}

      <Space style={{ marginBottom: 12, justifyContent: 'space-between', width: '100%' }}>
        <Typography.Text type="secondary">
          {rituals.length} of {MAX_ACTIVE_RITUALS} active rituals
        </Typography.Text>
        <Tooltip title={atLimit ? `You can have up to ${MAX_ACTIVE_RITUALS} active rituals.` : undefined}>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            disabled={atLimit || busy}
            onClick={() => setForm({ mode: 'create' })}
          >
            Add ritual
          </Button>
        </Tooltip>
      </Space>

      {isLoading && <Typography.Text type="secondary">Loading rituals…</Typography.Text>}

      {rituals.map((ritual, index) => (
        <div className="dojo-ritual-row" key={ritual.key}>
          <div>
            <Typography.Text strong>{ritual.label}</Typography.Text>
            <div>
              <Tag>{ritual.minutes} min</Tag>
              <Tag>{describeSchedule(ritual)}</Tag>
            </div>
          </div>
          <Space size="small">
            <Button
              aria-label={`Move ${ritual.label} up`}
              icon={<ArrowUpOutlined />}
              size="small"
              disabled={index === 0 || busy}
              onClick={() => move(index, -1)}
            />
            <Button
              aria-label={`Move ${ritual.label} down`}
              icon={<ArrowDownOutlined />}
              size="small"
              disabled={index === rituals.length - 1 || busy}
              onClick={() => move(index, 1)}
            />
            <Button
              aria-label={`Edit ${ritual.label}`}
              icon={<EditOutlined />}
              size="small"
              disabled={busy}
              onClick={() => setForm({ mode: 'edit', ritual })}
            />
            <Popconfirm
              title="Retire this ritual?"
              description="It stops showing from tomorrow. Past days keep it."
              okText="Retire"
              okButtonProps={{ danger: true }}
              onConfirm={() => mutations.retire.mutate(ritual.key)}
            >
              <Button
                aria-label={`Retire ${ritual.label}`}
                icon={<DeleteOutlined />}
                size="small"
                danger
                disabled={busy}
              />
            </Popconfirm>
          </Space>
        </div>
      ))}

      <RitualForm
        ritual={form.mode === 'edit' ? form.ritual : null}
        open={form.mode !== 'closed'}
        submitting={mutations.create.isPending || mutations.update.isPending}
        error={formError}
        onCancel={() => setForm({ mode: 'closed' })}
        onSubmit={submit}
      />
    </Drawer>
  )
}
