import React from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, ChevronRight } from 'lucide-react'
import { fmt } from '../utils/math'

export default function BillHistory({ recentBills, onBack, onViewBill }) {
  return (
    <div className="flex flex-col min-h-screen pb-8">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-12 pb-4">
        <button onClick={onBack} className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-bold flex-1">All Bills</h1>
      </div>

      <div className="px-5">
        {recentBills.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-5xl mb-4">🧾</div>
            <h3 className="font-semibold text-gray-700 mb-1">No bills yet</h3>
            <p className="text-sm text-gray-400">Bills you split will show up here.</p>
          </div>
        ) : (
          <div className="card divide-y divide-gray-50">
            {recentBills.map((bill) => (
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
        )}
      </div>
    </div>
  )
}
