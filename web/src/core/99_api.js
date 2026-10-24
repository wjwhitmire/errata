// ---------------------------------------------------------------- the core's public surface (pure functions, no DOM, no network)
const CORE = Object.freeze({
  PRODUCT_NAME, SUITE_LINE, APP_VERSION, CreditError, TABLES, AI_SERVICE, ai_endpoint, LOCAL_MODEL, provider_request, provider_preview, provider_reply,
  ai_explain_messages, ai_tailor_messages, ai_response_messages, fact_tokens, check_rewrite, redact_text, redact_messages, split_rows, parse_csv, manual_report, parse_response, BUREAU_NAMES, RATINGS: [...RATINGS], REPORT_FORMAT,
  parse_money, money_text, parse_date, parse_month, add_days, days_between, add_months, add_months_date, month_index, month_label, us_date, long_date,
  holidays, is_business_day, add_business_days, norm_space, norm_name, edit_distance, stable_hash, weekday,
  make_lines, make_cells, clean_items, items_from_pdfjs, new_report, new_account, classify, account_id, visible_digits, rating_days, is_late,
  tu_detect, tu_parse, generic_detect, generic_parse, detect_bureau, parse_items, G_TEMPLATES, parse_terms, parse_max_delinquency, parse_hist_ranges,
  find, findings_summary, names_match, name_problem, area_code_problem, subject_of, explain,
  deadline, mail_deadlines, validation_window, collector_contact_check, next_step, reminders, ics,
  plan, candidates, utilization, cards_from_report, simulate, sol, expectations,
  generate_letter, audit_letter, same_body, letter_text, letter_paragraphs, docx, letter_pdf, pdf_doc, cover_sheet, envelope_text, zip_stored, crc32, text_width,
  diff_rounds, compare_bureaus, account_key, tradelines,
  oag_review_deadline, reporting_limit, calibrate, model_family, savings, negotiation_checklist, AGREEMENT_ITEMS, CHANGE_KINDS,
  html_walker, html_dom_lines, items_from_lines, detect_html, parse_html_lines, HTML_MAX_BYTES, HTML_NOTE,
  INTENT_KEY, INTENT_SENTENCE, FRAUD_KEY, FRAUD_SENTENCE,
});
