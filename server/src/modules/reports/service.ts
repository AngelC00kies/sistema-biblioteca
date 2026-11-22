import { reportsRepository, type Summary, type TopBook, type OverdueLoan } from './repository.js';

export const reportsService = {
  summary(): Summary & { loansByMonth: { month: string; total: number }[] } {
    return {
      ...reportsRepository.summary(),
      loansByMonth: reportsRepository.loansByMonth(),
    };
  },

  topBooks(limit?: number): TopBook[] {
    return reportsRepository.topBooks(limit);
  },

  overdue(): OverdueLoan[] {
    return reportsRepository.overdueLoans();
  },
};
