-- Track when a requester was notified about their group review
alter table reimbursement_groups
  add column if not exists notified_at timestamptz;
