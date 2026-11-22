/** Tipos compartidos entre la API y la interfaz. */

export type Role = 'admin' | 'librarian' | 'member';

export type User = {
  id: number;
  username: string;
  email: string;
  full_name: string;
  role: Role;
  status: 'active' | 'inactive';
  created_at: string;
};

export type Category = {
  id: number;
  name: string;
  description: string | null;
};

export type Book = {
  id: number;
  isbn: string;
  title: string;
  author: string;
  publisher: string | null;
  publication_year: number | null;
  category_id: number | null;
  description: string | null;
  created_at: string;
  category_name: string | null;
  total_copies: number;
  available_copies: number;
};

export type Copy = {
  id: number;
  book_id: number;
  inventory_code: string;
  status: 'available' | 'loaned' | 'lost' | 'maintenance';
  condition: string;
  created_at: string;
};

export type Loan = {
  id: number;
  copy_id: number;
  user_id: number;
  loan_date: string;
  due_date: string;
  return_date: string | null;
  status: 'active' | 'returned' | 'overdue';
  fine_amount: number;
  notes: string | null;
  inventory_code: string;
  book_id: number;
  book_title: string;
  book_author: string;
  member_name: string;
  member_username: string;
  days_late: number;
};

export type Reservation = {
  id: number;
  book_id: number;
  user_id: number;
  status: 'pending' | 'ready' | 'fulfilled' | 'cancelled';
  created_at: string;
  expires_at: string;
  book_title: string;
  book_author: string;
  isbn: string;
  member_name: string;
  available_copies: number;
};

export type Fine = {
  id: number;
  loan_id: number;
  user_id: number;
  amount: number;
  reason: string;
  status: 'pending' | 'paid';
  created_at: string;
  paid_at: string | null;
  member_name: string;
  book_title: string;
  inventory_code: string;
};

export type Summary = {
  books: number;
  copies: number;
  availableCopies: number;
  members: number;
  activeLoans: number;
  overdueLoans: number;
  activeReservations: number;
  pendingFinesCount: number;
  pendingFinesAmount: number;
  loansByMonth: { month: string; total: number }[];
};

export type TopBook = {
  book_id: number;
  title: string;
  author: string;
  loan_count: number;
};

export type OverdueLoan = {
  id: number;
  book_title: string;
  inventory_code: string;
  member_name: string;
  due_date: string;
  days_late: number;
};

export type AuditEntry = {
  id: number;
  user_id: number | null;
  action: string;
  entity: string;
  entity_id: number | null;
  details: string | null;
  ip: string | null;
  created_at: string;
  username: string | null;
};

export type ApiError = {
  ok: false;
  code: string;
  message: string;
  details?: { campo: string; mensaje: string }[];
};
