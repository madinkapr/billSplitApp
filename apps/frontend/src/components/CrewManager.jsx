import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Plus, Trash2, Edit3, Check, X, UserPlus, ChevronRight, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { generateId } from '../utils/math'

const EMOJIS = ['🏢', '🏠', '🎮', '🍕', '☕', '🎵', '🏋️', '🌴', '🎓', '💼', '🚀', '🎯', '🍻', '⚽', '🎨', '🌟']

function MemberRow({ member, onRemove, canRemove }) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center gap-3 py-2.5">
      <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-semibold text-sm flex-shrink-0">
        {member.name.charAt(0).toUpperCase()}
      </div>
      <span className="flex-1 text-sm font-medium text-gray-800">{member.name}{member.isMe ? t('common.you') : ''}</span>
      {canRemove && (
        <button onClick={() => onRemove(member.id)} className="w-8 h-8 flex items-center justify-center text-gray-300 hover:text-red-400 transition-colors rounded-full">
          <Trash2 size={15} />
        </button>
      )}
    </div>
  )
}

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
    <div className="flex flex-col gap-5">
      {/* Emoji + Name */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setShowEmojiPicker((p) => !p)}
          className="w-14 h-14 text-2xl bg-indigo-50 rounded-2xl flex items-center justify-center flex-shrink-0 border-2 border-transparent active:border-indigo-300 transition-colors"
        >
          {emoji}
        </button>
        <input
          className="input-field flex-1"
          placeholder={t('crews.crewNamePlaceholder')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={30}
        />
      </div>

      {/* Emoji Picker */}
      <AnimatePresence>
        {showEmojiPicker && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-8 gap-1 p-3 bg-gray-50 rounded-xl">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  onClick={() => { setEmoji(e); setShowEmojiPicker(false) }}
                  className={`text-2xl p-1 rounded-lg transition-colors ${emoji === e ? 'bg-indigo-100' : 'hover:bg-gray-100'}`}
                >
                  {e}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Members */}
      <div>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{t('crews.members')}</h3>
        <div className="card px-4 divide-y divide-gray-50">
          {members.map((m) => (
            <MemberRow key={m.id} member={m} onRemove={removeMember} canRemove={!m.isMe} />
          ))}
        </div>

        {/* Add member */}
        <div className="flex gap-2 mt-3">
          <input
            className="input-field flex-1"
            placeholder={t('crews.addMemberPlaceholder')}
            value={newMemberName}
            onChange={(e) => setNewMemberName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addMember()}
            maxLength={25}
          />
          <button
            onClick={addMember}
            disabled={!newMemberName.trim()}
            className="btn-primary px-4 py-3 flex-shrink-0 disabled:opacity-40"
          >
            <UserPlus size={18} />
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button onClick={onCancel} className="btn-secondary flex-1">{t('common.cancel')}</button>
        <button onClick={handleSave} disabled={!name.trim()} className="btn-primary flex-1">
          <Check size={18} /> {t('crews.saveCrew')}
        </button>
      </div>
    </div>
  )
}

export default function CrewManager({ crews, setCrews, onBack, onStartBillWithCrew }) {
  const { t } = useTranslation()
  const [editing, setEditing] = useState(null) // null | 'new' | crew object

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
  }

  return (
    <div className="flex flex-col min-h-screen pb-8">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-12 pb-4">
        <button onClick={onBack} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-bold flex-1">{t('crews.title')}</h1>
        {!editing && (
          <button onClick={() => setEditing('new')} className="btn-ghost">
            <Plus size={16} /> {t('crews.new')}
          </button>
        )}
      </div>

      <div className="px-5 flex flex-col gap-4">
        {/* Editor */}
        <AnimatePresence mode="wait">
          {editing && (
            <motion.div
              key="editor"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="card p-5"
            >
              <h2 className="font-bold text-gray-800 mb-4">{editing === 'new' ? t('crews.newCrew') : t('crews.editCrew', { name: editing.name })}</h2>
              <CrewEditor
                crew={editing === 'new' ? null : editing}
                onSave={saveCrew}
                onCancel={() => setEditing(null)}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Crew list */}
        {!editing && (
          <>
            {crews.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-16"
              >
                <Users size={40} className="text-gray-200 mx-auto mb-3" />
                <p className="text-gray-400 text-sm">{t('crews.noCrewsYet')}</p>
                <button onClick={() => setEditing('new')} className="btn-primary mt-4 mx-auto w-auto px-6">
                  <Plus size={16} /> {t('crews.createFirstCrew')}
                </button>
              </motion.div>
            ) : (
              <div className="card divide-y divide-gray-50">
                {crews.map((crew) => (
                  <div key={crew.id} className="flex items-center gap-3 px-4 py-3.5">
                    <span className="text-2xl">{crew.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm">{crew.name}</p>
                      <p className="text-xs text-gray-400">{crew.members.map((m) => m.name).join(', ')}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setEditing(crew)} className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-indigo-500 transition-colors rounded-xl">
                        <Edit3 size={15} />
                      </button>
                      <button onClick={() => deleteCrew(crew.id)} className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-red-400 transition-colors rounded-xl">
                        <Trash2 size={15} />
                      </button>
                      <button onClick={() => onStartBillWithCrew(crew)} className="ml-1 btn-primary text-xs px-3 py-2 rounded-lg">
                        {t('crews.start')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
