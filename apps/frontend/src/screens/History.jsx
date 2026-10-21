import React from 'react'
import { Receipt, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import Page, { PageHeader } from '../ui/Page'
import Card, { List } from '../ui/Card'
import Button from '../ui/Button'
import BillRow from './BillRow'

export default function History({ recentBills, onViewBill, onNewBill }) {
  const { t } = useTranslation()
  return (
    <Page>
      <PageHeader title={t('billHistory.title')} meta={recentBills.length > 0 ? t('billHistory.subtitleCount', { count: recentBills.length }) : null} />
      {recentBills.length === 0 ? (
        <Card className="items-center text-center py-10">
          <span className="w-14 h-14 rounded-full bg-surface-2 text-ink-2 inline-flex items-center justify-center">
            <Receipt size={26} aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-[18px] font-semibold">{t('billHistory.noBillsYet')}</h2>
            <p className="text-[15px] text-ink-2 mt-1">{t('billHistory.noBillsBody')}</p>
          </div>
          <Button variant="primary" onClick={onNewBill}>
            <Plus size={20} aria-hidden="true" />
            {t('shell.newBill')}
          </Button>
        </Card>
      ) : (
        <List>
          {recentBills.map((bill) => (
            <BillRow key={bill.id} bill={bill} onOpen={onViewBill} />
          ))}
        </List>
      )}
    </Page>
  )
}
