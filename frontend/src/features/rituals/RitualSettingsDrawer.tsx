import { ArrowDownOutlined, ArrowUpOutlined, DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import { Alert, Button, Drawer, Empty, Form, message, Modal, Popconfirm, Skeleton, Tooltip, Typography } from 'antd'
import { useState } from 'react'

import { useDojoApi } from '../../api/DojoApiContext'
import type { RitualDefinition, RitualInput, RitualSchedule } from '../../api/client'
import RitualForm, { type RitualFormValues } from './RitualForm'
import { SCHEDULE_GROUP_LABEL, scheduleDetail } from './schedule'
import { MAX_ACTIVE_RITUALS, useRitualDefinitions, useRitualMutations } from './useRitualSettings'

interface RitualSettingsDrawerProps {
  open: boolean
  onClose: () => void
}

/** The drawer shows the list, or one ritual's form. */
type View = { mode: 'list' } | { mode: 'create' } | { mode: 'edit'; ritual: RitualDefinition }

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
  const [ritualForm] = Form.useForm<RitualFormValues>()
  const [view, setView] = useState<View>({ mode: 'list' })
  const [dirty, setDirty] = useState(false)

  const editing = view.mode !== 'list'
  const busy = mutations.create.isPending || mutations.update.isPending || mutations.retire.isPending || mutations.reorder.isPending
  const saving = mutations.create.isPending || mutations.update.isPending
  const atLimit = rituals.length >= MAX_ACTIVE_RITUALS
  const actionError = messageOf(mutations.retire.error) ?? messageOf(mutations.reorder.error) ?? messageOf(loadError)
  const formError =
    view.mode === 'create' ? messageOf(mutations.create.error) : view.mode === 'edit' ? messageOf(mutations.update.error) : undefined
  const groups = grouped(rituals)

  const openCreate = () => {
    mutations.create.reset()
    setDirty(false)
    setView({ mode: 'create' })
  }
  const openEdit = (ritual: RitualDefinition) => {
    mutations.update.reset()
    setDirty(false)
    setView({ mode: 'edit', ritual })
  }
  const backToList = () => {
    setDirty(false)
    setView({ mode: 'list' })
  }

  /** Unsaved edits are only discarded after the user confirms. */
  const confirmDiscard = (discard: () => void) => {
    if (!dirty) {
      discard()
      return
    }
    Modal.confirm({
      title: 'Discard your changes?',
      content: 'The ritual keeps the details it had before you started editing.',
      okText: 'Discard',
      okButtonProps: { danger: true },
      cancelText: 'Keep editing',
      onOk: discard,
    })
  }

  const cancelForm = () => confirmDiscard(backToList)
  const requestClose = () => confirmDiscard(() => {
    backToList()
    onClose()
  })

  const submit = (input: RitualInput) => {
    if (view.mode === 'edit') {
      const { ritual } = view
      mutations.update.mutate(
        { key: ritual.key, input },
        {
          onSuccess: () => {
            backToList()
            message.success(`Saved ${input.label}`)
          },
        },
      )
    } else {
      mutations.create.mutate(input, {
        onSuccess: () => {
          backToList()
          message.success(`Added ${input.label}`)
        },
      })
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

  const title = view.mode === 'create' ? 'Add ritual' : view.mode === 'edit' ? 'Edit ritual' : 'Ritual settings'

  return (
    <Drawer
      title={title}
      open={open}
      onClose={requestClose}
      width={460}
      destroyOnHidden
      extra={
        editing ? undefined : (
          <Tooltip title={atLimit ? `You can have up to ${MAX_ACTIVE_RITUALS} active rituals.` : undefined}>
            <Button type="primary" icon={<PlusOutlined />} disabled={atLimit || busy} onClick={openCreate}>
              Add ritual
            </Button>
          </Tooltip>
        )
      }
      footer={
        editing ? (
          <div className="ritual-form-actions">
            <Button onClick={cancelForm}>Cancel</Button>
            <Button type="primary" loading={saving} onClick={() => ritualForm.submit()}>
              {view.mode === 'edit' ? 'Save changes' : 'Add ritual'}
            </Button>
          </div>
        ) : undefined
      }
    >
      {editing ? (
        <RitualForm
          form={ritualForm}
          ritual={view.mode === 'edit' ? view.ritual : null}
          error={formError}
          onDirtyChange={setDirty}
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

          {isLoading ? (
            <Skeleton active paragraph={{ rows: 4 }} />
          ) : rituals.length === 0 ? (
            <Empty description="No rituals yet. Add the first one to start your day.">
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                Add ritual
              </Button>
            </Empty>
          ) : (
            groups.map((group) => (
              <section className="ritual-group" key={group.schedule}>
                <h3 className="ritual-group-label">{SCHEDULE_GROUP_LABEL[group.schedule]}</h3>
                {group.items.map((ritual, index) => {
                  const detail = scheduleDetail(ritual)
                  return (
                    <div className="ritual-row" key={ritual.key}>
                      <button type="button" className="ritual-row-main" disabled={busy} onClick={() => openEdit(ritual)}>
                        <span className="ritual-row-title">{ritual.label}</span>
                        <span className="ritual-row-meta">
                          <span>{ritual.minutes} min</span>
                          {detail && <span className="ritual-row-meta-detail">{detail}</span>}
                        </span>
                      </button>
                      <div className="ritual-row-actions">
                        <Tooltip title="Move up">
                          <Button
                            type="text"
                            icon={<ArrowUpOutlined />}
                            aria-label={`Move ${ritual.label} up`}
                            disabled={index === 0 || busy}
                            onClick={() => move(ritual, -1)}
                          />
                        </Tooltip>
                        <Tooltip title="Move down">
                          <Button
                            type="text"
                            icon={<ArrowDownOutlined />}
                            aria-label={`Move ${ritual.label} down`}
                            disabled={index === group.items.length - 1 || busy}
                            onClick={() => move(ritual, 1)}
                          />
                        </Tooltip>
                        <Tooltip title="Edit">
                          <Button
                            type="text"
                            icon={<EditOutlined />}
                            aria-label={`Edit ${ritual.label}`}
                            disabled={busy}
                            onClick={() => openEdit(ritual)}
                          />
                        </Tooltip>
                        <Popconfirm
                          title={`Retire ${ritual.label}?`}
                          description="It stops from today. Past days keep it."
                          okText="Retire"
                          okButtonProps={{ danger: true }}
                          cancelText="Keep"
                          onConfirm={() =>
                            mutations.retire.mutate(ritual.key, {
                              onSuccess: () => message.success(`Retired ${ritual.label}`),
                            })
                          }
                        >
                          <Tooltip title="Retire">
                            <Button
                              type="text"
                              danger
                              icon={<DeleteOutlined />}
                              aria-label={`Retire ${ritual.label}`}
                              disabled={busy}
                            />
                          </Tooltip>
                        </Popconfirm>
                      </div>
                    </div>
                  )
                })}
              </section>
            ))
          )}
        </>
      )}
    </Drawer>
  )
}
