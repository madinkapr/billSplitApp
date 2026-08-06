import React, { useState } from 'react'
import { Pencil, Trash2, UserPlus, Users, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { generateId } from '../../utils/math'

const EMOJIS = ['🏢', '🏠', '🎮', '🍕', '☕', '🎵', '🏋️', '🌴', '🎓', '💼', '🚀', '🎯', '🍻', '⚽', '🎨', '🌟']

function MemberChip({ member, onRemove }) {
  const { t } = useTranslation()
  return (
    <span className="inline-flex items-center gap-1.5 bg-desktop-chipBg rounded-full pl-1 pr-2 py-1 text-[12.5px] font-medium text-desktop-text">
      <span className="w-[26px] h-[26px] rounded-full bg-desktop-primary text-white flex items-center justify-center text-[11px] font-bold flex-shrink-0">
        {member.name.charAt(0).toUpperCase()}
      </span>
      {member.name}{member.isMe ? t('common.you') : ''}
      {onRemove && !member.isMe && (
        <button onClick={() => onRemove(member.id)} className="text-desktop-textMuted3 hover:text-red-500">
          <X size={12} />
        </button>
      )}
    </span>
  )
}

function CrewFormPanel({ crew, onSave, onCancel }) {
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
    <div className="bg-white border border-desktop-cardBorder rounded-[18px]" style={{ padding: 24, width: 380, flexShrink: 0 }}>
      <h3 className="font-bold text-[15px] text-desktop-text mb-4">
        {crew ? t('crews.editCrew', { name: crew.name }) : t('crews.newCrew')}
      </h3>

      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => setShowEmojiPicker((p) => !p)}
          className="w-12 h-12 text-xl bg-desktop-tileHome rounded-xl flex items-center justify-center flex-shrink-0"
        >
          {emoji}
        </button>
        <input
          className="flex-1 rounded-xl border border-desktop-cardBorder px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-desktop-primary/40"
          placeholder={t('crews.crewNamePlaceholder')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={30}
        />
      </div>

      {showEmojiPicker && (
        <div className="grid grid-cols-8 gap-1 p-2 bg-desktop-content rounded-xl mb-4">
          {EMOJIS.map((e) => (
            <button
              key={e}
              onClick={() => { setEmoji(e); setShowEmojiPicker(false) }}
              className={`text-xl p-1 rounded-lg ${emoji === e ? 'bg-desktop-tileHome' : 'hover:bg-white'}`}
            >
              {e}
            </button>
          ))}
        </div>
      )}

      <h4 className="text-[11.5px] font-bold uppercase tracking-wide text-desktop-textMuted3 mb-2">{t('crews.members')}</h4>
      <div className="flex flex-wrap gap-1.5 mb-3">
        {members.map((m) => (
          <MemberChip key={m.id} member={m} onRemove={removeMember} />
        ))}
      </div>

      <div className="flex gap-2 mb-5">
        <input
          className="flex-1 rounded-xl border border-desktop-cardBorder px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-desktop-primary/40"
          placeholder={t('crews.addMemberPlaceholder')}
          value={newMemberName}
          onChange={(e) => setNewMemberName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addMember()}
          maxLength={25}
        />
        <button
          onClick={addMember}
          disabled={!newMemberName.trim()}
          className="w-10 h-10 rounded-[10px] bg-desktop-primary text-white flex items-center justify-center flex-shrink-0 disabled:opacity-40"
        >
          <UserPlus size={16} />
        </button>
      </div>

      <div className="flex gap-2.5">
        <button onClick={onCancel} className="flex-1 rounded-[10px] bg-desktop-chipBg text-desktop-text font-semibold text-sm py-3">
          {t('common.cancel')}
        </button>
        <button
          onClick={handleSave}
          disabled={!name.trim()}
          className="flex-1 rounded-[10px] bg-desktop-primary text-white font-semibold text-sm py-3 disabled:opacity-40"
        >
          {t('crews.saveCrew')}
        </button>
      </div>
    </div>
  )
}

export default function DesktopCrews({ crews, setCrews, onStartBillWithCrew }) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState('new') // 'new' | crew object

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
    setEditing('new')
  }

  function deleteCrew(id) {
    setCrews((prev) => prev.filter((c) => c.id !== id))
    if (editing !== 'new' && editing?.id === id) setEditing('new')
  }

  return (
    <div style={{ padding: '40px 44px' }}>
      <div className="mb-7">
        <h1 className="text-[24px] font-extrabold text-desktop-text">{t('crews.title')}</h1>
        <p className="text-sm text-desktop-textMuted mt-1">{t('crews.subtitleCount', { count: crews.length })}</p>
      </div>

      <div className="flex gap-7 items-start">
        <div className="flex-1 min-w-0 flex flex-col gap-3">
          {crews.length === 0 ? (
            <div className="text-center py-16 bg-white border border-desktop-cardBorder rounded-2xl">
              <Users size={36} className="text-desktop-textMuted3 mx-auto mb-3" />
              <p className="text-desktop-textMuted3 text-sm">{t('crews.noCrewsYet')}</p>
            </div>
          ) : (
            crews.map((crew) => (
              <div
                key={crew.id}
                className="flex items-center gap-3.5 bg-white border border-desktop-cardBorder rounded-2xl"
                style={{ padding: '16px 18px' }}
              >
                <span className="w-11 h-11 rounded-xl bg-desktop-tileHome flex items-center justify-center text-xl flex-shrink-0">
                  {crew.emoji}
                </span>
                <span className="flex-1 min-w-0">
                  <p className="font-bold text-[15px] text-desktop-text truncate">{crew.name}</p>
                  <p className="text-[12.5px] text-desktop-textMuted3 truncate">{crew.members.map((m) => m.name).join(', ')}</p>
                </span>
                <button onClick={() => setEditing(crew)} className="w-9 h-9 flex items-center justify-center text-desktop-textMuted3 hover:text-desktop-primary rounded-lg flex-shrink-0">
                  <Pencil size={15} />
                </button>
                <button onClick={() => deleteCrew(crew.id)} className="w-9 h-9 flex items-center justify-center text-desktop-textMuted3 hover:text-red-500 rounded-lg flex-shrink-0">
                  <Trash2 size={15} />
                </button>
                <button
                  onClick={() => onStartBillWithCrew(crew)}
                  className="bg-desktop-primary text-white text-[13px] font-semibold rounded-2xl flex-shrink-0"
                  style={{ padding: '8px 16px' }}
                >
                  {t('crews.start')}
                </button>
              </div>
            ))
          )}
        </div>

        <CrewFormPanel
          key={editing === 'new' ? 'new' : editing.id}
          crew={editing === 'new' ? null : editing}
          onSave={saveCrew}
          onCancel={() => setEditing('new')}
        />
      </div>
    </div>
  )
}
