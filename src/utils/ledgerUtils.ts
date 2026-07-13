export interface BoxTransaction {
  id: string;
  inflow: number;
  outflow: number;
  description: string;
  method: string;
  project: string;
  status: 'approved' | 'unapproved';
  attachment?: string;
  attachmentName?: string;
  updatedAt?: string;
}

export interface BoxDay {
  date: string;
  engineer?: string;
  startingBalanceOverride?: number | null;
  transactions: BoxTransaction[];
  updatedAt?: string;
}

export interface ComputedBoxDay extends BoxDay {
  computedStartingBalance: number;
  computedEndingBalance: number;
  totalInflow: number;
  totalOutflow: number;
}

/**
 * Calculates inflow for a set of transactions.
 */
export function calculateInflow(transactions: BoxTransaction[]): number {
  return (transactions || []).reduce((acc, t) => acc + (Number(t.inflow) || 0), 0);
}

/**
 * Calculates outflow for a set of transactions.
 */
export function calculateOutflow(transactions: BoxTransaction[]): number {
  return (transactions || []).reduce((acc, t) => acc + (Number(t.outflow) || 0), 0);
}

/**
 * Calculates the balances for all ledger days sequentially.
 */
export function calculateLedgerBalances(sortedDays: BoxDay[], defaultInitialBalance: number): ComputedBoxDay[] {
  let runningBalance = defaultInitialBalance;
  return sortedDays.map((day) => {
    let startingBalance = runningBalance;
    if (day.startingBalanceOverride !== undefined && day.startingBalanceOverride !== null && !isNaN(day.startingBalanceOverride)) {
      startingBalance = day.startingBalanceOverride;
    }
    const dayInflow = calculateInflow(day.transactions);
    const dayOutflow = calculateOutflow(day.transactions);
    const endingBalance = startingBalance + dayInflow - dayOutflow;
    runningBalance = endingBalance;
    return {
      ...day,
      computedStartingBalance: startingBalance,
      computedEndingBalance: endingBalance,
      totalInflow: dayInflow,
      totalOutflow: dayOutflow,
    };
  });
}
