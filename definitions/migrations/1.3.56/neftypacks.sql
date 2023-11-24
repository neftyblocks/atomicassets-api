UPDATE neftypacks_packs p
SET use_count = usage.count
FROM (SELECT p.pack_id, p.contract, COUNT(*) count
      FROM neftypacks_packs p
      INNER JOIN atomicassets_assets a ON burned_by_account = p.contract AND a.template_id = p.pack_template_id
      WHERE p.contract = 'atomicpacksx'
        AND p.pack_template_id != -1
      GROUP BY p.pack_id, p.contract) usage
WHERE p.pack_id = usage.pack_id
  AND p.contract = usage.contract;
