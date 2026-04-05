-- Index for filtering reimbursement_groups by requester (used in /api/init)
CREATE INDEX IF NOT EXISTS idx_reimbursement_groups_requester
  ON reimbursement_groups(requester);

-- Index for LIKE prefix scan on group_code (used in /api/postreimburse for daily count)
CREATE INDEX IF NOT EXISTS idx_reimbursement_groups_group_code
  ON reimbursement_groups(group_code);
