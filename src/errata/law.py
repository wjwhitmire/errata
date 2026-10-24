"""Legal citations, addresses, deadlines, postage and the statute of limitations table.

Every value here comes from the project's legal research file (compiled 2026-10-22), with its
source URL kept beside it; the README's sources table lists the same entries. Statute text is
from Cornell LII. Secondary sources are labeled and must be verified before relying on them.
This is information, not legal advice. Twin: web/src/core/90_tables.js (written by
tests/make_vectors.py from this module, so the two never drift).
"""

from .nanp import SOURCE as NANP_SOURCE, TABLE as NANP_TABLE

# ---------------------------------------------------------------- citations
# kind: statute, reg, agency, court, industry, secondary, practitioner
C = {}


def _c(key, cite, title, url, kind="statute"):
    C[key] = {"key": key, "cite": cite, "title": title, "url": url, "kind": kind}


_U = "https://www.law.cornell.edu/uscode/text/15/"
_R = "https://www.law.cornell.edu/cfr/text/12/"
_c("fcra604", "FCRA 604, 15 U.S.C. 1681b", "Permissible purposes of consumer reports", _U + "1681b")
_c("fcra604f", "FCRA 604(f), 15 U.S.C. 1681b(f)", "No report without a permissible purpose", _U + "1681b")
_c("fcra605", "FCRA 605(a), 15 U.S.C. 1681c(a)", "Reporting limits: 7 years for most adverse items, 10 years for bankruptcy", _U + "1681c")
_c("fcra605a1", "FCRA 605(a)(1), 15 U.S.C. 1681c(a)(1)", "Bankruptcy cases: 10 years from the order for relief", _U + "1681c")
_c("fcra605c", "FCRA 605(c), 15 U.S.C. 1681c(c)", "The 7 years start 180 days after the delinquency that preceded collection or charge-off", _U + "1681c")
_c("fcra605a7", "FCRA 605(a)(7)-(8), 15 U.S.C. 1681c(a)", "Veterans' medical debt excluded", _U + "1681c")
_c("fcra605b", "FCRA 605B(a), 15 U.S.C. 1681c-2(a)", "Block of identity theft information within 4 business days", _U + "1681c-2")
_c("fcra605a_alert", "FCRA 605A(a), 15 U.S.C. 1681c-1(a)", "Initial fraud alert for at least 1 year; the bureau tells the other nationwide bureaus", _U + "1681c-1")
_c("fcra605a_freeze", "FCRA 605A(i), 15 U.S.C. 1681c-1(i)", "Security freeze free of charge; placed within 3 business days of a mailed request", _U + "1681c-1")
_c("fcra607b", "FCRA 607(b), 15 U.S.C. 1681e(b)", "Reasonable procedures to assure maximum possible accuracy", _U + "1681e")
_c("fcra609", "FCRA 609, 15 U.S.C. 1681g", "File disclosure: all information in the file and its sources", _U + "1681g")
_c("fcra611", "FCRA 611(a)(1)(A), 15 U.S.C. 1681i(a)(1)(A)", "Free reinvestigation within 30 days of receipt, or deletion", _U + "1681i")
_c("fcra611ext", "FCRA 611(a)(1)(B), 15 U.S.C. 1681i(a)(1)(B)", "Up to 15 more days when the consumer adds information", _U + "1681i")
_c("fcra611a2", "FCRA 611(a)(2)(A), 15 U.S.C. 1681i(a)(2)(A)", "Notice of the dispute to the furnisher within 5 business days", _U + "1681i")
_c("fcra611a3", "FCRA 611(a)(3), 15 U.S.C. 1681i(a)(3)", "Frivolous or irrelevant disputes; notice within 5 business days", _U + "1681i")
_c("fcra611a4", "FCRA 611(a)(4), 15 U.S.C. 1681i(a)(4)", "The agency must review all relevant information the consumer sends", _U + "1681i")
_c("fcra611a5", "FCRA 611(a)(5), 15 U.S.C. 1681i(a)(5)", "Delete or correct inaccurate or unverifiable items; reinsertion notice within 5 business days", _U + "1681i")
_c("fcra611a5b", "FCRA 611(a)(5)(B), 15 U.S.C. 1681i(a)(5)(B)", "Reinsertion only after the furnisher certifies accuracy; written notice within 5 business days", _U + "1681i")
_c("fcra611a6", "FCRA 611(a)(6), 15 U.S.C. 1681i(a)(6)", "Results notice within 5 business days, with the right to a description of the procedure", _U + "1681i")
_c("fcra611a7", "FCRA 611(a)(6)(B)(iii) and (a)(7), 15 U.S.C. 1681i(a)(7)", "Description of the verification procedure within 15 days of request", _U + "1681i")
_c("fcra611b", "FCRA 611(b), 15 U.S.C. 1681i(b)", "Statement of dispute (may be limited to 100 words)", _U + "1681i")
_c("fcra611d", "FCRA 611(d), 15 U.S.C. 1681i(d)", "Notice of corrections to prior recipients on request", _U + "1681i")
_c("fcra612", "FCRA 612(a)(3), 15 U.S.C. 1681j(a)(3)", "45 days for a dispute made after a free annual report", _U + "1681j")
_c("fcra616", "FCRA 616, 15 U.S.C. 1681n", "Civil liability for willful noncompliance", _U + "1681n")
_c("fcra617", "FCRA 617, 15 U.S.C. 1681o", "Civil liability for negligent noncompliance", _U + "1681o")
_c("fcra618", "FCRA 618, 15 U.S.C. 1681p", "Where and when to sue: 2 years from discovery or 5 years from the violation", _U + "1681p")
_c("fcra623a1", "FCRA 623(a)(1), 15 U.S.C. 1681s-2(a)(1)", "No furnishing of information known or believed inaccurate", _U + "1681s-2")
_c("fcra623a1f", "FCRA 623(a)(1)(F), 15 U.S.C. 1681s-2(a)(1)(F)", "CARES Act: accommodation accounts reported current", _U + "1681s-2")
_c("fcra623a3", "FCRA 623(a)(3), 15 U.S.C. 1681s-2(a)(3)", "A disputed item must be reported as disputed", _U + "1681s-2")
_c("fcra623a5", "FCRA 623(a)(5), 15 U.S.C. 1681s-2(a)(5)", "Furnishers must report the month and year the delinquency began", _U + "1681s-2")
_c("fcra623a6", "FCRA 623(a)(6), 15 U.S.C. 1681s-2(a)(6)", "No refurnishing after an identity theft report", _U + "1681s-2")
_c("fcra623a8", "FCRA 623(a)(8), 15 U.S.C. 1681s-2(a)(8)", "Direct disputes with the furnisher", _U + "1681s-2")
_c("fcra623b", "FCRA 623(b), 15 U.S.C. 1681s-2(b)", "Furnisher investigation after notice from a bureau", _U + "1681s-2")
_c("regv1022_43", "12 CFR 1022.43", "Direct dispute content, address and timing", _R + "1022.43", "reg")
_c("fdcpa1692c", "FDCPA 805(c), 15 U.S.C. 1692c(c)", "Ceasing communication on written request", _U + "1692c")
_c("fdcpa1692g", "FDCPA 809(b), 15 U.S.C. 1692g(b)", "A timely written dispute stops collection until verification is mailed", _U + "1692g")
_c("fdcpa1692e8", "FDCPA 807(8), 15 U.S.C. 1692e(8)", "A collector may not report a debt without saying it is disputed", _U + "1692e")
_c("regf1006_26", "12 CFR 1006.26(b)", "No suit or threat of suit on time-barred debt", _R + "1006.26", "reg")
_c("regf1006_30a", "12 CFR 1006.30(a)(1)", "No credit reporting before communicating with the consumer", _R + "1006.30", "reg")
_c("regf1006_30a_c", "Official interpretation 30(a)(1)-2", "14 consecutive days after mailing is a reasonable waiting period",
   "https://www.consumerfinance.gov/rules-policy/regulations/1006/2021-11-30/interp-30/", "reg")
_c("regf1006_30b", "12 CFR 1006.30(b)", "No sale or placement of paid, settled or discharged debt", _R + "1006.30", "reg")
_c("regf1006_34", "12 CFR 1006.34(b)(5)", "The validation period ends 30 days after you receive the validation information", _R + "1006.34", "reg")
_c("regf1006_38", "12 CFR 1006.38(c)-(d)", "Disputes and original creditor requests stop collection until answered", _R + "1006.38", "reg")
_c("croa1679b", "CROA, 15 U.S.C. 1679b(a)", "No person may make or counsel untrue or misleading statements, or advise an identity change", _U + "1679b")
_c("croa1679c", "CROA, 15 U.S.C. 1679c", "Disclosure: disputes are free; accurate information cannot be removed", _U + "1679c")
_c("tsr310_4", "16 CFR 310.4(a)(2)", "Telemarketing Sales Rule ban on advance fees for credit repair", "https://www.law.cornell.edu/cfr/text/16/310.4", "reg")
_c("medical_policy", "Equifax, Experian and TransUnion medical collections policy", "Paid medical collections, those under $500 and those under 1 year old are not reported (voluntary)",
   "https://newsroom.transunion.com/equifax-experian-and-transunion-remove-medical-collections-debt-under-500-from-us-credit-reports/", "industry")
_c("medical_rule_vacated", "CFPB medical debt rule vacated (E.D. Tex., July 2025)", "The 2025 federal rule is not in force",
   "https://www.checkbook.org/national/consumers-notebook/articles/Federal-Judge-Kills-CFPB-Rule-that-Banned-Medical-Debt-in-Credit-Reports-7678", "secondary")
_c("white_v_experian", "White v. Experian (C.D. Cal.)", "Bureaus must update debts discharged in bankruptcy", "https://www.lieffcabraser.com/?p=3703", "secondary")
_c("saunders", "Saunders v. BB&T, 526 F.3d 142 (4th Cir. 2008)", "Failing to report a bona fide dispute can be materially misleading",
   "https://www.bclplaw.com/a/web/101932/Use-of-Compliance-Condition-Codes.pdf", "court")
_c("metro2_status", "Metro 2 account status (public summary)", "Status must align with payment rating and amount past due; 05 means transferred",
   "https://bureaurelay.com/metro2/field/account-status", "industry")
_c("metro2_ccc", "Metro 2 compliance condition codes (public summary)", "XB while a dispute is open; XC or XH after", "https://bureaurelay.com/metro2/field/compliance-condition-code", "industry")
_c("metro2_k1", "Metro 2 K1 segment (public summary)", "Collection records carry the original creditor name",
   "https://bureaurelay.com/metro2/industry/debt-collectors/guide", "industry")
_c("metro2_k2", "Metro 2 K2 segment (vendor documentation)", "Purchased debt carries purchased-from or sold-to names",
   "https://docs.interprose.com/docs/debt-purchaser-credit-reporting", "industry")
_c("tu_inquiries", "myFICO: inquiries", "Inquiries stay on the report 2 years and count in FICO scores for 12 months",
   "https://www.myfico.com/credit-education/whats-in-your-credit-score", "industry")
_c("cfpb_complaint", "CFPB complaint portal", "Dispute with the bureau first; then a complaint", "https://www.consumerfinance.gov/complaint/", "agency")
_c("naag", "NAAG: find your attorney general", "State attorneys general", "https://www.naag.org/find-my-ag/", "agency")
_c("naca", "NACA attorney directory", "Consumer attorneys; FCRA fee shifting", "https://www.consumeradvocates.org/findanattorney/", "industry")
_c("experian_609", "Experian: what is a 609 dispute letter", "609 is a disclosure request; no template forces removal",
   "https://experian.com/blogs/ask-experian/what-is-a-609-dispute-letter", "industry")
_c("experian_goodwill", "Experian: goodwill letters", "A courtesy request, not a dispute", "https://www.experian.com/blogs/ask-experian/what-is-goodwill-letter/", "industry")
_c("pay_for_delete", "Pay-for-delete overview", "A private agreement; get it in writing before paying",
   "https://www.consumeraffairs.com/finance/will-pay-for-delete-improve-my-credit-score.html", "secondary")
_c("settlement", "Paid in full versus settled", "Settled accounts report less than full balance",
   "https://www.moneymanagement.org/blog/paid-in-full-versus-paid-off-less-than-full-balance", "secondary")
_c("sol_table", "Statute of limitations chart (SuperMoney, updated 07/23/2026)", "Secondary compilation; verify with your state statute",
   "https://www.supermoney.com/statute-of-limitations-on-debt", "secondary")
_c("nclc_timebarred", "NCLC: time-barred debt", "State disclosures, revival and extinguishment",
   "https://library.nclc.org/article/limits-collection-time-barred-debt-and-new-fdcpa-rules", "secondary")
_c("cares_period", "End of the national emergency (April 10, 2023)", "Covered period ended about August 8, 2023",
   "https://www.hsfkramer.com/insights/2023-05/implications-for-benefit-plans-of-the-end-of-the-covid-19-national-emergency-and-public-health-emergency", "secondary")
_c("cares_nclc", "NCLC: enforcing CARES Act credit reporting protections", "Enforcement runs through the 611 to 623(b) dispute path",
   "https://library.nclc.org/article/enforcing-cares-act-credit-reporting-protections", "secondary")
_c("ftc_affidavit", "FTC identity theft affidavit", "False statements to the government may violate 18 U.S.C. 1001",
   "https://www.phoenix.edu/content/dam/edu/about/doc/identity-theft-affidavit-fill.pdf", "agency")
_c("eoscar", "NCLC, Automated Injustice (2009)", "Disputes travel as short codes; specific, factual disputes fare better",
   "https://www.nclc.org/wp-content/uploads/2022/10/report-automated_injustice.pdf", "secondary")
_c("cfpb_volume", "CFPB complaint volume report (2026)", "Duplicative and third-party complaints are screened",
   "https://infobytes.orrick.com/2026-04-10/cfpb-reports-complaint-volume-doubled-in-2025-citing-surge-in-credit-reporting-disputes/", "secondary")
_c("fico_weights", "myFICO: what is in your score", "Payment 35%, amounts owed 30%, length 15%, mix 10%, new 10%; inquiries count 12 months",
   "https://www.myfico.com/credit-education/whats-in-your-credit-score", "industry")
_c("fico8", "FICO 8 overview", "Sensitive to card utilization; ignores collections under $100 original balance",
   "https://www.creditkarma.com/credit/i/what-fico-score-8", "secondary")
_c("fico9", "FICO 9 overview", "Ignores paid collections; weighs medical debt less; counts rent when reported",
   "https://www.nerdwallet.com/finance/learn/fico-score-9", "secondary")
_c("fico_versions", "myFICO: score versions", "Mortgage FICO 2, 4, 5; auto lenders use FICO Auto Scores; 10T adds trended data",
   "https://www.myfico.com/credit-education/credit-scores/fico-score-versions", "industry")
_c("vantage4", "VantageScore 4.0 overview", "Payment 41%, age and type 20%, utilization 20%, new 11%, balances 6%, available 2%; medical collections excluded",
   "https://www.creditkarma.com/advice/i/new-vantagescore-4-0-explained", "secondary")
_c("rate_shop", "myFICO: rate shopping", "Mortgage, auto and student loan inquiries within 45 days count once (older versions 14 days)",
   "https://myfico.com/credit-education/blog/rate-shop", "industry")
_c("freddie_models", "Freddie Mac credit score models", "VantageScore 4.0 or Classic FICO for GSE loans", "https://sf.freddiemac.com/general/credit-score-models", "agency")
_c("ftc_study", "FTC accuracy study (2013)", "1 in 20 saw a score change above 25 points after corrections", "https://www.ftc.gov/node/46243", "agency")
_c("high_scorers", "High FICO scorers (2012)", "Average revolving utilization about 7%", "https://www.cnbc.com/2012/11/07/secrets-of-high-credit-scorers.html", "secondary")
_c("util_timing", "Utilization is reported from the statement balance", "Pay before the statement closes",
   "https://ficoforums.myfico.com/t5/Understanding-FICO-Scoring/How-is-utilization-reported-to-FICO/m-p/6453243/highlight/true", "practitioner")
_c("azeo", "AZEO (all zero except one)", "Community-observed, not published by FICO",
   "https://ficoforums.myfico.com/t5/Understanding-FICO-Scoring/Azeo-method/m-p/5393412", "practitioner")
_c("au_experian", "Experian: authorized user accounts", "Most models include authorized user accounts",
   "https://stg1.experian.com/blogs/ask-experian/authorized-user-accounts-can-factor-in-to-credit-scores", "industry")
_c("au_fico8", "FICO 8 and authorized users", "Dampens tradeline renting while keeping genuine authorized users",
   "https://www.americanbanker.com/news/fair-isaac-thwarts-piggy-backers", "secondary")
_c("fannie_au", "Fannie Mae Selling Guide B3-5.3-06", "Manual underwriting generally ignores authorized user tradelines",
   "https://selling-guide.fanniemae.com/sel/b3-5.3-06/authorized-users-credit", "agency")
_c("credit_builder", "CFPB: credit builder loans (2020)", "More effective for people without existing debt",
   "https://www.consumerfinance.gov/data-research/research-reports/targeting-credit-builder-loans/", "agency")
_c("experian_boost", "Experian Boost", "Adds on-time utility and rent payments to the Experian file only",
   "https://experian.com/blogs/ask-experian/what-is-experian-boost/", "industry")
_c("student_rehab", "NCLC: federal student loans out of default (August 2026)", "Rehabilitation: nine on-time payments; the default record is removed",
   "https://studentloanborrowerassistance.org/wp-content/uploads/2026/08/2026.08_How-to-Get-Federal-Student-Loans-Out-of-Default.pdf", "secondary")
_c("rapid_rescore", "Experian: rapid rescore", "Only a lender can request it; about 2 to 5 days",
   "https://experian.com/blogs/ask-experian/what-is-rapid-rescore-should-i-consider", "industry")
_c("annual_report", "AnnualCreditReport.com", "Free weekly reports from each bureau",
   "https://www.annualcreditreport.com/requestReport/requestForm.action", "agency")
_c("weekly_reports", "FTC: permanent free weekly reports", "Weekly reports are permanent",
   "https://consumer.ftc.gov/consumer-alerts/2023/10/you-now-have-permanent-access-free-weekly-credit-reports?os=nirstv", "agency")
_c("usps_2026", "USPS prices effective July 12, 2026", "Forever stamp $0.82; Certified Mail $5.55",
   "https://www.unlv.edu/news/unlvtoday/usps-postal-rate-increases-effective-july-12", "secondary")
_c("certified_err", "Certified Mail with return receipt, 2026", "Electronic return receipt $8.46; green card $10.20 (fees, plus postage)",
   "https://theletterpilot.com/guides/certified-mail-cost-2026", "secondary")
_c("tu_mail_list", "TransUnion: dispute by mail", "Name, date of birth, address, SSN, the company, partial account number and the reason",
   "https://www.transunion.com/credit-disputes/dispute-your-credit/mail-or-phone", "industry")
_c("cfpb_sample", "CFPB sample dispute letter", "A plain, specific dispute letter",
   "https://files.consumerfinance.gov/f/documents/092016_cfpb__CreditReportingSampleLetter.pdf", "agency")
_c("ramirez", "TransUnion v. Ramirez (U.S. 2021)", "Standing needs concrete harm such as dissemination",
   "https://www.faegredrinker.com/en/insights/publications/2021/6/supreme-court-decides-transunion-llc-v-ramirez", "secondary")

# Texas child support reporting (state law and the federal rule it implements)
_c("ssa666a7", "42 U.S.C. 666(a)(7)", "States report overdue support only after notice and a reasonable chance to contest its accuracy",
   "https://www.law.cornell.edu/uscode/text/42/666")
_c("tfc231_114", "Tex. Fam. Code 231.114", "Notice before release; contest before the 30th day after the notice is mailed; the agency keeps the information updated",
   "https://statutes.capitol.texas.gov/Docs/FA/htm/FA.231.htm#231.114")
_c("tac55_102", "1 Tex. Admin. Code 55.102(b)", "Past-due support reported as past due and zero months delinquent when a court order set periodic arrears payments and each was paid on time",
   "https://law.cornell.edu/regulations/texas/1-Tex-Admin-Code-SS-55-102", "reg")
_c("tac55_103", "1 Tex. Admin. Code 55.103(c)", "Request administrative review within 30 days of receiving the notice and no later than 45 days from its date",
   "https://law.cornell.edu/regulations/texas/1-Tex-Admin-Code-SS-55-103", "reg")
_c("tac55_104", "1 Tex. Admin. Code 55.104", "A mailed request is timely if postmarked on the last day; no good cause exception",
   "https://regulations.justia.com/states/texas/title-1/part-3/chapter-55/subchapter-c/section-55-104/", "reg")
_c("nanp", "North American Numbering Plan area codes", "Area codes in service, from NANPA assignments as carried in libphonenumber",
   "https://www.nationalnanpa.com/reports/reports_npa.html", "industry")

CITATIONS = C

# ---------------------------------------------------------------- addresses
# Source: research section 3.1 and 3.2; "verified" is the research date. Users can override.
VERIFIED = "2026-10-22"
BUREAUS = {
    "transunion": {"name": "TransUnion Consumer Solutions", "lines": ["P.O. Box 2000", "Chester, PA 19016-2000"],
                   "phone": "800-916-8800", "online": "https://service.transunion.com/dss/login.page?dest=dispute",
                   "source": "https://www.transunion.com/credit-disputes/dispute-your-credit/mail-or-phone"},
    "experian": {"name": "Experian", "lines": ["Dispute by Mail", "P.O. Box 4500", "Allen, TX 75013"], "phone": "",
                 "online": "https://www.experian.com/help/dispute-credit/", "source": "https://www.experian.com/disputes/main.html"},
    "equifax": {"name": "Equifax Information Services LLC", "lines": ["P.O. Box 740256", "Atlanta, GA 30374-0256"],
                "phone": "1-888-378-4329", "online": "https://my.equifax.com/consumer-registration/rest/1.0/redirectPartnerTenant?intent=DISPUTE",
                "source": "https://www.equifax.com/personal/help/mail-in-credit-report-dispute"},
}
SPECIALTY = {
    "chexsystems": {"name": "Chex Systems, Inc.", "lines": ["Attn: Consumer Relations", "P.O. Box 583399", "Minneapolis, MN 55458"],
                    "phone": "800-428-9623", "covers": "Bank account screening; records kept up to 5 years",
                    "source": "https://consumerfinance.gov/consumer-tools/credit-reports-and-scores/consumer-reporting-companies/companies-list/chex-systems"},
    "ews": {"name": "Early Warning Services", "lines": ["Attn: Consumer Services Department", "5801 N. Pima Rd", "Scottsdale, AZ 85250"],
            "phone": "800-745-1560", "covers": "Bank account screening",
            "source": "https://www.consumerfinance.gov/consumer-tools/credit-reports-and-scores/consumer-reporting-companies/companies-list/early-warning-services-llc/"},
    "lexisnexis": {"name": "LexisNexis Risk Solutions Consumer Center", "lines": ["P.O. Box 105108", "Atlanta, GA 30348-5108"],
                   "phone": "866-897-8126", "covers": "Insurance, public records, identity",
                   "source": "https://consumer.risk.lexisnexis.com/request"},
    "innovis": {"name": "Innovis Consumer Assistance", "lines": ["P.O. Box 530088", "Atlanta, GA 30353-0088"],
                "phone": "1-866-712-0021", "covers": "Fourth credit bureau", "source": "https://www.innovis.com/personal/disputeResolution"},
    "nctue": {"name": "NCTUE Disputes", "lines": ["P.O. Box 105398", "Atlanta, GA 30348"], "phone": "1-866-343-2821",
              "covers": "Telecom, pay TV and utility accounts", "source": "https://www.nctue.com/consumers"},
    "clarity": {"name": "Clarity Services, Inc.", "lines": ["Consumer Support Division", "P.O. Box 16", "Allen, TX 75013"],
                "phone": "866-390-3118", "covers": "Subprime and alternative lending",
                "source": "https://www.consumerfinance.gov/consumer-tools/credit-reports-and-scores/consumer-reporting-companies/companies-list/clarity-services/"},
}
ANNUAL_REPORT = {"name": "Annual Credit Report Request Service", "lines": ["P.O. Box 105281", "Atlanta, GA 30348-5281"],
                 "phone": "1-877-322-8228", "online": "https://www.annualcreditreport.com"}
HELP_LINKS = [
    {"title": "CFPB complaint portal", "url": "https://www.consumerfinance.gov/complaint/"},
    {"title": "Find a consumer attorney (NACA)", "url": "https://www.consumeradvocates.org/findanattorney/"},
    {"title": "Find your state attorney general (NAAG)", "url": "https://www.naag.org/find-my-ag/"},
    {"title": "Free legal aid near you (Legal Services Corporation)", "url": "https://www.lsc.gov/about-lsc/what-legal-aid/get-legal-help"},
    {"title": "Free weekly credit reports", "url": "https://www.annualcreditreport.com"},
    {"title": "CFPB sample dispute letter", "url": "https://files.consumerfinance.gov/f/documents/092016_cfpb__CreditReportingSampleLetter.pdf"},
]

# ---------------------------------------------------------------- deadlines (days)
# Counting convention. 611(a)(1)(A) gives the agency "the 30-day period beginning on the date on
# which the agency receives the notice of the dispute". Read literally, the delivery day is day 1,
# so day 30 is delivery + 29 days. This tool treats the deadline as delivery + 30 calendar days (the
# later, conservative date, so it never tells you a deadline was missed when it was not) and also
# shows the earliest possible reading (delivery + 29) as "earliest". The 15 extra days under
# 611(a)(1)(B) and the furnisher's matching period under 12 CFR 1022.43(e) follow the same rule.
# Periods worded "not later than N days after" (611(a)(7), the business-day notices) and Reg F's
# validation period ("ends 30 days after" receipt, 1006.34(b)(5)) start the day after, so their
# earliest and conservative dates are the same. Calendar days do not skip weekends or holidays;
# business days skip Saturdays, Sundays and legal public holidays.
DEADLINES = {
    "bureau_dispute": {"days": 30, "business": False, "from": "delivery", "cite": "fcra611", "begins_on": True,
                       "label": "Bureau must finish its reinvestigation"},
    "bureau_dispute_extended": {"days": 45, "business": False, "from": "delivery", "cite": "fcra611ext", "begins_on": True,
                                "label": "Extended reinvestigation (you added information, or the dispute followed a free annual report)"},
    "furnisher_notice": {"days": 5, "business": True, "from": "delivery", "cite": "fcra611a2",
                         "label": "Bureau must notify the furnisher"},
    "results_notice": {"days": 5, "business": True, "from": "completion", "cite": "fcra611a6",
                       "label": "Results notice after the reinvestigation ends"},
    "frivolous_notice": {"days": 5, "business": True, "from": "determination", "cite": "fcra611a3",
                         "label": "Notice if the bureau calls a dispute frivolous"},
    "reinsertion_notice": {"days": 5, "business": True, "from": "reinsertion", "cite": "fcra611a5b",
                           "label": "Written notice after a deleted item is put back"},
    "mov": {"days": 15, "business": False, "from": "delivery", "cite": "fcra611a7",
            "label": "Description of the verification procedure"},
    "block_605b": {"days": 4, "business": True, "from": "delivery", "cite": "fcra605b", "label": "Identity theft block"},
    "freeze_mail": {"days": 3, "business": True, "from": "delivery", "cite": "fcra605a_freeze", "label": "Security freeze placed (mailed request)"},
    "furnisher_direct": {"days": 30, "business": False, "from": "delivery", "cite": "regv1022_43", "begins_on": True,
                         "label": "Furnisher's direct dispute investigation"},
    "validation_period": {"days": 30, "business": False, "from": "validation_receipt", "cite": "regf1006_34",
                          "label": "Validation period ends (dispute in writing before this)"},
    "validation_assumed_receipt": {"days": 5, "business": True, "from": "validation_sent", "cite": "regf1006_34",
                                   "label": "Collector may assume you received the notice"},
    "collector_wait": {"days": 14, "business": False, "from": "collector_letter", "cite": "regf1006_30a_c",
                       "label": "Collector may report after this wait"},
    "cfpb_response": {"days": 15, "business": False, "from": "complaint", "cite": "cfpb_complaint",
                      "label": "Company usually responds to a CFPB complaint"},
    "cfpb_final": {"days": 60, "business": False, "from": "complaint", "cite": "cfpb_complaint",
                   "label": "Some companies give a final response"},
}
FCRA_SUIT_YEARS = {"discovery": 2, "violation": 5}

# ---------------------------------------------------------------- reporting limits
REPORTING = {"adverse_years": 7, "collection_grace_days": 180, "bankruptcy_years": 10, "inquiry_years": 2,
             "collector_file_months": 83}
CARES = {"start": "2020-01-31", "end": "2023-08-08"}
MEDICAL = {"min_balance_cents": 50000, "wait_days": 365,
           "state_laws": ["CA", "CO", "CT", "DE", "IL", "ME", "MD", "MN", "NJ", "NY", "OR", "RI", "VT", "VA", "WA"]}

# ---------------------------------------------------------------- postage (USPS, effective July 12, 2026)
POSTAGE = {"stamp_cents": 82, "certified_cents": 555, "certified_err_cents": 846, "certified_green_cents": 1020,
           "effective": "2026-07-12"}

# ---------------------------------------------------------------- statute of limitations (years)
# Columns: written contract, oral contract, promissory note, open account (credit card).
# Source: SuperMoney chart updated 07/23/2026 (secondary); ship as an estimate and verify.
SOL_COLUMNS = ["written", "oral", "promissory", "open"]
SOL = {
    "AL": ("Alabama", 6, 6, 6, 3), "AK": ("Alaska", 6, 6, 3, 3), "AZ": ("Arizona", 6, 3, 6, 6),
    "AR": ("Arkansas", 5, 3, 5, 5), "CA": ("California", 4, 2, 4, 4), "CO": ("Colorado", 6, 6, 6, 6),
    "CT": ("Connecticut", 6, 3, 6, 6), "DE": ("Delaware", 3, 3, 3, 4), "DC": ("District of Columbia", 3, 3, 3, 3),
    "FL": ("Florida", 5, 4, 5, 5), "GA": ("Georgia", 6, 4, 6, 6), "HI": ("Hawaii", 6, 6, 6, 6),
    "ID": ("Idaho", 5, 4, 5, 4), "IL": ("Illinois", 10, 5, 10, 5), "IN": ("Indiana", 10, 5, 10, 6),
    "IA": ("Iowa", 10, 5, 10, 5), "KS": ("Kansas", 5, 3, 5, 3), "KY": ("Kentucky", 10, 5, 15, 10),
    "LA": ("Louisiana", 10, 10, 10, 3), "ME": ("Maine", 6, 6, 20, 6), "MD": ("Maryland", 3, 3, 6, 3),
    "MA": ("Massachusetts", 6, 6, 6, 6), "MI": ("Michigan", 6, 6, 6, 6), "MN": ("Minnesota", 6, 6, 6, 6),
    "MS": ("Mississippi", 3, 3, 3, 3), "MO": ("Missouri", 10, 5, 10, 5), "MT": ("Montana", 8, 5, 8, 5),
    "NE": ("Nebraska", 5, 4, 5, 4), "NV": ("Nevada", 6, 4, 3, 4), "NH": ("New Hampshire", 3, 3, 6, 3),
    "NJ": ("New Jersey", 6, 6, 6, 6), "NM": ("New Mexico", 6, 4, 6, 4), "NY": ("New York", 3, 3, 3, 3),
    "NC": ("North Carolina", 3, 3, 5, 3), "ND": ("North Dakota", 6, 6, 6, 6), "OH": ("Ohio", 6, 4, 8, 6),
    "OK": ("Oklahoma", 5, 3, 6, 3), "OR": ("Oregon", 6, 6, 6, 6), "PA": ("Pennsylvania", 4, 4, 4, 4),
    "RI": ("Rhode Island", 4, 10, 10, 10), "SC": ("South Carolina", 3, 3, 3, 3), "SD": ("South Dakota", 6, 6, 6, 6),
    "TN": ("Tennessee", 6, 6, 6, 6), "TX": ("Texas", 4, 4, 4, 4), "UT": ("Utah", 6, 4, 6, 4),
    "VT": ("Vermont", 6, 6, 14, 6), "VA": ("Virginia", 5, 3, 6, 3), "WA": ("Washington", 6, 3, 6, 6),
    "WV": ("West Virginia", 10, 5, 6, 5), "WI": ("Wisconsin", 6, 6, 10, 6), "WY": ("Wyoming", 10, 8, 10, 8),
}
# Rows the research flags for legal review before relying on them.
SOL_FLAGS = {
    "RI": "Written contract (4) is shorter than oral (10); check the statute.",
    "DE": "Open account (4) is longer than written contract (3); check the statute.",
    "NY": "3 years for consumer credit under the 2022 Consumer Credit Fairness Act; 6 for other contracts. A payment after expiration does not revive time-barred consumer debt.",
}
SOL_EXTINGUISHED = {"MS": "Debt is extinguished after the period, not just unenforceable.",
                    "WI": "Debt is extinguished after the period, not just unenforceable.",
                    "NC": "Debt is extinguished after the period for debt buyers."}
SOL_DISCLOSURE_STATES = ["CA", "CT", "NC", "TX", "WV", "MA", "NM", "NY", "VT"]


def sol_table():
    return {k: {"name": v[0], "written": v[1], "oral": v[2], "promissory": v[3], "open": v[4],
                "flag": SOL_FLAGS.get(k, ""), "extinguished": SOL_EXTINGUISHED.get(k, "")} for k, v in sorted(SOL.items())}


def tables():
    """Everything the browser needs, as JSON."""
    return {"citations": CITATIONS, "bureaus": BUREAUS, "specialty": SPECIALTY, "annual_report": ANNUAL_REPORT,
            "help_links": HELP_LINKS, "deadlines": DEADLINES, "fcra_suit_years": FCRA_SUIT_YEARS, "reporting": REPORTING,
            "cares": CARES, "medical": MEDICAL, "postage": POSTAGE, "sol": sol_table(), "sol_columns": SOL_COLUMNS,
            "sol_disclosure_states": SOL_DISCLOSURE_STATES, "verified": VERIFIED, "nanp": NANP_TABLE, "nanp_source": NANP_SOURCE}
