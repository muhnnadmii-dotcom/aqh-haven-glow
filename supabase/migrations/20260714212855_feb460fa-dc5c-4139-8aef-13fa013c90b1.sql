CREATE OR REPLACE VIEW public.v_gateway_draft_summary
WITH (security_invoker=true) AS
WITH coll AS (
    SELECT je.source_id::bigint AS invoice_id, je.total_debit
    FROM journal_entries je
    WHERE je.source_type = 'sales_invoice_collection'::journal_source_type
      AND je.status = 'draft'::journal_entry_status
), coll_by_prov AS (
    SELECT si.payment_provider::text AS provider_code,
        count(*)::integer AS collection_drafts,
        COALESCE(sum(c_1.total_debit), 0::numeric) AS collection_total
    FROM coll c_1 JOIN sales_invoices si ON si.id = c_1.invoice_id
    GROUP BY si.payment_provider
), pay AS (
    SELECT je.source_id::uuid AS allocation_id, je.total_debit
    FROM journal_entries je
    WHERE je.source_type = 'payment_settlement_payout'::journal_source_type
      AND je.status = 'draft'::journal_entry_status
), pay_by_prov AS (
    SELECT pp.provider_code::text AS provider_code,
        count(*)::integer AS payout_drafts,
        COALESCE(sum(p_1.total_debit), 0::numeric) AS payout_total
    FROM pay p_1
        JOIN settlement_bank_allocations sba ON sba.id = p_1.allocation_id
        JOIN payment_settlements pst ON pst.id = sba.settlement_id
        JOIN payment_providers pp ON pp.id = pst.provider_id
    GROUP BY pp.provider_code
), exc AS (
    SELECT e.invoice_provider AS provider_code, e.reason,
        count(*)::integer AS exception_count,
        COALESCE(sum(e.total_amount), 0::numeric) AS exception_total
    FROM v_gateway_collection_exceptions e
    WHERE e.reason NOT IN ('safe','existing_collection')
    GROUP BY e.invoice_provider, e.reason
), exc_agg AS (
    SELECT exc.provider_code,
        sum(exc.exception_count)::integer AS exceptions_total_count,
        jsonb_object_agg(exc.reason, jsonb_build_object('count', exc.exception_count, 'total', exc.exception_total)) AS exceptions_by_reason
    FROM exc GROUP BY exc.provider_code
), providers AS (
    SELECT payment_providers.provider_code::text AS provider_code, payment_providers.name
    FROM payment_providers WHERE payment_providers.is_active
)
SELECT p.provider_code, p.name AS provider_name,
    COALESCE(c.collection_drafts, 0) AS collection_drafts,
    COALESCE(c.collection_total, 0::numeric) AS collection_total,
    COALESCE(pa.payout_drafts, 0) AS payout_drafts,
    COALESCE(pa.payout_total, 0::numeric) AS payout_total,
    COALESCE(c.collection_total, 0::numeric) - COALESCE(pa.payout_total, 0::numeric) AS expected_clearing_balance,
    COALESCE(ea.exceptions_total_count, 0) AS excluded_invoices,
    COALESCE(ea.exceptions_by_reason, '{}'::jsonb) AS exceptions_by_reason
FROM providers p
    LEFT JOIN coll_by_prov c ON c.provider_code = p.provider_code
    LEFT JOIN pay_by_prov pa ON pa.provider_code = p.provider_code
    LEFT JOIN exc_agg ea ON ea.provider_code = p.provider_code
ORDER BY p.provider_code;