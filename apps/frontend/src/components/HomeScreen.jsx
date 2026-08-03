import React from 'react'
import { motion } from 'framer-motion'
import { PlusCircle, Users, Receipt, ChevronRight, Clock } from 'lucide-react'
import { fmt } from '../utils/math'

export default function HomeScreen({ crews, recentBills, onStartNewBill, onSelectCrew, onManageCrews, onViewBill, onViewAllBills }) {
  const recentCrews = crews.slice(0, 4)

  return (
    <div className="flex flex-col min-h-screen pb-8">
      {/* Header */}
      <div className="bg-indigo-600 px-5 pt-14 pb-8 text-white">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-2xl">💸</span>
          <h1 className="text-2xl font-bold tracking-tight">TabUp</h1>
        </div>
        <p className="text-indigo-200 text-sm">Split bills fairly, every time</p>
      </div>

      <div className="flex flex-col gap-4 px-5 pt-6">
        {/* Primary actions */}
        <div className="grid grid-cols-2 gap-3">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={onStartNewBill}
            className="btn-primary flex-col py-5 rounded-2xl shadow-md shadow-indigo-200"
          >
            <PlusCircle size={24} />
            <span className="text-sm mt-1">New Bill</span>
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={onManageCrews}
            className="bg-white border border-gray-200 text-gray-700 rounded-2xl font-semibold py-5 touch-btn flex flex-col items-center justify-center gap-1 active:bg-gray-50 transition-colors shadow-sm"
          >
            <Users size={24} className="text-indigo-500" />
            <span className="text-sm mt-1">My Crews</span>
          </motion.button>
        </div>

        {/* Recent Crews */}
        {recentCrews.length > 0 && (
          <div>
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Quick Start</h2>
            <div className="card divide-y divide-gray-50">
              {recentCrews.map((crew, i) => (
                <motion.button
                  key={crew.id}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => onSelectCrew(crew)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-gray-50 transition-colors first:rounded-t-2xl last:rounded-b-2xl"
                >
                  <span className="text-2xl w-10 h-10 flex items-center justify-center bg-indigo-50 rounded-xl">{crew.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm">{crew.name}</p>
                    <p className="text-xs text-gray-400">{crew.members.length} member{crew.members.length !== 1 ? 's' : ''}</p>
                  </div>
                  <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
                </motion.button>
              ))}
            </div>
          </div>
        )}

        {/* Recent Bills */}
        {recentBills.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Recent Bills</h2>
              {recentBills.length > 3 && (
                <button
                  onClick={onViewAllBills}
                  className="text-xs font-semibold text-indigo-500 active:text-indigo-600"
                >
                  View All
                </button>
              )}
            </div>
            <div className="card divide-y divide-gray-50">
              {recentBills.slice(0, 3).map((bill) => (
                <motion.button
                  key={bill.id}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => onViewBill(bill)}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-left active:bg-gray-50 transition-colors first:rounded-t-2xl last:rounded-b-2xl"
                >
                  <div className="w-10 h-10 flex items-center justify-center bg-gray-50 rounded-xl">
                    <span className="text-xl">{bill.crewEmoji || '🍽️'}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm">{bill.crewName || 'Quick Split'}</p>
                    <p className="text-xs text-gray-400">{bill.activeMembers?.length || 0} people · {fmt(bill.grandTotal || 0)}</p>
                  </div>
                  <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
                </motion.button>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {crews.length === 0 && recentBills.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-12"
          >
            <div className="text-5xl mb-4">🍕</div>
            <h3 className="font-semibold text-gray-700 mb-1">Ready to split?</h3>
            <p className="text-sm text-gray-400">Start a new bill or create a crew for your regular lunch group.</p>
          </motion.div>
        )}
      </div>
    </div>
  )
}
