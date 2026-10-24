// ---------------------------------------------------------------- normalized model (twin of model.py)
const REPORT_FORMAT = "errata-report";
const REPORT_VERSION = 1;
const BUREAU_NAMES = { transunion: "TransUnion", experian: "Experian", equifax: "Equifax", unknown: "Unknown bureau" };
const RATING_DAYS = { OK: 0, C: 0, "0": 0, "30": 30, "60": 60, "90": 90, "120": 120, "150": 150, "180": 180, "C/O": 180, CO: 180, COL: 180,
  VS: 180, RPO: 180, FC: 180, BK: null, X: null, "N/R": null, NR: null, ND: null, "-": null, "": null };
const RATINGS = new Set(Object.keys(RATING_DAYS));
const DEROG_RATINGS = new Set(["C/O", "CO", "COL", "VS", "RPO", "FC"]);
function rating_days(r) { const k = String(r || "").toUpperCase(); return own(RATING_DAYS, k) ? RATING_DAYS[k] : null; }
function is_late(r) { const d = rating_days(r); return d !== null && d >= 30; }
function isDigits(s) { return /^\d+$/.test(s || ""); }
function new_report(bureau) {
  return {
    format: REPORT_FORMAT, version: REPORT_VERSION, bureau: bureau || "unknown",
    source: { kind: "manual", parser: "", file_number: "", report_date: "", confidence: 0, pages: 0 },
    personal: { names: [], ssn_masked: "", ssn_last4: "", dob: "", on_file_since: "", addresses: [], phones: [], employers: [] },
    accounts: [], public_records: [], inquiries: [], statements: [], messages: [], specialty: [], warnings: [],
  };
}
function new_account() {
  return {
    id: "", name: "", number: "", address: "", phone: "", monthly_payment: null, opened: "", responsibility: "", account_type: "",
    loan_type: "", balance: null, updated: "", payment_received: null, last_payment: "", original_creditor: "", pay_status: "",
    pay_status_adverse: false, terms: { text: "", amount: null, months: null, frequency: "" }, closed: "", paid: "", high_balance: null,
    high_balance_hist: "", credit_limit: null, credit_limit_hist: "", max_delinquency: { text: "", days: null, entries: [] }, removal: "",
    remarks: [], past_due: null, dofd: "", history: [], section: "", kind: "", flags: [], confidence: 0, raw: {},
  };
}
const COLLECTION_TYPES = /FACTORING|COLLECTION|DEBT BUYER|DEBT PURCHASER|RECOVERY/i;
const COLLECTION_STATUS = /COLLECTION|PLACED FOR COLLECTION|\bCOL\b/i;
const CHARGEOFF = /CHARGE.?OFF|CHARGED OFF|\bC\/O\b|PROFIT AND LOSS|\bPRL\b/i;
const PAID_STATUS = /\bPAID\b/i;
const PAID_AS_AGREED = /PAID AS AGREED|PAYING AS AGREED|NEVER LATE/i;
const TRANSFERRED = /TRANSFER|SOLD|PURCHASED BY ANOTHER|\bTRL\b|\bTTR\b|\bPAL\b|\bACT\b/i;
const BANKRUPTCY = /BANKRUPTCY|\bBKL\b|CHAPTER (7|11|12|13)/i;
const DISPUTED = /DISPUTE|\bAID\b|\bXB\b/i;
const MEDICAL = /MEDICAL|HOSPITAL|HEALTH|CLINIC|PHYSICIAN|ANESTHES|RADIOLOG|AMBULANCE|EMERGENCY ROOM|PATHOLOG|DENTAL|ORTHOPED|PEDIATRIC|SURGERY|SURGICAL|URGENT CARE|LABORATOR/i;
const STUDENT = /STUDENT|EDUCATION|DEPT OF ED|DEPARTMENT OF ED|NELNET|MOHELA|AIDVANTAGE|EDFINANCIAL|NAVIENT/i;
const CHILD_SUPPORT = /CHILD SUPPORT|SUPPORT ENFORCEMENT|FAMILY SUPPORT/i;
const GOVERNMENT = /ATTORNEY GENERAL|DEPARTMENT OF|DEPT OF|STATE OF|\bCOUNTY\b|CITY OF|\bU\.S\.|UNITED STATES|\bUS DEPT|TREASURY|CHILD SUPPORT|SUPPORT ENFORCEMENT|INTERNAL REVENUE/i;
const BNPL = /AFFIRM|PAY ?LATER|PAY IN [0-9]|KLARNA|AFTERPAY|SEZZLE|ZIP CO|QUADPAY|PAYPAL PAY IN|SPLITIT/i;
function classify(a) {
  const t = [a.account_type || "", a.loan_type || ""].join(" ").toUpperCase();
  const st = [a.pay_status || ""].concat(a.remarks || []).join(" ").toUpperCase();
  const hist = (a.history || []).map((h) => h.rating || "");
  let kind;
  if (COLLECTION_TYPES.test(a.loan_type || "") || COLLECTION_STATUS.test(a.pay_status || "")) kind = "collection";
  else if (t.includes("MORTGAGE") || t.includes("REAL ESTATE") || t.includes("HOME EQUITY")) kind = "mortgage";
  else if (t.includes("REVOLVING") || t.includes("CREDIT CARD") || t.includes("LINE OF CREDIT") || t.includes("CHARGE CARD")) kind = "revolving";
  else if (t.includes("INSTALLMENT")) kind = "installment";
  else if (t.includes("OPEN")) kind = "open";
  else kind = "other";
  const flags = [];
  if (kind === "collection") flags.push("collection");
  if (CHARGEOFF.test(st) || hist.includes("C/O")) flags.push("charged_off");
  if (TRANSFERRED.test(st)) flags.push("transferred");
  if (BANKRUPTCY.test(st)) flags.push("bankruptcy");
  if (DISPUTED.test(st)) flags.push("disputed");
  const names = [a.name || "", a.original_creditor || "", a.loan_type || ""].join(" ");
  if (MEDICAL.test(names)) flags.push("medical");
  if (STUDENT.test(names) || t.includes("STUDENT")) flags.push("student_loan");
  if (CHILD_SUPPORT.test(names) || t.includes("CHILD SUPPORT")) flags.push("child_support");
  if (GOVERNMENT.test(a.name || "") || flags.includes("child_support")) flags.push("government");
  if (BNPL.test(a.name || "")) flags.push("bnpl");
  if (t.includes("SECURED") && !t.includes("UNSECURED")) flags.push("secured");
  if (a.pay_status_adverse || hist.some((r) => is_late(r) || DEROG_RATINGS.has(r)) || kind === "collection") flags.push("adverse");
  if (a.closed || /\bCLOSED\b/.test(st)) flags.push("closed");
  if (PAID_STATUS.test(a.pay_status || "") || a.paid) flags.push("paid");
  if (st.includes("CREDIT GRANTOR") || /\bCBG\b/.test(st)) flags.push("closed_by_grantor");
  return [kind, uniqSorted(flags)];
}
function account_id(bureau, a) { return "a" + stable_hash([bureau, norm_name(a.name), norm_space(a.number), a.opened || ""].join("|")); }
function visible_digits(number) { return String(number || "").toUpperCase().split("*")[0].replace(/[^0-9A-Z]/g, ""); }
