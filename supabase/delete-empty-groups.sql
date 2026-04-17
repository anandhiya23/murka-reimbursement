DELETE FROM reimbursement_groups
WHERE id NOT IN (
  SELECT DISTINCT group_id_fk FROM reimbursements WHERE group_id_fk IS NOT NULL
);
