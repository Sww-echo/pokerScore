import type { RoomMember, SettlementSuggestion } from '../types'

export function generateSettlementSuggestions(
  members: RoomMember[]
): SettlementSuggestion[] {
  const creditors = members
    .filter((member) => member.score > 0)
    .map((member) => ({ memberId: member.id, amount: member.score }))
    .sort((left, right) => right.amount - left.amount)

  const debtors = members
    .filter((member) => member.score < 0)
    .map((member) => ({ memberId: member.id, amount: Math.abs(member.score) }))
    .sort((left, right) => right.amount - left.amount)

  const suggestions: SettlementSuggestion[] = []

  let debtorIndex = 0
  let creditorIndex = 0

  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex]
    const creditor = creditors[creditorIndex]
    const amount = Math.min(debtor.amount, creditor.amount)

    suggestions.push({
      fromMemberId: debtor.memberId,
      toMemberId: creditor.memberId,
      amount
    })

    debtor.amount -= amount
    creditor.amount -= amount

    if (debtor.amount === 0) {
      debtorIndex += 1
    }

    if (creditor.amount === 0) {
      creditorIndex += 1
    }
  }

  return suggestions
}
