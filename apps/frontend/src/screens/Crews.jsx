import React, { useState } from 'react'
import { Pencil, Trash2, UserPlus, Users, X, Plus, Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { generateId } from '../utils/math'
import { useIsDesktop } from '../hooks/useIsDesktop'
import Page, { PageHeader } from '../ui/Page'
import Card, { List } from '../ui/Card'
import Button from '../ui/Button'
import Avatar from '../ui/Avatar'

const EMOJIS = ['🏢', '🏠', '🎮', '🍕', '☕', '🎵', '🏋️', '🌴', '🎓', '💼', '🚀', '🎯', '🍻', '⚽', '🎨', '🌟']

const inputClass = 'w-full min-h-[48px] px-3.5 rounded-ctl border border-line-strong bg-surface text-[16px] text-ink placeholder:text-ink-2 focus:outline focus:outline-2 focus:outline-accent focus:border-transparent'

function CrewEditor({ crew, onSave, onCancel }) {
  const { t } = useTranslation()
  const [name, setName] = useState(crew?.name || '')
  const [emoji, setEmoji] = useState(crew?.emoji || '🏢')
  const [members, setMembers] = useState(crew?.members || [{ id: 'me', name: 'Me', isMe: true }])
  const [newMemberName, setNewMemberName] = useState('')
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)

  function addMember() {
    const trimmed = newMemberName.trim()
    if (!trimmed) return
    setMembers((prev) => [...prev, { id: generateId(), name: trimmed, isMe: false }])
    setNewMemberName('')
  }

  function removeMember(id) {
    setMembers((prev) => prev.filter((m) => m.id !== id))
  }

  function handleSave() {
    if (!name.trim()) return
    onSave({ ...crew, id: crew?.id || generateId(), name: name.trim(), emoji, members })
  }

  return (
    <Card aria-labelledby="crew-editor-title">
      <h2 id="crew-editor-title" className="text-[18px] font-semibold">{crew ? t('crews.editCrew', { name: crew.name }) : t('crews.newCrew')}</h2>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setShowEmojiPicker((p) => !p)}
          aria-expanded={showEmojiPicker}
          aria-label={t('crews.chooseIcon')}
          className="w-12 h-12 flex-none rounded-ctl bg-accent-tint text-[24px] inline-flex items-center justify-center hover:ring-2 hover:ring-accent-line"
        >
          {emoji}
        </button>
        <label className="sr-only" htmlFor="crew-name">{t('crews.crewNamePlaceholder')}</label>
        <input id="crew-name" className={inputClass} placeholder={t('crews.crewNamePlaceholder')} value={name} onChange={(e) => setName(e.target.value)} maxLength={30} />
      </div>

      {showEmojiPicker && (
        <div className="grid grid-cols-8 gap-1 p-2 rounded-ctl bg-surface-2">
          {EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              aria-pressed={emoji === e}
              onClick={() => { setEmoji(e); setShowEmojiPicker(false) }}
              className={`min-h-[44px] text-[22px] rounded-lg ${emoji === e ? 'bg-accent-tint ring-2 ring-accent' : 'hover:bg-surface'}`}
            >
              {e}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <h3 className="text-[15px] font-medium text-ink-2">{t('crews.members')}</h3>
        <ul className="flex flex-wrap gap-2">
          {members.map((m) => (
            <li key={m.id} className="inline-flex items-center gap-2 min-h-[44px] pl-1.5 pr-1 rounded-full border border-line bg-surface text-[15px] font-medium">
              <Avatar size="sm" id={m.id} name={m.name} />
              <span className={m.isMe ? 'pr-3' : ''}>{m.name}{m.isMe ? t('common.you') : ''}</span>
              {!m.isMe && (
                <button type="button" onClick={() => removeMember(m.id)} aria-label={t('crews.removeMember', { name: m.name })} className="w-9 h-9 rounded-full inline-flex items-center justify-center text-ink-2 hover:bg-surface-2 hover:text-ink">
                  <X size={16} aria-hidden="true" />
                </button>
              )}
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <label className="sr-only" htmlFor="crew-add-member">{t('crews.addMemberPlaceholder')}</label>
          <input
            id="crew-add-member"
            className={inputClass}
            placeholder={t('crews.addMemberPlaceholder')}
            value={newMemberName}
            onChange={(e) => setNewMemberName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addMember()}
            maxLength={25}
          />
          <Button variant="tint" onClick={addMember} disabled={!newMemberName.trim()} aria-label={t('crews.addMember')} className="!w-12 !px-0 flex-none">
            <UserPlus size={20} aria-hidden="true" />
          </Button>
        </div>
      </div>

      <div className="flex gap-2">
        <Button block onClick={onCancel}>{t('common.cancel')}</Button>
        <Button block variant="primary" onClick={handleSave} disabled={!name.trim()}>
          <Check size={20} aria-hidden="true" />
          {t('crews.saveCrew')}
        </Button>
      </div>
    </Card>
  )
}

// Saved groups. Phones: the list, with the editor opening above it. Desktop: list on the
// left, the editor (a new crew by default) always open on the right.
export default function Crews({ crews, setCrews, onStartBillWithCrew, startWithNew = false }) {
  const { t } = useTranslation()
  const isDesktop = useIsDesktop()
  const [editing, setEditing] = useState(startWithNew ? 'new' : null) // null | 'new' | crew

  function saveCrew(crew) {
    setCrews((prev) => {
      const idx = prev.findIndex((c) => c.id === crew.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = crew
        return next
      }
      return [...prev, crew]
    })
    setEditing(null)
  }

  function deleteCrew(id) {
    setCrews((prev) => prev.filter((c) => c.id !== id))
    if (editing && editing !== 'new' && editing.id === id) setEditing(null)
  }

  const editorTarget = editing ?? (isDesktop ? 'new' : null)

  return (
    <Page>
      <PageHeader
        title={t('crews.title')}
        meta={crews.length > 0 ? t('crews.subtitleCount', { count: crews.length }) : null}
        actions={
          !editing && !isDesktop && crews.length > 0 && (
            <Button size="sm" variant="tint" onClick={() => setEditing('new')}>
              <Plus size={18} aria-hidden="true" />
              {t('crews.new')}
            </Button>
          )
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-8 lg:items-start">
        {editorTarget && (
          <div className="lg:order-2 lg:sticky lg:top-10">
            <CrewEditor
              key={editorTarget === 'new' ? 'new' : editorTarget.id}
              crew={editorTarget === 'new' ? null : editorTarget}
              onSave={saveCrew}
              onCancel={() => setEditing(null)}
            />
          </div>
        )}

        <div className="lg:order-1 min-w-0">
          {crews.length === 0 ? (
            !editorTarget || isDesktop ? (
              <Card className="items-center text-center py-10">
                <span className="w-14 h-14 rounded-full bg-surface-2 text-ink-2 inline-flex items-center justify-center">
                  <Users size={26} aria-hidden="true" />
                </span>
                <p className="text-[15px] text-ink-2 max-w-sm">{t('crews.noCrewsYet')}</p>
                {!isDesktop && (
                  <Button variant="primary" onClick={() => setEditing('new')}>
                    <Plus size={20} aria-hidden="true" />
                    {t('crews.createFirstCrew')}
                  </Button>
                )}
              </Card>
            ) : null
          ) : (
            <List as="ul">
              {crews.map((crew) => (
                <li key={crew.id} className="flex items-center gap-3 min-h-[68px] px-4 py-3">
                  <Avatar square size="lg" id={crew.id} name={crew.name} className="text-[20px]">{crew.emoji || undefined}</Avatar>
                  <span className="flex-1 min-w-0">
                    <b className="block text-[16px] font-semibold truncate">{crew.name}</b>
                    <small className="block text-[14px] text-ink-2 truncate">{crew.members.map((m) => m.name).join(', ')}</small>
                  </span>
                  <Button icon variant="secondary" className="!border-transparent" onClick={() => setEditing(crew)} aria-label={t('crews.editAria', { name: crew.name })}>
                    <Pencil size={18} aria-hidden="true" />
                  </Button>
                  <Button icon variant="secondary" className="!border-transparent" onClick={() => deleteCrew(crew.id)} aria-label={t('crews.deleteAria', { name: crew.name })}>
                    <Trash2 size={18} aria-hidden="true" />
                  </Button>
                  <Button size="sm" variant="primary" onClick={() => onStartBillWithCrew(crew)}>
                    {t('crews.start')}
                  </Button>
                </li>
              ))}
            </List>
          )}
        </div>
      </div>
    </Page>
  )
}
