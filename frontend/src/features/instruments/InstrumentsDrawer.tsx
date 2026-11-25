import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons'
import { Alert, Button, Drawer, Empty, Form, Input, InputNumber, message, Modal, Popconfirm, Skeleton, Tooltip, Typography, type FormInstance } from 'antd'
import { useEffect, useState } from 'react'

import type { Instrument, InstrumentInput } from '../../api/client'
import { useInstrumentMutations, useInstruments } from './useInstruments'

interface InstrumentsDrawerProps {
  open: boolean
  onClose: () => void
}

interface FormValues {
  symbol: string
  lotSize: number | null
}

/** The drawer shows the list, or one instrument's form. */
type View = { mode: 'list' } | { mode: 'create' } | { mode: 'edit'; instrument: Instrument }

const SYMBOL_PATTERN = /^[A-Za-z0-9][A-Za-z0-9&._\- ]*$/

function messageOf(error: unknown): string | undefined {
  return error instanceof Error ? error.message : undefined
}

export default function InstrumentsDrawer({ open, onClose }: InstrumentsDrawerProps) {
  const { data: instruments = [], isLoading, error: loadError } = useInstruments(open)
  const mutations = useInstrumentMutations()
  const [form] = Form.useForm<FormValues>()
  const [view, setView] = useState<View>({ mode: 'list' })
  const [dirty, setDirty] = useState(false)

  const editing = view.mode !== 'list'
  const saving = mutations.create.isPending || mutations.update.isPending
  const busy = saving || mutations.remove.isPending
  const formError =
    view.mode === 'create' ? messageOf(mutations.create.error) : view.mode === 'edit' ? messageOf(mutations.update.error) : undefined
  const listError = messageOf(mutations.remove.error) ?? messageOf(loadError)
  const title = view.mode === 'create' ? 'Add instrument' : view.mode === 'edit' ? 'Edit instrument' : 'Instruments'

  const openCreate = () => {
    mutations.create.reset()
    setDirty(false)
    setView({ mode: 'create' })
  }
  const openEdit = (instrument: Instrument) => {
    mutations.update.reset()
    setDirty(false)
    setView({ mode: 'edit', instrument })
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
      content: 'The instrument keeps the details it had before you started editing.',
      okText: 'Discard',
      okButtonProps: { danger: true },
      cancelText: 'Keep editing',
      onOk: discard,
    })
  }

  const cancelForm = () => confirmDiscard(backToList)
  const requestClose = () =>
    confirmDiscard(() => {
      backToList()
      onClose()
    })

  const submit = (input: InstrumentInput) => {
    if (view.mode === 'edit') {
      const { instrument } = view
      mutations.update.mutate(
        { id: instrument.id, input },
        {
          onSuccess: () => {
            backToList()
            message.success(`Saved ${input.symbol}`)
          },
        },
      )
    } else {
      mutations.create.mutate(input, {
        onSuccess: () => {
          backToList()
          message.success(`Added ${input.symbol}`)
        },
      })
    }
  }

  return (
    <Drawer
      title={title}
      open={open}
      onClose={requestClose}
      width={460}
      destroyOnHidden
      extra={
        editing ? undefined : (
          <Button type="primary" icon={<PlusOutlined />} disabled={busy} onClick={openCreate}>
            Add instrument
          </Button>
        )
      }
      footer={
        editing ? (
          <div className="ritual-form-actions">
            <Button onClick={cancelForm}>Cancel</Button>
            <Button type="primary" loading={saving} onClick={() => form.submit()}>
              {view.mode === 'edit' ? 'Save changes' : 'Add instrument'}
            </Button>
          </div>
        ) : undefined
      }
    >
      {editing ? (
        <InstrumentFormFields
          form={form}
          instrument={view.mode === 'edit' ? view.instrument : null}
          error={formError}
          onDirtyChange={setDirty}
          onSubmit={submit}
        />
      ) : (
        <>
          <Typography.Text type="secondary" className="ritual-settings-note">
            <span>
              {instruments.length} {instruments.length === 1 ? 'instrument' : 'instruments'}
            </span>
            . Trade Gate and the backtest log choose from this list. Removing one keeps the past logs that used it.
          </Typography.Text>
          {listError && <Alert type="error" showIcon style={{ marginBottom: 16 }} message={listError} />}

          {isLoading ? (
            <Skeleton active paragraph={{ rows: 4 }} />
          ) : instruments.length === 0 ? (
            <Empty description="No instruments yet. Add the ones you trade.">
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                Add instrument
              </Button>
            </Empty>
          ) : (
            instruments.map((instrument) => (
              <div className="ritual-row" key={instrument.id}>
                <button type="button" className="ritual-row-main" disabled={busy} onClick={() => openEdit(instrument)}>
                  <span className="ritual-row-title">{instrument.symbol}</span>
                  <span className="ritual-row-meta">
                    {instrument.lotSize ? `Lot size ${instrument.lotSize}` : 'Equity, no lot size'}
                  </span>
                </button>
                <div className="ritual-row-actions">
                  <Tooltip title="Edit">
                    <Button
                      type="text"
                      icon={<EditOutlined />}
                      aria-label={`Edit ${instrument.symbol}`}
                      disabled={busy}
                      onClick={() => openEdit(instrument)}
                    />
                  </Tooltip>
                  <Popconfirm
                    title={`Remove ${instrument.symbol} from the list?`}
                    description="Past logs keep the name they used."
                    okText="Remove"
                    okButtonProps={{ danger: true }}
                    cancelText="Keep"
                    onConfirm={() =>
                      mutations.remove.mutate(instrument.id, {
                        onSuccess: () => message.success(`Removed ${instrument.symbol}`),
                      })
                    }
                  >
                    <Tooltip title="Remove">
                      <Button type="text" danger icon={<DeleteOutlined />} aria-label={`Remove ${instrument.symbol}`} disabled={busy} />
                    </Tooltip>
                  </Popconfirm>
                </div>
              </div>
            ))
          )}
        </>
      )}
    </Drawer>
  )
}

interface InstrumentFormFieldsProps {
  form: FormInstance<FormValues>
  /** `null` adds an instrument; a value edits it. */
  instrument: Instrument | null
  error?: string
  onDirtyChange: (dirty: boolean) => void
  onSubmit: (input: InstrumentInput) => void
}

/** Symbol and lot size. Submitted from the drawer footer, and by Enter in a field. */
function InstrumentFormFields({ form, instrument, error, onDirtyChange, onSubmit }: InstrumentFormFieldsProps) {
  useEffect(() => {
    form.setFieldsValue({ symbol: instrument?.symbol ?? '', lotSize: instrument?.lotSize ?? null })
  }, [instrument, form])

  const finish = (values: FormValues) => {
    // The same rule as the backend: single spaces, upper case.
    onSubmit({ symbol: values.symbol.trim().replace(/\s+/g, ' ').toUpperCase(), lotSize: values.lotSize ?? null })
  }

  return (
    <div>
      <Typography.Paragraph type="secondary">
        Symbols are stored in capitals, so NIFTY and nifty are the same instrument.
      </Typography.Paragraph>
      {error && <Alert type="error" showIcon style={{ marginBottom: 16 }} message={error} />}
      <Form form={form} layout="vertical" requiredMark="optional" onFinish={finish} onValuesChange={() => onDirtyChange(form.isFieldsTouched())}>
        <Form.Item
          name="symbol"
          label="Symbol"
          rules={[
            { required: true, whitespace: true, message: 'Enter the symbol, for example NIFTY.' },
            { max: 40, message: 'Keep the symbol to 40 characters or fewer.' },
            {
              // Check the tidied value, as the backend does: stray spaces around the symbol are not an error.
              validator: (_, value: string | undefined) => {
                const cleaned = (value ?? '').trim().replace(/\s+/g, ' ')
                if (cleaned && !SYMBOL_PATTERN.test(cleaned)) {
                  return Promise.reject(new Error('Use letters, digits, spaces and & . - _ only.'))
                }
                return Promise.resolve()
              },
            },
          ]}
        >
          <Input maxLength={40} placeholder="For example: NIFTY" autoFocus />
        </Form.Item>
        <Form.Item
          name="lotSize"
          label="Lot size"
          extra="Needed for futures and options. Leave empty for equity."
          rules={[{ type: 'number', min: 1, message: 'Use a lot size of 1 or more.' }]}
        >
          <InputNumber min={1} precision={0} placeholder="For example: 75" style={{ width: '100%' }} />
        </Form.Item>
      </Form>
    </div>
  )
}
