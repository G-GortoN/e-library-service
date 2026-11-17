export type Role = "READER" | "ADMIN";
export interface User {
  id: number;
  email: string;
  displayName: string;
  role: Role;
  enabled: boolean;
  emailVerified: boolean;
}
export type BookStatus = "DRAFT" | "PUBLISHED" | "UNPUBLISHED" | "ARCHIVED";
export interface Book {
  id: number;
  title: string;
  author: string;
  isbn: string | null;
  description: string;
  category: string;
  coverUrl: string | null;
  status: BookStatus;
  available: boolean;
  borrowCount: number;
  publishedAt: string | null;
}
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
}
export interface AdminReaderInfo {
  readerId?: number;
  readerName?: string;
  readerEmail?: string;
}
export type AdminLoan = Loan & AdminReaderInfo;
export type AdminReservation = Reservation & AdminReaderInfo;
export type AdminFine = Fine & AdminReaderInfo;
export interface Loan {
  id: number;
  bookId: number;
  title: string;
  author: string;
  coverUrl: string | null;
  borrowedAt: string;
  dueAt: string;
  returnedAt: string | null;
  renewalCount: number;
  fineAmountMinor: number;
}
export interface Reservation {
  id: number;
  bookId: number;
  title: string;
  coverUrl: string | null;
  status: string;
  position: number;
  createdAt: string;
  expiresAt: string | null;
}
export interface Notification {
  id: number;
  title: string;
  body: string;
  type: string;
  read: boolean;
  createdAt: string;
}
export interface Fine {
  id: number;
  loanId: number;
  bookTitle: string;
  amountMinor: number;
  waivedMinor: number;
  status: string;
  createdAt: string;
}
export interface Audit {
  id: number;
  actor: string;
  action: string;
  target: string;
  detail: string;
  createdAt: string;
}
export interface Stats {
  books: number;
  users: number;
  activeLoans: number;
  overdueLoans: number;
  reservations: number;
  outstandingFineMinor: number;
}
export interface ImportResult {
  rows: { row: number; valid: boolean; errors: string[] }[];
  imported: number;
}
