// js/transactionService.js

/**
 * Calculates the aggregate monthly totals from an array of report entries.
 * Each entry is expected to have 'savings' (deposit), 'savingsWithdrawal',
 * 'loanDisbursed', and 'loanRepayment' properties.
 *
 * @param {Array<Object>} reportEntries - An array of entry objects.
 * Example entry: { savings: 100, savingsWithdrawal: 20, loanDisbursed: 50, loanRepayment: 10, ... }
 * @returns {Object} An object containing the calculated monthly totals:
 * {
 * monthlyTotalSavingsDeposit: number,
 * monthlyTotalSavingsWithdrawal: number,
 * netMonthlySavingsChange: number,
 * monthlyTotalLoanDisbursed: number,
 * monthlyTotalLoanRepaid: number,
 * netMonthlyLoanChange: number
 * }
 */
export function calculateMonthlyTotals(reportEntries) {
    let monthlyTotalSavingsDeposit = 0;
    let monthlyTotalSavingsWithdrawal = 0; // For total withdrawals in the month
    let monthlyTotalLoanDisbursed = 0;
    let monthlyTotalLoanRepaid = 0;

    if (reportEntries && Array.isArray(reportEntries)) {
        reportEntries.forEach(entry => {
            monthlyTotalSavingsDeposit += (Number(entry.savings) || 0); // 'savings' field is treated as deposit
            monthlyTotalSavingsWithdrawal += (Number(entry.savingsWithdrawal) || 0); // Sum withdrawals
            monthlyTotalLoanDisbursed += (Number(entry.loanDisbursed) || 0);
            monthlyTotalLoanRepaid += (Number(entry.loanRepayment) || 0);
        });
    }

    const netMonthlySavingsChange = monthlyTotalSavingsDeposit - monthlyTotalSavingsWithdrawal;
    const netMonthlyLoanChange = monthlyTotalLoanDisbursed - monthlyTotalLoanRepaid;

    return {
        monthlyTotalSavingsDeposit,       // Total amount deposited as savings
        monthlyTotalSavingsWithdrawal,    // Total amount withdrawn from savings
        netMonthlySavingsChange,          // Net change in savings for the month (this is what affects cumulative)
        monthlyTotalLoanDisbursed,
        monthlyTotalLoanRepaid,
        netMonthlyLoanChange
    };
}

// --- Placeholder for future transaction processing functions ---

/**
 * Processes a savings withdrawal transaction (more detailed logic).
 * This would involve more complex logic like checking available balance, maturity, etc.
 * For now, the monthly report just aggregates the entered withdrawal amounts.
 *
 * @param {string} memberId - The ID of the member.
 * @param {number} withdrawalAmount - The amount to withdraw.
 * @param {Object} memberData - Current financial data for the member (e.g., total savings).
 * @returns {Promise<Object>} Result of the withdrawal processing.
 */
// export async function processSavingsWithdrawal(memberId, withdrawalAmount, memberData) { /* ... */ }


/**
 * More detailed loan repayment processing.
 * Could apply repayment to specific loans, calculate principal/interest components.
 *
 * @param {string} memberId
 * @param {number} repaymentAmount
 * @param {string} loanIdToRepay - If tracking individual loans
 * @returns {Promise<Object>}
 */
// export async function processDetailedLoanRepayment(memberId, repaymentAmount, loanIdToRepay) { /* ... */ }
