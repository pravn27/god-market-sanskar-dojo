import { ArrowDownOutlined, ArrowUpOutlined, DeleteOutlined, MoreOutlined, PlusOutlined } from '@ant-design/icons'
import { Alert, Button, Drawer, Tooltip, Typography } from 'antd'
import { useState } from 'react'

import { useDojoApi } from '../../api/DojoApiContext'
import type { RitualDefinition, RitualInput, RitualSchedule } from '../../api/client'
import RitualForm from './RitualForm'
import { SCHEDULE_GROUP_LABEL, scheduleDetail } from './schedule'
import { MAX_ACTIVE_RITUALS, useRitualDefinitions, useRitualMutations } from './useRitualSettings'

interface RitualSettingsDrawerProps {
  open: boolean
  onClose: () => void
}

type FormState = { mode: 'closed' } | { mode: 'create' } | { mode: 'edit'; ritual: RitualDefinition }

const GROUP_ORDER: RitualSchedule[] = ['daily', 'weekdays', 'weekend', 'monthly']

function messageOf(error: unknown): string | undefined {
  return error instanceof Error ? error.message : undefined
}

function grouped(rituals: RitualDefinition[]): { schedule: RitualSchedule; items: RitualDefinition[] }[] {
  return GROUP_ORDER.map((schedule) => ({
    schedule,
    items: rituals.filter((ritual) => ritual.schedule === schedule),
  })).filter((group) => group.items.length > 0)
}

export default function RitualSettingsDrawer({ open, onClose }: RitualSettingsDrawerProps) {
  const api = useDojoApi()
  const today = api.today()
  const { data: rituals = [], isLoading, error: loadError } = useRitualDefinitions(today, open)
  const mutations = useRitualMutations()
  const [form, setForm] = useState<FormState>({ mode: 'closed' })
  const [menuKey, setMenuKey] = useState<string | null>(null)
  const [retireKey, setRetireKey] = useState<string | null>(null)

  const busy = mutations.create.isPending || mutations.update.isPending || mutations.retire.isPending || mutations.reorder.isPending
  const atLimit = rituals.length >= MAX_ACTIVE_RITUALS
  const actionError = messageOf(mutations.retire.error) ?? messageOf(mutations.reorder.error) ?? messageOf(loadError)
  const groups = grouped(rituals)

  const closeForm = () => setForm({ mode: 'closed' })

  const submit = (input: RitualInput) => {
    if (form.mode === 'edit') {
      mutations.update.mutate({ key: form.ritual.key, input }, { onSuccess: closeForm })
    } else {
      mutations.create.mutate(input, { onSuccess: closeForm })
    }
  }

  const move = (ritual: RitualDefinition, direction: -1 | 1) => {
    const next = groups.map((group) => {
      if (group.schedule !== ritual.schedule) return group.items
      const index = group.items.findIndex((item) => item.key === ritual.key)
      const target = index + direction
      if (index < 0 || target < 0 || target >= group.items.length) return group.items
      const items = [...group.items]
      ;[items[index], items[target]] = [items[target], items[index]]
      return items
    })
    mutations.reorder.mutate(next.flat().map((item) => item.key))
  }

  const formError =
    form.mode === 'create' ? messageOf(mutations.create.error) : form.mode === 'edit' ? messageOf(mutations.update.error) : undefined

  const title = form.mode === 'create' ? 'Add ritual' : form.mode === 'edit' ? 'Edit ritual' : 'Ritual settings'

  return (
    <Drawer
      title={title}
      open={open}
      onClose={onClose}
      width={440}
      destroyOnHidden
      extra={
        form.mode === 'closed' ? (
          <Tooltip title={atLimit ? `You can have up to ${MAX_ACTIVE_RITUALS} active rituals.` : undefined}>
            <Button type="primary" icon={<PlusOutlined />} disabled={atLimit || busy} onClick={() => setForm({ mode: 'create' })}>
              Add ritual
            </Button>
          </Tooltip>
        ) : undefined
      }
    >
      {form.mode !== 'closed' ? (
        <RitualForm
          ritual={form.mode === 'edit' ? form.ritual : null}
          submitting={mutations.create.isPending || mutations.update.isPending}
          error={formError}
          onCancel={closeForm}
          onSubmit={submit}
        />
      ) : (
        <>
          <Typography.Text type="secondary" className="ritual-settings-note">
            <span>
              {rituals.length} of {MAX_ACTIVE_RITUALS} active rituals
            </span>
            . Changes apply from today. Past days keep the rituals and their order as they were.
          </Typography.Text>
          {actionError && <Alert type="error" showIcon style={{ marginBottom: 16 }} message={actionError} />}
          {isLoading && <Typography.Text type="secondary">Loading rituals…</Typography.Text>}

          {groups.map((group) => (
            <section className="ritual-group" key={group.schedule}>
              <h3 className="ritual-group-label">{SCHEDULE_GROUP_LABEL[group.schedule]}</h3>
              {group.items.map((ritual, index) => {
                const detail = scheduleDetail(ritual)
                return (
                  <div className="ritual-row" key={ritual.key}>
                    <button
                      type="button"
                      className="ritual-row-main"
                      aria-label={`Edit ${ritual.label}`}
                      disabled={busy}
                      onClick={() => setForm({ mode: 'edit', ritual })}
                    >
                      <span className="ritual-row-title">{ritual.label}</span>
                      <span className="ritual-row-meta">
                        <span>{ritual.minutes} min</span>
                        {detail && <span className="ritual-row-meta-detail">{detail}</span>}
                      </span>
                    </button>
                    <Button
                      type="text"
                      aria-label={`Actions for ${ritual.label}`}
                      aria-expanded={menuKey === ritual.key}
                      icon={<MoreOutlined />}
                      disabled={busy}
                      onClick={() => {
                        setRetireKey(null)
                        setMenuKey((current) => (current === ritual.key ? null : ritual.key))
                      }}
                    />
                    {menuKey === ritual.key && (
                      <div className="ritual-row-menu" role="menu" aria-label={`Actions for ${ritual.label}`}>
                        {retireKey === ritual.key ? (
                          <div className="ritual-row-confirm">
                            <p>Retire this ritual? It stops from today. Past days keep it.</p>
                            <button type="button" className="danger" onClick={() => mutations.retire.mutate(ritual.key)}>
                              Retire
                            </button>
                            <button type="button" onClick={() => setRetireKey(null)}>
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <>
                            <button
                              type="button"
                              role="menuitem"
                              disabled={index === 0 || busy}
                              onClick={() => {
                                setMenuKey(null)
                                move(ritual, -1)
                              }}
                            >
                              <ArrowUpOutlined aria-hidden /> Move {ritual.label} up
                            </button>
                            <button
                              type="button"
                              role="menuitem"
                              disabled={index === group.items.length - 1 || busy}
                              onClick={() => {
                                setMenuKey(null)
                                move(ritual, 1)
                              }}
                            >
                              <ArrowDownOutlined aria-hidden /> Move {ritual.label} down
                            </button>
                            <button
                              type="button"
                              role="menuitem"
                              className="danger"
                              disabled={busy}
                              onClick={() => setRetireKey(ritual.key)}
                            >
                              <DeleteOutlined aria-hidden /> Retire {ritual.label}
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </section>
          ))}
        </>
      )}
    </Drawer>
  )
}
