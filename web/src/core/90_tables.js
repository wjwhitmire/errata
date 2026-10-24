// Written by tests/make_vectors.py from the Python library (src/errata/law.py and friends). Do not edit by hand.
// Every legal value carries its source URL; see the README's sources table.
const TABLES = {
 "annual_report": {
  "lines": [
   "P.O. Box 105281",
   "Atlanta, GA 30348-5281"
  ],
  "name": "Annual Credit Report Request Service",
  "online": "https://www.annualcreditreport.com",
  "phone": "1-877-322-8228"
 },
 "bureaus": {
  "equifax": {
   "lines": [
    "P.O. Box 740256",
    "Atlanta, GA 30374-0256"
   ],
   "name": "Equifax Information Services LLC",
   "online": "https://my.equifax.com/consumer-registration/rest/1.0/redirectPartnerTenant?intent=DISPUTE",
   "phone": "1-888-378-4329",
   "source": "https://www.equifax.com/personal/help/mail-in-credit-report-dispute"
  },
  "experian": {
   "lines": [
    "Dispute by Mail",
    "P.O. Box 4500",
    "Allen, TX 75013"
   ],
   "name": "Experian",
   "online": "https://www.experian.com/help/dispute-credit/",
   "phone": "",
   "source": "https://www.experian.com/disputes/main.html"
  },
  "transunion": {
   "lines": [
    "P.O. Box 2000",
    "Chester, PA 19016-2000"
   ],
   "name": "TransUnion Consumer Solutions",
   "online": "https://service.transunion.com/dss/login.page?dest=dispute",
   "phone": "800-916-8800",
   "source": "https://www.transunion.com/credit-disputes/dispute-your-credit/mail-or-phone"
  }
 },
 "cares": {
  "end": "2023-08-08",
  "start": "2020-01-31"
 },
 "citations": {
  "annual_report": {
   "cite": "AnnualCreditReport.com",
   "key": "annual_report",
   "kind": "agency",
   "title": "Free weekly reports from each bureau",
   "url": "https://www.annualcreditreport.com/requestReport/requestForm.action"
  },
  "au_experian": {
   "cite": "Experian: authorized user accounts",
   "key": "au_experian",
   "kind": "industry",
   "title": "Most models include authorized user accounts",
   "url": "https://stg1.experian.com/blogs/ask-experian/authorized-user-accounts-can-factor-in-to-credit-scores"
  },
  "au_fico8": {
   "cite": "FICO 8 and authorized users",
   "key": "au_fico8",
   "kind": "secondary",
   "title": "Dampens tradeline renting while keeping genuine authorized users",
   "url": "https://www.americanbanker.com/news/fair-isaac-thwarts-piggy-backers"
  },
  "azeo": {
   "cite": "AZEO (all zero except one)",
   "key": "azeo",
   "kind": "practitioner",
   "title": "Community-observed, not published by FICO",
   "url": "https://ficoforums.myfico.com/t5/Understanding-FICO-Scoring/Azeo-method/m-p/5393412"
  },
  "cares_nclc": {
   "cite": "NCLC: enforcing CARES Act credit reporting protections",
   "key": "cares_nclc",
   "kind": "secondary",
   "title": "Enforcement runs through the 611 to 623(b) dispute path",
   "url": "https://library.nclc.org/article/enforcing-cares-act-credit-reporting-protections"
  },
  "cares_period": {
   "cite": "End of the national emergency (April 10, 2023)",
   "key": "cares_period",
   "kind": "secondary",
   "title": "Covered period ended about August 8, 2023",
   "url": "https://www.hsfkramer.com/insights/2023-05/implications-for-benefit-plans-of-the-end-of-the-covid-19-national-emergency-and-public-health-emergency"
  },
  "certified_err": {
   "cite": "Certified Mail with return receipt, 2026",
   "key": "certified_err",
   "kind": "secondary",
   "title": "Electronic return receipt $8.46; green card $10.20 (fees, plus postage)",
   "url": "https://theletterpilot.com/guides/certified-mail-cost-2026"
  },
  "cfpb_complaint": {
   "cite": "CFPB complaint portal",
   "key": "cfpb_complaint",
   "kind": "agency",
   "title": "Dispute with the bureau first; then a complaint",
   "url": "https://www.consumerfinance.gov/complaint/"
  },
  "cfpb_sample": {
   "cite": "CFPB sample dispute letter",
   "key": "cfpb_sample",
   "kind": "agency",
   "title": "A plain, specific dispute letter",
   "url": "https://files.consumerfinance.gov/f/documents/092016_cfpb__CreditReportingSampleLetter.pdf"
  },
  "cfpb_volume": {
   "cite": "CFPB complaint volume report (2026)",
   "key": "cfpb_volume",
   "kind": "secondary",
   "title": "Duplicative and third-party complaints are screened",
   "url": "https://infobytes.orrick.com/2026-04-10/cfpb-reports-complaint-volume-doubled-in-2025-citing-surge-in-credit-reporting-disputes/"
  },
  "credit_builder": {
   "cite": "CFPB: credit builder loans (2020)",
   "key": "credit_builder",
   "kind": "agency",
   "title": "More effective for people without existing debt",
   "url": "https://www.consumerfinance.gov/data-research/research-reports/targeting-credit-builder-loans/"
  },
  "croa1679b": {
   "cite": "CROA, 15 U.S.C. 1679b(a)",
   "key": "croa1679b",
   "kind": "statute",
   "title": "No person may make or counsel untrue or misleading statements, or advise an identity change",
   "url": "https://www.law.cornell.edu/uscode/text/15/1679b"
  },
  "croa1679c": {
   "cite": "CROA, 15 U.S.C. 1679c",
   "key": "croa1679c",
   "kind": "statute",
   "title": "Disclosure: disputes are free; accurate information cannot be removed",
   "url": "https://www.law.cornell.edu/uscode/text/15/1679c"
  },
  "eoscar": {
   "cite": "NCLC, Automated Injustice (2009)",
   "key": "eoscar",
   "kind": "secondary",
   "title": "Disputes travel as short codes; specific, factual disputes fare better",
   "url": "https://www.nclc.org/wp-content/uploads/2022/10/report-automated_injustice.pdf"
  },
  "experian_609": {
   "cite": "Experian: what is a 609 dispute letter",
   "key": "experian_609",
   "kind": "industry",
   "title": "609 is a disclosure request; no template forces removal",
   "url": "https://experian.com/blogs/ask-experian/what-is-a-609-dispute-letter"
  },
  "experian_boost": {
   "cite": "Experian Boost",
   "key": "experian_boost",
   "kind": "industry",
   "title": "Adds on-time utility and rent payments to the Experian file only",
   "url": "https://experian.com/blogs/ask-experian/what-is-experian-boost/"
  },
  "experian_goodwill": {
   "cite": "Experian: goodwill letters",
   "key": "experian_goodwill",
   "kind": "industry",
   "title": "A courtesy request, not a dispute",
   "url": "https://www.experian.com/blogs/ask-experian/what-is-goodwill-letter/"
  },
  "fannie_au": {
   "cite": "Fannie Mae Selling Guide B3-5.3-06",
   "key": "fannie_au",
   "kind": "agency",
   "title": "Manual underwriting generally ignores authorized user tradelines",
   "url": "https://selling-guide.fanniemae.com/sel/b3-5.3-06/authorized-users-credit"
  },
  "fcra604": {
   "cite": "FCRA 604, 15 U.S.C. 1681b",
   "key": "fcra604",
   "kind": "statute",
   "title": "Permissible purposes of consumer reports",
   "url": "https://www.law.cornell.edu/uscode/text/15/1681b"
  },
  "fcra604f": {
   "cite": "FCRA 604(f), 15 U.S.C. 1681b(f)",
   "key": "fcra604f",
   "kind": "statute",
   "title": "No report without a permissible purpose",
   "url": "https://www.law.cornell.edu/uscode/text/15/1681b"
  },
  "fcra605": {
   "cite": "FCRA 605(a), 15 U.S.C. 1681c(a)",
   "key": "fcra605",
   "kind": "statute",
   "title": "Reporting limits: 7 years for most adverse items, 10 years for bankruptcy",
   "url": "https://www.law.cornell.edu/uscode/text/15/1681c"
  },
  "fcra605a1": {
   "cite": "FCRA 605(a)(1), 15 U.S.C. 1681c(a)(1)",
   "key": "fcra605a1",
   "kind": "statute",
   "title": "Bankruptcy cases: 10 years from the order for relief",
   "url": "https://www.law.cornell.edu/uscode/text/15/1681c"
  },
  "fcra605a7": {
   "cite": "FCRA 605(a)(7)-(8), 15 U.S.C. 1681c(a)",
   "key": "fcra605a7",
   "kind": "statute",
   "title": "Veterans' medical debt excluded",
   "url": "https://www.law.cornell.edu/uscode/text/15/1681c"
  },
  "fcra605a_alert": {
   "cite": "FCRA 605A(a), 15 U.S.C. 1681c-1(a)",
   "key": "fcra605a_alert",
   "kind": "statute",
   "title": "Initial fraud alert for at least 1 year; the bureau tells the other nationwide bureaus",
   "url": "https://www.law.cornell.edu/uscode/text/15/1681c-1"
  },
  "fcra605a_freeze": {
   "cite": "FCRA 605A(i), 15 U.S.C. 1681c-1(i)",
   "key": "fcra605a_freeze",
   "kind": "statute",
   "title": "Security freeze free of charge; placed within 3 business days of a mailed request",
   "url": "https://www.law.cornell.edu/uscode/text/15/1681c-1"
  },
  "fcra605b": {
   "cite": "FCRA 605B(a), 15 U.S.C. 1681c-2(a)",
   "key": "fcra605b",
   "kind": "statute",
   "title": "Block of identity theft information within 4 business days",
   "url": "https://www.law.cornell.edu/uscode/text/15/1681c-2"
  },
  "fcra605c": {
   "cite": "FCRA 605(c), 15 U.S.C. 1681c(c)",
   "key": "fcra605c",
   "kind": "statute",
   "title": "The 7 years start 180 days after the delinquency that preceded collection or charge-off",
   "url": "https://www.law.cornell.edu/uscode/text/15/1681c"
  },
  "fcra607b": {
   "cite": "FCRA 607(b), 15 U.S.C. 1681e(b)",
   "key": "fcra607b",
   "kind": "statute",
   "title": "Reasonable procedures to assure maximum possible accuracy",
   "url": "https://www.law.cornell.edu/uscode/text/15/1681e"
  },
  "fcra609": {
   "cite": "FCRA 609, 15 U.S.C. 1681g",
   "key": "fcra609",
   "kind": "statute",
   "title": "File disclosure: all information in the file and its sources",
   "url": "https://www.law.cornell.edu/uscode/text/15/1681g"
  },
  "fcra611": {
   "cite": "FCRA 611(a)(1)(A), 15 U.S.C. 1681i(a)(1)(A)",
   "key": "fcra611",
   "kind": "statute",
   "title": "Free reinvestigation within 30 days of receipt, or deletion",
   "url": "https://www.law.cornell.edu/uscode/text/15/1681i"
  },
  "fcra611a2": {
   "cite": "FCRA 611(a)(2)(A), 15 U.S.C. 1681i(a)(2)(A)",
   "key": "fcra611a2",
   "kind": "statute",
   "title": "Notice of the dispute to the furnisher within 5 business days",
   "url": "https://www.law.cornell.edu/uscode/text/15/1681i"
  },
  "fcra611a3": {
   "cite": "FCRA 611(a)(3), 15 U.S.C. 1681i(a)(3)",
   "key": "fcra611a3",
   "kind": "statute",
   "title": "Frivolous or irrelevant disputes; notice within 5 business days",
   "url": "https://www.law.cornell.edu/uscode/text/15/1681i"
  },
  "fcra611a4": {
   "cite": "FCRA 611(a)(4), 15 U.S.C. 1681i(a)(4)",
   "key": "fcra611a4",
   "kind": "statute",
   "title": "The agency must review all relevant information the consumer sends",
   "url": "https://www.law.cornell.edu/uscode/text/15/1681i"
  },
  "fcra611a5": {
   "cite": "FCRA 611(a)(5), 15 U.S.C. 1681i(a)(5)",
   "key": "fcra611a5",
   "kind": "statute",
   "title": "Delete or correct inaccurate or unverifiable items; reinsertion notice within 5 business days",
   "url": "https://www.law.cornell.edu/uscode/text/15/1681i"
  },
  "fcra611a5b": {
   "cite": "FCRA 611(a)(5)(B), 15 U.S.C. 1681i(a)(5)(B)",
   "key": "fcra611a5b",
   "kind": "statute",
   "title": "Reinsertion only after the furnisher certifies accuracy; written notice within 5 business days",
   "url": "https://www.law.cornell.edu/uscode/text/15/1681i"
  },
  "fcra611a6": {
   "cite": "FCRA 611(a)(6), 15 U.S.C. 1681i(a)(6)",
   "key": "fcra611a6",
   "kind": "statute",
   "title": "Results notice within 5 business days, with the right to a description of the procedure",
   "url": "https://www.law.cornell.edu/uscode/text/15/1681i"
  },
  "fcra611a7": {
   "cite": "FCRA 611(a)(6)(B)(iii) and (a)(7), 15 U.S.C. 1681i(a)(7)",
   "key": "fcra611a7",
   "kind": "statute",
   "title": "Description of the verification procedure within 15 days of request",
   "url": "https://www.law.cornell.edu/uscode/text/15/1681i"
  },
  "fcra611b": {
   "cite": "FCRA 611(b), 15 U.S.C. 1681i(b)",
   "key": "fcra611b",
   "kind": "statute",
   "title": "Statement of dispute (may be limited to 100 words)",
   "url": "https://www.law.cornell.edu/uscode/text/15/1681i"
  },
  "fcra611d": {
   "cite": "FCRA 611(d), 15 U.S.C. 1681i(d)",
   "key": "fcra611d",
   "kind": "statute",
   "title": "Notice of corrections to prior recipients on request",
   "url": "https://www.law.cornell.edu/uscode/text/15/1681i"
  },
  "fcra611ext": {
   "cite": "FCRA 611(a)(1)(B), 15 U.S.C. 1681i(a)(1)(B)",
   "key": "fcra611ext",
   "kind": "statute",
   "title": "Up to 15 more days when the consumer adds information",
   "url": "https://www.law.cornell.edu/uscode/text/15/1681i"
  },
  "fcra612": {
   "cite": "FCRA 612(a)(3), 15 U.S.C. 1681j(a)(3)",
   "key": "fcra612",
   "kind": "statute",
   "title": "45 days for a dispute made after a free annual report",
   "url": "https://www.law.cornell.edu/uscode/text/15/1681j"
  },
  "fcra616": {
   "cite": "FCRA 616, 15 U.S.C. 1681n",
   "key": "fcra616",
   "kind": "statute",
   "title": "Civil liability for willful noncompliance",
   "url": "https://www.law.cornell.edu/uscode/text/15/1681n"
  },
  "fcra617": {
   "cite": "FCRA 617, 15 U.S.C. 1681o",
   "key": "fcra617",
   "kind": "statute",
   "title": "Civil liability for negligent noncompliance",
   "url": "https://www.law.cornell.edu/uscode/text/15/1681o"
  },
  "fcra618": {
   "cite": "FCRA 618, 15 U.S.C. 1681p",
   "key": "fcra618",
   "kind": "statute",
   "title": "Where and when to sue: 2 years from discovery or 5 years from the violation",
   "url": "https://www.law.cornell.edu/uscode/text/15/1681p"
  },
  "fcra623a1": {
   "cite": "FCRA 623(a)(1), 15 U.S.C. 1681s-2(a)(1)",
   "key": "fcra623a1",
   "kind": "statute",
   "title": "No furnishing of information known or believed inaccurate",
   "url": "https://www.law.cornell.edu/uscode/text/15/1681s-2"
  },
  "fcra623a1f": {
   "cite": "FCRA 623(a)(1)(F), 15 U.S.C. 1681s-2(a)(1)(F)",
   "key": "fcra623a1f",
   "kind": "statute",
   "title": "CARES Act: accommodation accounts reported current",
   "url": "https://www.law.cornell.edu/uscode/text/15/1681s-2"
  },
  "fcra623a3": {
   "cite": "FCRA 623(a)(3), 15 U.S.C. 1681s-2(a)(3)",
   "key": "fcra623a3",
   "kind": "statute",
   "title": "A disputed item must be reported as disputed",
   "url": "https://www.law.cornell.edu/uscode/text/15/1681s-2"
  },
  "fcra623a5": {
   "cite": "FCRA 623(a)(5), 15 U.S.C. 1681s-2(a)(5)",
   "key": "fcra623a5",
   "kind": "statute",
   "title": "Furnishers must report the month and year the delinquency began",
   "url": "https://www.law.cornell.edu/uscode/text/15/1681s-2"
  },
  "fcra623a6": {
   "cite": "FCRA 623(a)(6), 15 U.S.C. 1681s-2(a)(6)",
   "key": "fcra623a6",
   "kind": "statute",
   "title": "No refurnishing after an identity theft report",
   "url": "https://www.law.cornell.edu/uscode/text/15/1681s-2"
  },
  "fcra623a8": {
   "cite": "FCRA 623(a)(8), 15 U.S.C. 1681s-2(a)(8)",
   "key": "fcra623a8",
   "kind": "statute",
   "title": "Direct disputes with the furnisher",
   "url": "https://www.law.cornell.edu/uscode/text/15/1681s-2"
  },
  "fcra623b": {
   "cite": "FCRA 623(b), 15 U.S.C. 1681s-2(b)",
   "key": "fcra623b",
   "kind": "statute",
   "title": "Furnisher investigation after notice from a bureau",
   "url": "https://www.law.cornell.edu/uscode/text/15/1681s-2"
  },
  "fdcpa1692c": {
   "cite": "FDCPA 805(c), 15 U.S.C. 1692c(c)",
   "key": "fdcpa1692c",
   "kind": "statute",
   "title": "Ceasing communication on written request",
   "url": "https://www.law.cornell.edu/uscode/text/15/1692c"
  },
  "fdcpa1692e8": {
   "cite": "FDCPA 807(8), 15 U.S.C. 1692e(8)",
   "key": "fdcpa1692e8",
   "kind": "statute",
   "title": "A collector may not report a debt without saying it is disputed",
   "url": "https://www.law.cornell.edu/uscode/text/15/1692e"
  },
  "fdcpa1692g": {
   "cite": "FDCPA 809(b), 15 U.S.C. 1692g(b)",
   "key": "fdcpa1692g",
   "kind": "statute",
   "title": "A timely written dispute stops collection until verification is mailed",
   "url": "https://www.law.cornell.edu/uscode/text/15/1692g"
  },
  "fico8": {
   "cite": "FICO 8 overview",
   "key": "fico8",
   "kind": "secondary",
   "title": "Sensitive to card utilization; ignores collections under $100 original balance",
   "url": "https://www.creditkarma.com/credit/i/what-fico-score-8"
  },
  "fico9": {
   "cite": "FICO 9 overview",
   "key": "fico9",
   "kind": "secondary",
   "title": "Ignores paid collections; weighs medical debt less; counts rent when reported",
   "url": "https://www.nerdwallet.com/finance/learn/fico-score-9"
  },
  "fico_versions": {
   "cite": "myFICO: score versions",
   "key": "fico_versions",
   "kind": "industry",
   "title": "Mortgage FICO 2, 4, 5; auto lenders use FICO Auto Scores; 10T adds trended data",
   "url": "https://www.myfico.com/credit-education/credit-scores/fico-score-versions"
  },
  "fico_weights": {
   "cite": "myFICO: what is in your score",
   "key": "fico_weights",
   "kind": "industry",
   "title": "Payment 35%, amounts owed 30%, length 15%, mix 10%, new 10%; inquiries count 12 months",
   "url": "https://www.myfico.com/credit-education/whats-in-your-credit-score"
  },
  "freddie_models": {
   "cite": "Freddie Mac credit score models",
   "key": "freddie_models",
   "kind": "agency",
   "title": "VantageScore 4.0 or Classic FICO for GSE loans",
   "url": "https://sf.freddiemac.com/general/credit-score-models"
  },
  "ftc_affidavit": {
   "cite": "FTC identity theft affidavit",
   "key": "ftc_affidavit",
   "kind": "agency",
   "title": "False statements to the government may violate 18 U.S.C. 1001",
   "url": "https://www.phoenix.edu/content/dam/edu/about/doc/identity-theft-affidavit-fill.pdf"
  },
  "ftc_study": {
   "cite": "FTC accuracy study (2013)",
   "key": "ftc_study",
   "kind": "agency",
   "title": "1 in 20 saw a score change above 25 points after corrections",
   "url": "https://www.ftc.gov/node/46243"
  },
  "high_scorers": {
   "cite": "High FICO scorers (2012)",
   "key": "high_scorers",
   "kind": "secondary",
   "title": "Average revolving utilization about 7%",
   "url": "https://www.cnbc.com/2012/11/07/secrets-of-high-credit-scorers.html"
  },
  "medical_policy": {
   "cite": "Equifax, Experian and TransUnion medical collections policy",
   "key": "medical_policy",
   "kind": "industry",
   "title": "Paid medical collections, those under $500 and those under 1 year old are not reported (voluntary)",
   "url": "https://newsroom.transunion.com/equifax-experian-and-transunion-remove-medical-collections-debt-under-500-from-us-credit-reports/"
  },
  "medical_rule_vacated": {
   "cite": "CFPB medical debt rule vacated (E.D. Tex., July 2025)",
   "key": "medical_rule_vacated",
   "kind": "secondary",
   "title": "The 2025 federal rule is not in force",
   "url": "https://www.checkbook.org/national/consumers-notebook/articles/Federal-Judge-Kills-CFPB-Rule-that-Banned-Medical-Debt-in-Credit-Reports-7678"
  },
  "metro2_ccc": {
   "cite": "Metro 2 compliance condition codes (public summary)",
   "key": "metro2_ccc",
   "kind": "industry",
   "title": "XB while a dispute is open; XC or XH after",
   "url": "https://bureaurelay.com/metro2/field/compliance-condition-code"
  },
  "metro2_k1": {
   "cite": "Metro 2 K1 segment (public summary)",
   "key": "metro2_k1",
   "kind": "industry",
   "title": "Collection records carry the original creditor name",
   "url": "https://bureaurelay.com/metro2/industry/debt-collectors/guide"
  },
  "metro2_k2": {
   "cite": "Metro 2 K2 segment (vendor documentation)",
   "key": "metro2_k2",
   "kind": "industry",
   "title": "Purchased debt carries purchased-from or sold-to names",
   "url": "https://docs.interprose.com/docs/debt-purchaser-credit-reporting"
  },
  "metro2_status": {
   "cite": "Metro 2 account status (public summary)",
   "key": "metro2_status",
   "kind": "industry",
   "title": "Status must align with payment rating and amount past due; 05 means transferred",
   "url": "https://bureaurelay.com/metro2/field/account-status"
  },
  "naag": {
   "cite": "NAAG: find your attorney general",
   "key": "naag",
   "kind": "agency",
   "title": "State attorneys general",
   "url": "https://www.naag.org/find-my-ag/"
  },
  "naca": {
   "cite": "NACA attorney directory",
   "key": "naca",
   "kind": "industry",
   "title": "Consumer attorneys; FCRA fee shifting",
   "url": "https://www.consumeradvocates.org/findanattorney/"
  },
  "nanp": {
   "cite": "North American Numbering Plan area codes",
   "key": "nanp",
   "kind": "industry",
   "title": "Area codes in service, from NANPA assignments as carried in libphonenumber",
   "url": "https://www.nationalnanpa.com/reports/reports_npa.html"
  },
  "nclc_timebarred": {
   "cite": "NCLC: time-barred debt",
   "key": "nclc_timebarred",
   "kind": "secondary",
   "title": "State disclosures, revival and extinguishment",
   "url": "https://library.nclc.org/article/limits-collection-time-barred-debt-and-new-fdcpa-rules"
  },
  "pay_for_delete": {
   "cite": "Pay-for-delete overview",
   "key": "pay_for_delete",
   "kind": "secondary",
   "title": "A private agreement; get it in writing before paying",
   "url": "https://www.consumeraffairs.com/finance/will-pay-for-delete-improve-my-credit-score.html"
  },
  "ramirez": {
   "cite": "TransUnion v. Ramirez (U.S. 2021)",
   "key": "ramirez",
   "kind": "secondary",
   "title": "Standing needs concrete harm such as dissemination",
   "url": "https://www.faegredrinker.com/en/insights/publications/2021/6/supreme-court-decides-transunion-llc-v-ramirez"
  },
  "rapid_rescore": {
   "cite": "Experian: rapid rescore",
   "key": "rapid_rescore",
   "kind": "industry",
   "title": "Only a lender can request it; about 2 to 5 days",
   "url": "https://experian.com/blogs/ask-experian/what-is-rapid-rescore-should-i-consider"
  },
  "rate_shop": {
   "cite": "myFICO: rate shopping",
   "key": "rate_shop",
   "kind": "industry",
   "title": "Mortgage, auto and student loan inquiries within 45 days count once (older versions 14 days)",
   "url": "https://myfico.com/credit-education/blog/rate-shop"
  },
  "regf1006_26": {
   "cite": "12 CFR 1006.26(b)",
   "key": "regf1006_26",
   "kind": "reg",
   "title": "No suit or threat of suit on time-barred debt",
   "url": "https://www.law.cornell.edu/cfr/text/12/1006.26"
  },
  "regf1006_30a": {
   "cite": "12 CFR 1006.30(a)(1)",
   "key": "regf1006_30a",
   "kind": "reg",
   "title": "No credit reporting before communicating with the consumer",
   "url": "https://www.law.cornell.edu/cfr/text/12/1006.30"
  },
  "regf1006_30a_c": {
   "cite": "Official interpretation 30(a)(1)-2",
   "key": "regf1006_30a_c",
   "kind": "reg",
   "title": "14 consecutive days after mailing is a reasonable waiting period",
   "url": "https://www.consumerfinance.gov/rules-policy/regulations/1006/2021-11-30/interp-30/"
  },
  "regf1006_30b": {
   "cite": "12 CFR 1006.30(b)",
   "key": "regf1006_30b",
   "kind": "reg",
   "title": "No sale or placement of paid, settled or discharged debt",
   "url": "https://www.law.cornell.edu/cfr/text/12/1006.30"
  },
  "regf1006_34": {
   "cite": "12 CFR 1006.34(b)(5)",
   "key": "regf1006_34",
   "kind": "reg",
   "title": "The validation period ends 30 days after you receive the validation information",
   "url": "https://www.law.cornell.edu/cfr/text/12/1006.34"
  },
  "regf1006_38": {
   "cite": "12 CFR 1006.38(c)-(d)",
   "key": "regf1006_38",
   "kind": "reg",
   "title": "Disputes and original creditor requests stop collection until answered",
   "url": "https://www.law.cornell.edu/cfr/text/12/1006.38"
  },
  "regv1022_43": {
   "cite": "12 CFR 1022.43",
   "key": "regv1022_43",
   "kind": "reg",
   "title": "Direct dispute content, address and timing",
   "url": "https://www.law.cornell.edu/cfr/text/12/1022.43"
  },
  "saunders": {
   "cite": "Saunders v. BB&T, 526 F.3d 142 (4th Cir. 2008)",
   "key": "saunders",
   "kind": "court",
   "title": "Failing to report a bona fide dispute can be materially misleading",
   "url": "https://www.bclplaw.com/a/web/101932/Use-of-Compliance-Condition-Codes.pdf"
  },
  "settlement": {
   "cite": "Paid in full versus settled",
   "key": "settlement",
   "kind": "secondary",
   "title": "Settled accounts report less than full balance",
   "url": "https://www.moneymanagement.org/blog/paid-in-full-versus-paid-off-less-than-full-balance"
  },
  "sol_table": {
   "cite": "Statute of limitations chart (SuperMoney, updated 07/23/2026)",
   "key": "sol_table",
   "kind": "secondary",
   "title": "Secondary compilation; verify with your state statute",
   "url": "https://www.supermoney.com/statute-of-limitations-on-debt"
  },
  "ssa666a7": {
   "cite": "42 U.S.C. 666(a)(7)",
   "key": "ssa666a7",
   "kind": "statute",
   "title": "States report overdue support only after notice and a reasonable chance to contest its accuracy",
   "url": "https://www.law.cornell.edu/uscode/text/42/666"
  },
  "student_rehab": {
   "cite": "NCLC: federal student loans out of default (August 2026)",
   "key": "student_rehab",
   "kind": "secondary",
   "title": "Rehabilitation: nine on-time payments; the default record is removed",
   "url": "https://studentloanborrowerassistance.org/wp-content/uploads/2026/08/2026.08_How-to-Get-Federal-Student-Loans-Out-of-Default.pdf"
  },
  "tac55_102": {
   "cite": "1 Tex. Admin. Code 55.102(b)",
   "key": "tac55_102",
   "kind": "reg",
   "title": "Past-due support reported as past due and zero months delinquent when a court order set periodic arrears payments and each was paid on time",
   "url": "https://law.cornell.edu/regulations/texas/1-Tex-Admin-Code-SS-55-102"
  },
  "tac55_103": {
   "cite": "1 Tex. Admin. Code 55.103(c)",
   "key": "tac55_103",
   "kind": "reg",
   "title": "Request administrative review within 30 days of receiving the notice and no later than 45 days from its date",
   "url": "https://law.cornell.edu/regulations/texas/1-Tex-Admin-Code-SS-55-103"
  },
  "tac55_104": {
   "cite": "1 Tex. Admin. Code 55.104",
   "key": "tac55_104",
   "kind": "reg",
   "title": "A mailed request is timely if postmarked on the last day; no good cause exception",
   "url": "https://regulations.justia.com/states/texas/title-1/part-3/chapter-55/subchapter-c/section-55-104/"
  },
  "tfc231_114": {
   "cite": "Tex. Fam. Code 231.114",
   "key": "tfc231_114",
   "kind": "statute",
   "title": "Notice before release; contest before the 30th day after the notice is mailed; the agency keeps the information updated",
   "url": "https://statutes.capitol.texas.gov/Docs/FA/htm/FA.231.htm#231.114"
  },
  "tsr310_4": {
   "cite": "16 CFR 310.4(a)(2)",
   "key": "tsr310_4",
   "kind": "reg",
   "title": "Telemarketing Sales Rule ban on advance fees for credit repair",
   "url": "https://www.law.cornell.edu/cfr/text/16/310.4"
  },
  "tu_inquiries": {
   "cite": "myFICO: inquiries",
   "key": "tu_inquiries",
   "kind": "industry",
   "title": "Inquiries stay on the report 2 years and count in FICO scores for 12 months",
   "url": "https://www.myfico.com/credit-education/whats-in-your-credit-score"
  },
  "tu_mail_list": {
   "cite": "TransUnion: dispute by mail",
   "key": "tu_mail_list",
   "kind": "industry",
   "title": "Name, date of birth, address, SSN, the company, partial account number and the reason",
   "url": "https://www.transunion.com/credit-disputes/dispute-your-credit/mail-or-phone"
  },
  "usps_2026": {
   "cite": "USPS prices effective July 12, 2026",
   "key": "usps_2026",
   "kind": "secondary",
   "title": "Forever stamp $0.82; Certified Mail $5.55",
   "url": "https://www.unlv.edu/news/unlvtoday/usps-postal-rate-increases-effective-july-12"
  },
  "util_timing": {
   "cite": "Utilization is reported from the statement balance",
   "key": "util_timing",
   "kind": "practitioner",
   "title": "Pay before the statement closes",
   "url": "https://ficoforums.myfico.com/t5/Understanding-FICO-Scoring/How-is-utilization-reported-to-FICO/m-p/6453243/highlight/true"
  },
  "vantage4": {
   "cite": "VantageScore 4.0 overview",
   "key": "vantage4",
   "kind": "secondary",
   "title": "Payment 41%, age and type 20%, utilization 20%, new 11%, balances 6%, available 2%; medical collections excluded",
   "url": "https://www.creditkarma.com/advice/i/new-vantagescore-4-0-explained"
  },
  "weekly_reports": {
   "cite": "FTC: permanent free weekly reports",
   "key": "weekly_reports",
   "kind": "agency",
   "title": "Weekly reports are permanent",
   "url": "https://consumer.ftc.gov/consumer-alerts/2023/10/you-now-have-permanent-access-free-weekly-credit-reports?os=nirstv"
  },
  "white_v_experian": {
   "cite": "White v. Experian (C.D. Cal.)",
   "key": "white_v_experian",
   "kind": "secondary",
   "title": "Bureaus must update debts discharged in bankruptcy",
   "url": "https://www.lieffcabraser.com/?p=3703"
  }
 },
 "deadlines": {
  "block_605b": {
   "business": true,
   "cite": "fcra605b",
   "days": 4,
   "from": "delivery",
   "label": "Identity theft block"
  },
  "bureau_dispute": {
   "begins_on": true,
   "business": false,
   "cite": "fcra611",
   "days": 30,
   "from": "delivery",
   "label": "Bureau must finish its reinvestigation"
  },
  "bureau_dispute_extended": {
   "begins_on": true,
   "business": false,
   "cite": "fcra611ext",
   "days": 45,
   "from": "delivery",
   "label": "Extended reinvestigation (you added information, or the dispute followed a free annual report)"
  },
  "cfpb_final": {
   "business": false,
   "cite": "cfpb_complaint",
   "days": 60,
   "from": "complaint",
   "label": "Some companies give a final response"
  },
  "cfpb_response": {
   "business": false,
   "cite": "cfpb_complaint",
   "days": 15,
   "from": "complaint",
   "label": "Company usually responds to a CFPB complaint"
  },
  "collector_wait": {
   "business": false,
   "cite": "regf1006_30a_c",
   "days": 14,
   "from": "collector_letter",
   "label": "Collector may report after this wait"
  },
  "freeze_mail": {
   "business": true,
   "cite": "fcra605a_freeze",
   "days": 3,
   "from": "delivery",
   "label": "Security freeze placed (mailed request)"
  },
  "frivolous_notice": {
   "business": true,
   "cite": "fcra611a3",
   "days": 5,
   "from": "determination",
   "label": "Notice if the bureau calls a dispute frivolous"
  },
  "furnisher_direct": {
   "begins_on": true,
   "business": false,
   "cite": "regv1022_43",
   "days": 30,
   "from": "delivery",
   "label": "Furnisher's direct dispute investigation"
  },
  "furnisher_notice": {
   "business": true,
   "cite": "fcra611a2",
   "days": 5,
   "from": "delivery",
   "label": "Bureau must notify the furnisher"
  },
  "mov": {
   "business": false,
   "cite": "fcra611a7",
   "days": 15,
   "from": "delivery",
   "label": "Description of the verification procedure"
  },
  "reinsertion_notice": {
   "business": true,
   "cite": "fcra611a5b",
   "days": 5,
   "from": "reinsertion",
   "label": "Written notice after a deleted item is put back"
  },
  "results_notice": {
   "business": true,
   "cite": "fcra611a6",
   "days": 5,
   "from": "completion",
   "label": "Results notice after the reinvestigation ends"
  },
  "validation_assumed_receipt": {
   "business": true,
   "cite": "regf1006_34",
   "days": 5,
   "from": "validation_sent",
   "label": "Collector may assume you received the notice"
  },
  "validation_period": {
   "business": false,
   "cite": "regf1006_34",
   "days": 30,
   "from": "validation_receipt",
   "label": "Validation period ends (dispute in writing before this)"
  }
 },
 "fcra_suit_years": {
  "discovery": 2,
  "violation": 5
 },
 "goals": {
  "auto_soon": {
   "note": "Reordered toward levers that can move a score within 30 to 60 days. Ranges only; no lender promises.",
   "title": "Auto loan or mortgage soon"
  },
  "standard": {
   "note": "Ordered by legal strength, expected impact and speed.",
   "title": "Standard 90-day plan"
  }
 },
 "help_links": [
  {
   "title": "CFPB complaint portal",
   "url": "https://www.consumerfinance.gov/complaint/"
  },
  {
   "title": "Find a consumer attorney (NACA)",
   "url": "https://www.consumeradvocates.org/findanattorney/"
  },
  {
   "title": "Find your state attorney general (NAAG)",
   "url": "https://www.naag.org/find-my-ag/"
  },
  {
   "title": "Free legal aid near you (Legal Services Corporation)",
   "url": "https://www.lsc.gov/about-lsc/what-legal-aid/get-legal-help"
  },
  {
   "title": "Free weekly credit reports",
   "url": "https://www.annualcreditreport.com"
  },
  {
   "title": "CFPB sample dispute letter",
   "url": "https://files.consumerfinance.gov/f/documents/092016_cfpb__CreditReportingSampleLetter.pdf"
  }
 ],
 "ladder": [
  {
   "action": "Clean up personal information; request a 609 file disclosure if sources or furnisher addresses are missing",
   "cite": [
    "fcra611",
    "fcra609"
   ],
   "letters": [
    "personal_info",
    "disclosure_609"
   ],
   "step": 0,
   "trigger": "New report imported"
  },
  {
   "action": "Bureau dispute, one issue per account, evidence attached, certified mail",
   "cite": [
    "fcra611"
   ],
   "letters": [
    "bureau_611"
   ],
   "step": 1,
   "trigger": "Error found"
  },
  {
   "action": "Direct dispute to the furnisher; ask for the dispute notation",
   "cite": [
    "fcra623a8",
    "regv1022_43",
    "fcra623a3"
   ],
   "letters": [
    "furnisher_623",
    "dispute_notation"
   ],
   "step": 2,
   "trigger": "Verified, or no answer 30 (45) days after delivery"
  },
  {
   "action": "Ask the bureau how it verified (method of verification)",
   "cite": [
    "fcra611a6",
    "fcra611a7"
   ],
   "letters": [
    "mov_611a7"
   ],
   "step": 3,
   "trigger": "Bureau says verified"
  },
  {
   "action": "Second bureau dispute with new information; CFPB complaint",
   "cite": [
    "fcra611a3",
    "regv1022_43",
    "cfpb_complaint"
   ],
   "letters": [
    "bureau_611",
    "cfpb_complaint"
   ],
   "step": 4,
   "trigger": "No or vague description after 15 days, or no furnisher answer after 30 days"
  },
  {
   "action": "State attorney general complaint",
   "cite": [
    "naag"
   ],
   "letters": [
    "state_ag_complaint"
   ],
   "step": 5,
   "trigger": "CFPB complaint closed without relief"
  },
  {
   "action": "Talk to a consumer attorney (NACA); small claims information; notice of dispute and potential claim",
   "cite": [
    "fcra616",
    "fcra617",
    "fcra618",
    "naca"
   ],
   "letters": [
    "intent_to_sue",
    "small_claims_outline"
   ],
   "step": 6,
   "trigger": "Documented, still-inaccurate item that was shared with a lender and caused harm"
  }
 ],
 "letter_clocks": {
  "bankruptcy_correction": [
   "bureau_dispute",
   "furnisher_notice"
  ],
  "block_605b": [
   "block_605b"
  ],
  "bureau_611": [
   "bureau_dispute",
   "furnisher_notice"
  ],
  "cares_act": [
   "bureau_dispute",
   "furnisher_notice"
  ],
  "cease_1692c": [],
  "cfpb_complaint": [
   "cfpb_response",
   "cfpb_final"
  ],
  "child_support_records": [],
  "child_support_zero_delinquent": [
   "furnisher_direct"
  ],
  "consumer_statement": [],
  "disclosure_609": [],
  "dispute_notation": [
   "furnisher_direct"
  ],
  "fraud_alert": [],
  "furnisher_623": [
   "furnisher_direct"
  ],
  "goodwill": [],
  "inquiry_removal": [],
  "intent_to_sue": [],
  "mov_611a7": [
   "mov"
  ],
  "oag_review_request": [],
  "obsolete_605": [
   "bureau_dispute",
   "furnisher_notice"
  ],
  "pay_for_delete": [],
  "personal_info": [
   "bureau_dispute"
  ],
  "reinsertion_demand": [
   "bureau_dispute"
  ],
  "security_freeze": [
   "freeze_mail"
  ],
  "settlement": [],
  "small_claims_outline": [],
  "state_ag_complaint": [],
  "validation_regf": [],
  "written_only": []
 },
 "letters": {
  "bankruptcy_correction": {
   "cite": [
    "fcra611",
    "fcra607b",
    "white_v_experian"
   ],
   "title": "Bankruptcy discharge correction",
   "to": "bureau"
  },
  "block_605b": {
   "cite": [
    "fcra605b",
    "fcra623a6"
   ],
   "title": "Identity theft block (FCRA 605B)",
   "to": "bureau"
  },
  "bureau_611": {
   "cite": [
    "fcra611",
    "fcra611a4",
    "fcra607b"
   ],
   "title": "Dispute to a credit bureau (FCRA 611)",
   "to": "bureau"
  },
  "cares_act": {
   "cite": [
    "fcra623a1f",
    "fcra611"
   ],
   "title": "CARES Act accommodation dispute",
   "to": "bureau"
  },
  "cease_1692c": {
   "cite": [
    "fdcpa1692c"
   ],
   "title": "Request to stop communication (FDCPA 805(c))",
   "to": "furnisher"
  },
  "cfpb_complaint": {
   "cite": [
    "cfpb_complaint"
   ],
   "title": "CFPB complaint text",
   "to": "complaint"
  },
  "child_support_records": {
   "cite": [
    "tfc231_114"
   ],
   "title": "Texas child support: payment record request",
   "to": "agency"
  },
  "child_support_zero_delinquent": {
   "cite": [
    "tac55_102",
    "fcra623a8",
    "regv1022_43"
   ],
   "title": "Texas child support: report as zero months delinquent (1 TAC 55.102)",
   "to": "furnisher"
  },
  "consumer_statement": {
   "cite": [
    "fcra611b"
   ],
   "title": "Consumer statement for the file (FCRA 611(b))",
   "to": "bureau"
  },
  "disclosure_609": {
   "cite": [
    "fcra609",
    "experian_609"
   ],
   "title": "File disclosure request (FCRA 609)",
   "to": "bureau"
  },
  "dispute_notation": {
   "cite": [
    "fcra623a3",
    "saunders"
   ],
   "title": "Request to report the account as disputed (FCRA 623(a)(3))",
   "to": "furnisher"
  },
  "fraud_alert": {
   "cite": [
    "fcra605a_alert"
   ],
   "title": "Initial fraud alert request (FCRA 605A(a))",
   "to": "bureau"
  },
  "furnisher_623": {
   "cite": [
    "fcra623a8",
    "regv1022_43",
    "fcra623a3"
   ],
   "title": "Direct dispute to the furnisher (FCRA 623, 12 CFR 1022.43)",
   "to": "furnisher"
  },
  "goodwill": {
   "cite": [
    "experian_goodwill"
   ],
   "title": "Goodwill request",
   "to": "furnisher"
  },
  "inquiry_removal": {
   "cite": [
    "fcra604",
    "fcra604f"
   ],
   "title": "Permissible purpose request for an inquiry",
   "to": "inquirer"
  },
  "intent_to_sue": {
   "cite": [
    "fcra616",
    "fcra617",
    "fcra618"
   ],
   "title": "Notice of dispute and potential claim",
   "to": "furnisher"
  },
  "mov_611a7": {
   "cite": [
    "fcra611a6",
    "fcra611a7"
   ],
   "title": "Method of verification request (FCRA 611(a)(7))",
   "to": "bureau"
  },
  "oag_review_request": {
   "cite": [
    "tac55_103",
    "tac55_104",
    "tfc231_114",
    "ssa666a7"
   ],
   "title": "Texas child support: administrative review of a credit report notice (1 TAC 55.103)",
   "to": "agency"
  },
  "obsolete_605": {
   "cite": [
    "fcra605",
    "fcra605c",
    "fcra611"
   ],
   "title": "Obsolete item removal (FCRA 605)",
   "to": "bureau"
  },
  "pay_for_delete": {
   "cite": [
    "pay_for_delete"
   ],
   "title": "Pay-for-delete offer",
   "to": "furnisher"
  },
  "personal_info": {
   "cite": [
    "fcra611",
    "fcra607b"
   ],
   "title": "Personal information correction",
   "to": "bureau"
  },
  "reinsertion_demand": {
   "cite": [
    "fcra611a5b"
   ],
   "title": "Reinsertion notice demand (FCRA 611(a)(5)(B))",
   "to": "bureau"
  },
  "security_freeze": {
   "cite": [
    "fcra605a_freeze"
   ],
   "title": "Security freeze request (FCRA 605A(i))",
   "to": "bureau"
  },
  "settlement": {
   "cite": [
    "settlement",
    "pay_for_delete"
   ],
   "title": "Settlement offer with a reporting term",
   "to": "furnisher"
  },
  "small_claims_outline": {
   "cite": [
    "fcra618",
    "fcra616",
    "fcra617"
   ],
   "title": "Small claims outline",
   "to": "complaint"
  },
  "state_ag_complaint": {
   "cite": [
    "naag"
   ],
   "title": "State attorney general complaint text",
   "to": "complaint"
  },
  "validation_regf": {
   "cite": [
    "regf1006_34",
    "regf1006_38",
    "fdcpa1692g",
    "regf1006_30a"
   ],
   "title": "Debt validation dispute and original creditor request (Reg F)",
   "to": "furnisher"
  },
  "written_only": {
   "cite": [],
   "title": "Request for written communication only",
   "to": "furnisher"
  }
 },
 "medical": {
  "min_balance_cents": 50000,
  "state_laws": [
   "CA",
   "CO",
   "CT",
   "DE",
   "IL",
   "ME",
   "MD",
   "MN",
   "NJ",
   "NY",
   "OR",
   "RI",
   "VT",
   "VA",
   "WA"
  ],
  "wait_days": 365
 },
 "nanp": {
  "201": [
   "geographic",
   "New Jersey"
  ],
  "202": [
   "geographic",
   "District of Columbia"
  ],
  "203": [
   "geographic",
   "Connecticut"
  ],
  "204": [
   "geographic",
   "Manitoba"
  ],
  "205": [
   "geographic",
   "Alabama"
  ],
  "206": [
   "geographic",
   "Washington"
  ],
  "207": [
   "geographic",
   "Maine"
  ],
  "208": [
   "geographic",
   "Idaho"
  ],
  "209": [
   "geographic",
   "California"
  ],
  "210": [
   "geographic",
   "Texas"
  ],
  "212": [
   "geographic",
   "New York"
  ],
  "213": [
   "geographic",
   "California"
  ],
  "214": [
   "geographic",
   "Texas"
  ],
  "215": [
   "geographic",
   "Pennsylvania"
  ],
  "216": [
   "geographic",
   "Ohio"
  ],
  "217": [
   "geographic",
   "Illinois"
  ],
  "218": [
   "geographic",
   "Minnesota"
  ],
  "219": [
   "geographic",
   "Indiana"
  ],
  "220": [
   "geographic",
   "Ohio"
  ],
  "223": [
   "geographic",
   "Pennsylvania"
  ],
  "224": [
   "geographic",
   "Illinois"
  ],
  "225": [
   "geographic",
   "Louisiana"
  ],
  "226": [
   "geographic",
   "Ontario"
  ],
  "227": [
   "geographic",
   "Maryland"
  ],
  "228": [
   "geographic",
   "Mississippi"
  ],
  "229": [
   "geographic",
   "Georgia"
  ],
  "231": [
   "geographic",
   "Michigan"
  ],
  "234": [
   "geographic",
   "Ohio"
  ],
  "235": [
   "geographic",
   "Missouri"
  ],
  "236": [
   "geographic",
   "British Columbia"
  ],
  "239": [
   "geographic",
   "Florida"
  ],
  "240": [
   "geographic",
   "Maryland"
  ],
  "242": [
   "geographic",
   "Bahamas"
  ],
  "246": [
   "geographic",
   "Barbados"
  ],
  "248": [
   "geographic",
   "Michigan"
  ],
  "249": [
   "geographic",
   "Ontario"
  ],
  "250": [
   "geographic",
   "British Columbia"
  ],
  "251": [
   "geographic",
   "Alabama"
  ],
  "252": [
   "geographic",
   "North Carolina"
  ],
  "253": [
   "geographic",
   "Washington"
  ],
  "254": [
   "geographic",
   "Texas"
  ],
  "256": [
   "geographic",
   "Alabama"
  ],
  "257": [
   "geographic",
   "British Colombia"
  ],
  "260": [
   "geographic",
   "Indiana"
  ],
  "262": [
   "geographic",
   "Wisconsin"
  ],
  "263": [
   "geographic",
   "Quebec"
  ],
  "267": [
   "geographic",
   "Pennsylvania"
  ],
  "268": [
   "geographic",
   "Antigua and Barbuda"
  ],
  "269": [
   "geographic",
   "Michigan"
  ],
  "270": [
   "geographic",
   "Kentucky"
  ],
  "272": [
   "geographic",
   "Pennsylvania"
  ],
  "273": [
   "geographic",
   "Quebec"
  ],
  "274": [
   "geographic",
   "Wisconsin"
  ],
  "276": [
   "geographic",
   "Virginia"
  ],
  "279": [
   "geographic",
   "California"
  ],
  "281": [
   "geographic",
   "Texas"
  ],
  "283": [
   "geographic",
   "Ohio"
  ],
  "284": [
   "geographic",
   "British Virgin Islands"
  ],
  "289": [
   "geographic",
   "Ontario"
  ],
  "301": [
   "geographic",
   "Maryland"
  ],
  "302": [
   "geographic",
   "Delaware"
  ],
  "303": [
   "geographic",
   "Colorado"
  ],
  "304": [
   "geographic",
   "West Virginia"
  ],
  "305": [
   "geographic",
   "Florida"
  ],
  "306": [
   "geographic",
   "Saskatchewan"
  ],
  "307": [
   "geographic",
   "Wyoming"
  ],
  "308": [
   "geographic",
   "Nebraska"
  ],
  "309": [
   "geographic",
   "Illinois"
  ],
  "310": [
   "geographic",
   "California"
  ],
  "312": [
   "geographic",
   "Illinois"
  ],
  "313": [
   "geographic",
   "Michigan"
  ],
  "314": [
   "geographic",
   "Missouri"
  ],
  "315": [
   "geographic",
   "New York"
  ],
  "316": [
   "geographic",
   "Kansas"
  ],
  "317": [
   "geographic",
   "Indiana"
  ],
  "318": [
   "geographic",
   "Louisiana"
  ],
  "319": [
   "geographic",
   "Iowa"
  ],
  "320": [
   "geographic",
   "Minnesota"
  ],
  "321": [
   "geographic",
   "Florida"
  ],
  "323": [
   "geographic",
   "California"
  ],
  "324": [
   "geographic",
   "Florida"
  ],
  "325": [
   "geographic",
   "Texas"
  ],
  "326": [
   "geographic",
   "Ohio"
  ],
  "327": [
   "geographic",
   "Arkansas"
  ],
  "329": [
   "geographic",
   "New York"
  ],
  "330": [
   "geographic",
   "Ohio"
  ],
  "331": [
   "geographic",
   "Illinois"
  ],
  "332": [
   "geographic",
   "New York"
  ],
  "334": [
   "geographic",
   "Alabama"
  ],
  "336": [
   "geographic",
   "North Carolina"
  ],
  "337": [
   "geographic",
   "Louisiana"
  ],
  "339": [
   "geographic",
   "Massachusetts"
  ],
  "340": [
   "geographic",
   "U.S. Virgin Islands"
  ],
  "341": [
   "geographic",
   "California"
  ],
  "343": [
   "geographic",
   "Ontario"
  ],
  "345": [
   "geographic",
   "Cayman Islands"
  ],
  "346": [
   "geographic",
   "Texas"
  ],
  "347": [
   "geographic",
   "New York"
  ],
  "350": [
   "geographic",
   "California"
  ],
  "351": [
   "geographic",
   "Massachusetts"
  ],
  "352": [
   "geographic",
   "Florida"
  ],
  "353": [
   "geographic",
   "Wisconsin"
  ],
  "354": [
   "geographic",
   "Quebec"
  ],
  "360": [
   "geographic",
   "Washington"
  ],
  "361": [
   "geographic",
   "Texas"
  ],
  "363": [
   "geographic",
   "New York"
  ],
  "364": [
   "geographic",
   "Kentucky"
  ],
  "365": [
   "geographic",
   "Ontario"
  ],
  "367": [
   "geographic",
   "Quebec"
  ],
  "368": [
   "geographic",
   "Alberta"
  ],
  "369": [
   "geographic",
   "California"
  ],
  "380": [
   "geographic",
   "Ohio"
  ],
  "382": [
   "geographic",
   "Ontario"
  ],
  "385": [
   "geographic",
   "Utah"
  ],
  "386": [
   "geographic",
   "Florida"
  ],
  "401": [
   "geographic",
   "Rhode Island"
  ],
  "402": [
   "geographic",
   "Nebraska"
  ],
  "403": [
   "geographic",
   "Alberta"
  ],
  "404": [
   "geographic",
   "Georgia"
  ],
  "405": [
   "geographic",
   "Oklahoma"
  ],
  "406": [
   "geographic",
   "Montana"
  ],
  "407": [
   "geographic",
   "Florida"
  ],
  "408": [
   "geographic",
   "California"
  ],
  "409": [
   "geographic",
   "Texas"
  ],
  "410": [
   "geographic",
   "Maryland"
  ],
  "412": [
   "geographic",
   "Pennsylvania"
  ],
  "413": [
   "geographic",
   "Massachusetts"
  ],
  "414": [
   "geographic",
   "Wisconsin"
  ],
  "415": [
   "geographic",
   "California"
  ],
  "416": [
   "geographic",
   "Ontario"
  ],
  "417": [
   "geographic",
   "Missouri"
  ],
  "418": [
   "geographic",
   "Quebec"
  ],
  "419": [
   "geographic",
   "Ohio"
  ],
  "423": [
   "geographic",
   "Tennessee"
  ],
  "424": [
   "geographic",
   "California"
  ],
  "425": [
   "geographic",
   "Washington"
  ],
  "428": [
   "geographic",
   "New Brunswick"
  ],
  "430": [
   "geographic",
   "Texas"
  ],
  "431": [
   "geographic",
   "Manitoba"
  ],
  "432": [
   "geographic",
   "Texas"
  ],
  "434": [
   "geographic",
   "Virginia"
  ],
  "435": [
   "geographic",
   "Utah"
  ],
  "437": [
   "geographic",
   "Ontario"
  ],
  "438": [
   "geographic",
   "Quebec"
  ],
  "440": [
   "geographic",
   "Ohio"
  ],
  "441": [
   "geographic",
   "Bermuda"
  ],
  "442": [
   "geographic",
   "California"
  ],
  "443": [
   "geographic",
   "Maryland"
  ],
  "445": [
   "geographic",
   "Pennsylvania"
  ],
  "447": [
   "geographic",
   "Illinois"
  ],
  "448": [
   "geographic",
   "Florida"
  ],
  "450": [
   "geographic",
   "Quebec"
  ],
  "458": [
   "geographic",
   "Oregon"
  ],
  "463": [
   "geographic",
   "Indiana"
  ],
  "464": [
   "geographic",
   "Illinois"
  ],
  "468": [
   "geographic",
   "Quebec"
  ],
  "469": [
   "geographic",
   "Texas"
  ],
  "470": [
   "geographic",
   "Georgia"
  ],
  "472": [
   "geographic",
   "North Carolina"
  ],
  "473": [
   "geographic",
   "Grenada"
  ],
  "474": [
   "geographic",
   "Saskatchewan"
  ],
  "475": [
   "geographic",
   "Connecticut"
  ],
  "478": [
   "geographic",
   "Georgia"
  ],
  "479": [
   "geographic",
   "Arkansas"
  ],
  "480": [
   "geographic",
   "Arizona"
  ],
  "484": [
   "geographic",
   "Pennsylvania"
  ],
  "500": [
   "personal",
   ""
  ],
  "501": [
   "geographic",
   "Arkansas"
  ],
  "502": [
   "geographic",
   "Kentucky"
  ],
  "503": [
   "geographic",
   "Oregon"
  ],
  "504": [
   "geographic",
   "Louisiana"
  ],
  "505": [
   "geographic",
   "New Mexico"
  ],
  "506": [
   "geographic",
   "New Brunswick"
  ],
  "507": [
   "geographic",
   "Minnesota"
  ],
  "508": [
   "geographic",
   "Massachusetts"
  ],
  "509": [
   "geographic",
   "Washington"
  ],
  "510": [
   "geographic",
   "California"
  ],
  "512": [
   "geographic",
   "Texas"
  ],
  "513": [
   "geographic",
   "Ohio"
  ],
  "514": [
   "geographic",
   "Quebec"
  ],
  "515": [
   "geographic",
   "Iowa"
  ],
  "516": [
   "geographic",
   "New York"
  ],
  "517": [
   "geographic",
   "Michigan"
  ],
  "518": [
   "geographic",
   "New York"
  ],
  "519": [
   "geographic",
   "Ontario"
  ],
  "520": [
   "geographic",
   "Arizona"
  ],
  "521": [
   "personal",
   ""
  ],
  "522": [
   "personal",
   ""
  ],
  "523": [
   "personal",
   ""
  ],
  "524": [
   "personal",
   ""
  ],
  "525": [
   "personal",
   ""
  ],
  "526": [
   "personal",
   ""
  ],
  "527": [
   "personal",
   ""
  ],
  "528": [
   "personal",
   ""
  ],
  "529": [
   "personal",
   ""
  ],
  "530": [
   "geographic",
   "California"
  ],
  "531": [
   "geographic",
   "Nebraska"
  ],
  "532": [
   "personal",
   ""
  ],
  "533": [
   "personal",
   ""
  ],
  "534": [
   "geographic",
   "Wisconsin"
  ],
  "539": [
   "geographic",
   "Oklahoma"
  ],
  "540": [
   "geographic",
   "Virginia"
  ],
  "541": [
   "geographic",
   "Oregon"
  ],
  "544": [
   "personal",
   ""
  ],
  "548": [
   "geographic",
   "Ontario"
  ],
  "551": [
   "geographic",
   "New Jersey"
  ],
  "557": [
   "geographic",
   "Missouri"
  ],
  "559": [
   "geographic",
   "California"
  ],
  "561": [
   "geographic",
   "Florida"
  ],
  "562": [
   "geographic",
   "California"
  ],
  "563": [
   "geographic",
   "Iowa"
  ],
  "564": [
   "geographic",
   "Washington"
  ],
  "566": [
   "personal",
   ""
  ],
  "567": [
   "geographic",
   "Ohio"
  ],
  "570": [
   "geographic",
   "Pennsylvania"
  ],
  "571": [
   "geographic",
   "Virginia"
  ],
  "572": [
   "geographic",
   "Oklahoma"
  ],
  "573": [
   "geographic",
   "Missouri"
  ],
  "574": [
   "geographic",
   "Indiana"
  ],
  "575": [
   "geographic",
   "New Mexico"
  ],
  "577": [
   "personal",
   ""
  ],
  "579": [
   "geographic",
   "Quebec"
  ],
  "580": [
   "geographic",
   "Oklahoma"
  ],
  "581": [
   "geographic",
   "Quebec"
  ],
  "582": [
   "geographic",
   "Pennsylvania"
  ],
  "584": [
   "geographic",
   "Manitoba"
  ],
  "585": [
   "geographic",
   "New York"
  ],
  "586": [
   "geographic",
   "Michigan"
  ],
  "587": [
   "geographic",
   "Alberta"
  ],
  "588": [
   "personal",
   ""
  ],
  "600": [
   "non_geographic",
   ""
  ],
  "601": [
   "geographic",
   "Mississippi"
  ],
  "602": [
   "geographic",
   "Arizona"
  ],
  "603": [
   "geographic",
   "New Hampshire"
  ],
  "604": [
   "geographic",
   "British Columbia"
  ],
  "605": [
   "geographic",
   "South Dakota"
  ],
  "606": [
   "geographic",
   "Kentucky"
  ],
  "607": [
   "geographic",
   "New York"
  ],
  "608": [
   "geographic",
   "Wisconsin"
  ],
  "609": [
   "geographic",
   "New Jersey"
  ],
  "610": [
   "geographic",
   "Pennsylvania"
  ],
  "612": [
   "geographic",
   "Minnesota"
  ],
  "613": [
   "geographic",
   "Ontario"
  ],
  "614": [
   "geographic",
   "Ohio"
  ],
  "615": [
   "geographic",
   "Tennessee"
  ],
  "616": [
   "geographic",
   "Michigan"
  ],
  "617": [
   "geographic",
   "Massachusetts"
  ],
  "618": [
   "geographic",
   "Illinois"
  ],
  "619": [
   "geographic",
   "California"
  ],
  "620": [
   "geographic",
   "Kansas"
  ],
  "622": [
   "personal",
   ""
  ],
  "623": [
   "geographic",
   "Arizona"
  ],
  "626": [
   "geographic",
   "California"
  ],
  "628": [
   "geographic",
   "California"
  ],
  "629": [
   "geographic",
   "Tennessee"
  ],
  "630": [
   "geographic",
   "Illinois"
  ],
  "631": [
   "geographic",
   "New York"
  ],
  "633": [
   "personal",
   ""
  ],
  "636": [
   "geographic",
   "Missouri"
  ],
  "639": [
   "geographic",
   "Saskatchewan"
  ],
  "640": [
   "geographic",
   "New Jersey"
  ],
  "641": [
   "geographic",
   "Iowa"
  ],
  "645": [
   "geographic",
   "Florida"
  ],
  "646": [
   "geographic",
   "New York"
  ],
  "647": [
   "geographic",
   "Ontario"
  ],
  "649": [
   "geographic",
   "Turks and Caicos Islands"
  ],
  "650": [
   "geographic",
   "California"
  ],
  "651": [
   "geographic",
   "Minnesota"
  ],
  "656": [
   "geographic",
   "Florida"
  ],
  "657": [
   "geographic",
   "California"
  ],
  "658": [
   "geographic",
   "Jamaica"
  ],
  "659": [
   "geographic",
   "Alabama"
  ],
  "660": [
   "geographic",
   "Missouri"
  ],
  "661": [
   "geographic",
   "California"
  ],
  "662": [
   "geographic",
   "Mississippi"
  ],
  "664": [
   "geographic",
   "Montserrat"
  ],
  "667": [
   "geographic",
   "Maryland"
  ],
  "669": [
   "geographic",
   "California"
  ],
  "670": [
   "geographic",
   "Northern Mariana Islands"
  ],
  "671": [
   "geographic",
   "Guam"
  ],
  "672": [
   "geographic",
   "British Columbia"
  ],
  "678": [
   "geographic",
   "Georgia"
  ],
  "680": [
   "geographic",
   "New York"
  ],
  "681": [
   "geographic",
   "West Virginia"
  ],
  "682": [
   "geographic",
   "Texas"
  ],
  "683": [
   "geographic",
   "Ontario"
  ],
  "684": [
   "geographic",
   "American Samoa"
  ],
  "686": [
   "geographic",
   "Virginia"
  ],
  "689": [
   "geographic",
   "Florida"
  ],
  "701": [
   "geographic",
   "North Dakota"
  ],
  "702": [
   "geographic",
   "Nevada"
  ],
  "703": [
   "geographic",
   "Virginia"
  ],
  "704": [
   "geographic",
   "North Carolina"
  ],
  "705": [
   "geographic",
   "Ontario"
  ],
  "706": [
   "geographic",
   "Georgia"
  ],
  "707": [
   "geographic",
   "California"
  ],
  "708": [
   "geographic",
   "Illinois"
  ],
  "709": [
   "geographic",
   "Newfoundland and Labrador"
  ],
  "712": [
   "geographic",
   "Iowa"
  ],
  "713": [
   "geographic",
   "Texas"
  ],
  "714": [
   "geographic",
   "California"
  ],
  "715": [
   "geographic",
   "Wisconsin"
  ],
  "716": [
   "geographic",
   "New York"
  ],
  "717": [
   "geographic",
   "Pennsylvania"
  ],
  "718": [
   "geographic",
   "New York"
  ],
  "719": [
   "geographic",
   "Colorado"
  ],
  "720": [
   "geographic",
   "Colorado"
  ],
  "721": [
   "geographic",
   "Sint Maarten"
  ],
  "724": [
   "geographic",
   "Pennsylvania"
  ],
  "725": [
   "geographic",
   "Nevada"
  ],
  "726": [
   "geographic",
   "Texas"
  ],
  "727": [
   "geographic",
   "Florida"
  ],
  "728": [
   "geographic",
   "Florida"
  ],
  "730": [
   "geographic",
   "Illinois"
  ],
  "731": [
   "geographic",
   "Tennessee"
  ],
  "732": [
   "geographic",
   "New Jersey"
  ],
  "734": [
   "geographic",
   "Michigan"
  ],
  "737": [
   "geographic",
   "Texas"
  ],
  "738": [
   "geographic",
   "California"
  ],
  "740": [
   "geographic",
   "Ohio"
  ],
  "742": [
   "geographic",
   "Ontario"
  ],
  "743": [
   "geographic",
   "North Carolina"
  ],
  "747": [
   "geographic",
   "California"
  ],
  "748": [
   "geographic",
   "Colorado"
  ],
  "753": [
   "geographic",
   "Ontario"
  ],
  "754": [
   "geographic",
   "Florida"
  ],
  "757": [
   "geographic",
   "Virginia"
  ],
  "758": [
   "geographic",
   "Saint Lucia"
  ],
  "760": [
   "geographic",
   "California"
  ],
  "762": [
   "geographic",
   "Georgia"
  ],
  "763": [
   "geographic",
   "Minnesota"
  ],
  "765": [
   "geographic",
   "Indiana"
  ],
  "769": [
   "geographic",
   "Mississippi"
  ],
  "770": [
   "geographic",
   "Georgia"
  ],
  "771": [
   "geographic",
   "District of Columbia"
  ],
  "772": [
   "geographic",
   "Florida"
  ],
  "773": [
   "geographic",
   "Illinois"
  ],
  "774": [
   "geographic",
   "Massachusetts"
  ],
  "775": [
   "geographic",
   "Nevada"
  ],
  "778": [
   "geographic",
   "British Columbia"
  ],
  "779": [
   "geographic",
   "Illinois"
  ],
  "780": [
   "geographic",
   "Alberta"
  ],
  "781": [
   "geographic",
   "Massachusetts"
  ],
  "782": [
   "geographic",
   "Nova Scotia and Prince Edward Island"
  ],
  "784": [
   "geographic",
   "Saint Vincent and the Grenadines"
  ],
  "785": [
   "geographic",
   "Kansas"
  ],
  "786": [
   "geographic",
   "Florida"
  ],
  "787": [
   "geographic",
   "Puerto Rico"
  ],
  "800": [
   "toll_free",
   ""
  ],
  "801": [
   "geographic",
   "Utah"
  ],
  "802": [
   "geographic",
   "Vermont"
  ],
  "803": [
   "geographic",
   "South Carolina"
  ],
  "804": [
   "geographic",
   "Virginia"
  ],
  "805": [
   "geographic",
   "California"
  ],
  "806": [
   "geographic",
   "Texas"
  ],
  "807": [
   "geographic",
   "Ontario"
  ],
  "808": [
   "geographic",
   "Hawaii"
  ],
  "809": [
   "geographic",
   "Dominican Republic"
  ],
  "810": [
   "geographic",
   "Michigan"
  ],
  "812": [
   "geographic",
   "Indiana"
  ],
  "813": [
   "geographic",
   "Florida"
  ],
  "814": [
   "geographic",
   "Pennsylvania"
  ],
  "815": [
   "geographic",
   "Illinois"
  ],
  "816": [
   "geographic",
   "Missouri"
  ],
  "817": [
   "geographic",
   "Texas"
  ],
  "818": [
   "geographic",
   "California"
  ],
  "819": [
   "geographic",
   "Quebec"
  ],
  "820": [
   "geographic",
   "California"
  ],
  "821": [
   "geographic",
   "South Carolina"
  ],
  "825": [
   "geographic",
   "Alberta"
  ],
  "826": [
   "geographic",
   "Virginia"
  ],
  "828": [
   "geographic",
   "North Carolina"
  ],
  "829": [
   "geographic",
   "Dominican Republic"
  ],
  "830": [
   "geographic",
   "Texas"
  ],
  "831": [
   "geographic",
   "California"
  ],
  "832": [
   "geographic",
   "Texas"
  ],
  "833": [
   "toll_free",
   ""
  ],
  "835": [
   "geographic",
   "Pennsylvania"
  ],
  "838": [
   "geographic",
   "New York"
  ],
  "839": [
   "geographic",
   "South Carolina"
  ],
  "840": [
   "geographic",
   "California"
  ],
  "843": [
   "geographic",
   "South Carolina"
  ],
  "844": [
   "toll_free",
   ""
  ],
  "845": [
   "geographic",
   "New York"
  ],
  "847": [
   "geographic",
   "Illinois"
  ],
  "848": [
   "geographic",
   "New Jersey"
  ],
  "849": [
   "geographic",
   "Dominican Republic"
  ],
  "850": [
   "geographic",
   "Florida"
  ],
  "854": [
   "geographic",
   "South Carolina"
  ],
  "855": [
   "toll_free",
   ""
  ],
  "856": [
   "geographic",
   "New Jersey"
  ],
  "857": [
   "geographic",
   "Massachusetts"
  ],
  "858": [
   "geographic",
   "California"
  ],
  "859": [
   "geographic",
   "Kentucky"
  ],
  "860": [
   "geographic",
   "Connecticut"
  ],
  "862": [
   "geographic",
   "New Jersey"
  ],
  "863": [
   "geographic",
   "Florida"
  ],
  "864": [
   "geographic",
   "South Carolina"
  ],
  "865": [
   "geographic",
   "Tennessee"
  ],
  "866": [
   "toll_free",
   ""
  ],
  "867": [
   "geographic",
   "Northwest Territories, Nunavut and Yukon"
  ],
  "868": [
   "geographic",
   "Trinidad and Tobago"
  ],
  "869": [
   "geographic",
   "Saint Kitts and Nevis"
  ],
  "870": [
   "geographic",
   "Arkansas"
  ],
  "872": [
   "geographic",
   "Illinois"
  ],
  "873": [
   "geographic",
   "Quebec"
  ],
  "876": [
   "geographic",
   "Jamaica"
  ],
  "877": [
   "toll_free",
   ""
  ],
  "878": [
   "geographic",
   "Pennsylvania"
  ],
  "879": [
   "geographic",
   "Newfoundland and Labrador"
  ],
  "888": [
   "toll_free",
   ""
  ],
  "900": [
   "premium",
   ""
  ],
  "901": [
   "geographic",
   "Tennessee"
  ],
  "902": [
   "geographic",
   "Nova Scotia and Prince Edward Island"
  ],
  "903": [
   "geographic",
   "Texas"
  ],
  "904": [
   "geographic",
   "Florida"
  ],
  "905": [
   "geographic",
   "Ontario"
  ],
  "906": [
   "geographic",
   "Michigan"
  ],
  "907": [
   "geographic",
   "Alaska"
  ],
  "908": [
   "geographic",
   "New Jersey"
  ],
  "909": [
   "geographic",
   "California"
  ],
  "910": [
   "geographic",
   "North Carolina"
  ],
  "912": [
   "geographic",
   "Georgia"
  ],
  "913": [
   "geographic",
   "Kansas"
  ],
  "914": [
   "geographic",
   "New York"
  ],
  "915": [
   "geographic",
   "Texas"
  ],
  "916": [
   "geographic",
   "California"
  ],
  "917": [
   "geographic",
   "New York"
  ],
  "918": [
   "geographic",
   "Oklahoma"
  ],
  "919": [
   "geographic",
   "North Carolina"
  ],
  "920": [
   "geographic",
   "Wisconsin"
  ],
  "925": [
   "geographic",
   "California"
  ],
  "928": [
   "geographic",
   "Arizona"
  ],
  "929": [
   "geographic",
   "New York"
  ],
  "930": [
   "geographic",
   "Indiana"
  ],
  "931": [
   "geographic",
   "Tennessee"
  ],
  "934": [
   "geographic",
   "New York"
  ],
  "936": [
   "geographic",
   "Texas"
  ],
  "937": [
   "geographic",
   "Ohio"
  ],
  "938": [
   "geographic",
   "Alabama"
  ],
  "939": [
   "geographic",
   "Puerto Rico"
  ],
  "940": [
   "geographic",
   "Texas"
  ],
  "941": [
   "geographic",
   "Florida"
  ],
  "942": [
   "geographic",
   "Ontario"
  ],
  "943": [
   "geographic",
   "Georgia"
  ],
  "945": [
   "geographic",
   "Texas"
  ],
  "947": [
   "geographic",
   "Michigan"
  ],
  "948": [
   "geographic",
   "Virginia"
  ],
  "949": [
   "geographic",
   "California"
  ],
  "951": [
   "geographic",
   "California"
  ],
  "952": [
   "geographic",
   "Minnesota"
  ],
  "954": [
   "geographic",
   "Florida"
  ],
  "956": [
   "geographic",
   "Texas"
  ],
  "959": [
   "geographic",
   "Connecticut"
  ],
  "970": [
   "geographic",
   "Colorado"
  ],
  "971": [
   "geographic",
   "Oregon"
  ],
  "972": [
   "geographic",
   "Texas"
  ],
  "973": [
   "geographic",
   "New Jersey"
  ],
  "975": [
   "geographic",
   "Missouri"
  ],
  "978": [
   "geographic",
   "Massachusetts"
  ],
  "979": [
   "geographic",
   "Texas"
  ],
  "980": [
   "geographic",
   "North Carolina"
  ],
  "983": [
   "geographic",
   "Colorado"
  ],
  "984": [
   "geographic",
   "North Carolina"
  ],
  "985": [
   "geographic",
   "Louisiana"
  ],
  "986": [
   "geographic",
   "Idaho"
  ],
  "989": [
   "geographic",
   "Michigan"
  ]
 },
 "nanp_source": {
  "archive_sha256": "a0dd1bc98efa0b6f5839c7b1fface2ebdf0a811645dd8211ae3f037a17ec07ac",
  "data_url": "https://pypi.org/project/phonenumbers/9.0.40/",
  "name": "NANPA area code assignments via Google libphonenumber (phonenumbers 9.0.40)",
  "url": "https://www.nationalnanpa.com/reports/reports_npa.html",
  "version": "9.0.40"
 },
 "playbook": [
  {
   "days": "0 to 3",
   "id": "baseline",
   "steps": [
    {
     "cite": [
      "annual_report",
      "weekly_reports"
     ],
     "id": "pull",
     "title": "Pull all three reports free at AnnualCreditReport.com (weekly is allowed) and import them."
    },
    {
     "cite": [
      "fico_versions"
     ],
     "id": "scores",
     "title": "Record any free scores you can see, with the model name, so the estimates can be checked."
    },
    {
     "cite": [],
     "id": "specialty",
     "title": "If you had banking, insurance or utility denials, request your specialty reports (ChexSystems, Early Warning, LexisNexis, Innovis, NCTUE)."
    },
    {
     "cite": [
      "fcra605b"
     ],
     "id": "freeze",
     "title": "Freeze or add a fraud alert only if you suspect identity theft."
    }
   ],
   "title": "Baseline"
  },
  {
   "days": "1 to 7",
   "id": "quick",
   "steps": [
    {
     "cite": [
      "util_timing",
      "fico8"
     ],
     "id": "utilization",
     "title": "Pay revolving balances before each statement closing date; aim for low overall and per-card use."
    },
    {
     "cite": [
      "rate_shop"
     ],
     "id": "no_apps",
     "title": "Stop new applications; keep any loan shopping inside a 14-day window."
    },
    {
     "cite": [
      "experian_boost"
     ],
     "id": "boost",
     "title": "Optional: add Experian Boost (affects Experian-based scores only)."
    }
   ],
   "title": "Fastest score wins (no disputes needed)"
  },
  {
   "days": "3 to 10",
   "id": "round1",
   "steps": [],
   "title": "Round 1: highest legal strength first"
  },
  {
   "days": "10 to 20",
   "id": "parallel",
   "steps": [],
   "title": "Parallel tracks"
  },
  {
   "days": "30 to 45",
   "id": "results",
   "steps": [
    {
     "cite": [
      "fcra611a6"
     ],
     "id": "log_results",
     "title": "Log each result (due 5 business days after the reinvestigation ends); import a fresh weekly report and compare rounds."
    },
    {
     "cite": [
      "fcra611a5b"
     ],
     "id": "watch_reinsertion",
     "title": "Deleted items: confirm at all three bureaus and watch for reinsertion (written notice within 5 business days)."
    },
    {
     "cite": [
      "fcra611a7",
      "regv1022_43"
     ],
     "id": "mov",
     "title": "Verified items: ask how they were verified (15 days); send the furnisher a direct dispute with documents if not done."
    },
    {
     "cite": [
      "fcra611"
     ],
     "id": "no_answer",
     "title": "No answer by day 30 after delivery (45 if extended): log the date and send a second dispute noting it."
    }
   ],
   "title": "Results"
  },
  {
   "days": "45 to 60",
   "id": "round2",
   "steps": [
    {
     "cite": [
      "fcra611a3"
     ],
     "id": "second",
     "title": "Dispute again only with new information or a new, specific inaccuracy."
    },
    {
     "cite": [
      "cfpb_complaint",
      "cfpb_volume"
     ],
     "id": "cfpb",
     "title": "CFPB complaint for unresolved items, after the bureau dispute, written by you, once."
    }
   ],
   "title": "Round 2"
  },
  {
   "days": "60 to 75",
   "id": "escalate",
   "steps": [
    {
     "cite": [
      "naag"
     ],
     "id": "ag",
     "title": "State attorney general complaint for unresolved items or collector conduct."
    },
    {
     "cite": [
      "ramirez"
     ],
     "id": "harm",
     "title": "Keep evidence of harm (denial letters, rate quotes) for any inaccuracy a lender saw."
    }
   ],
   "title": "Escalation"
  },
  {
   "days": "75 to 90",
   "id": "decide",
   "steps": [
    {
     "cite": [
      "naca",
      "fcra618"
     ],
     "id": "attorney",
     "title": "For documented inaccuracies that survived two rounds and were shared with a lender: talk to a NACA attorney or consider small claims."
    },
    {
     "cite": [
      "ftc_study"
     ],
     "id": "rerun",
     "title": "Re-run the score estimate and add your actual scores."
    },
    {
     "cite": [
      "credit_builder",
      "au_experian",
      "fico9"
     ],
     "id": "build",
     "title": "Plan the next 90 days of score building (secured card or credit builder loan for thin files without other debt; authorized user from family; rent reporting where your lenders' scores count it)."
    },
    {
     "cite": [
      "rapid_rescore"
     ],
     "id": "rescore",
     "title": "If a mortgage is near, ask the lender about a rapid rescore."
    }
   ],
   "title": "Decision point"
  }
 ],
 "postage": {
  "certified_cents": 555,
  "certified_err_cents": 846,
  "certified_green_cents": 1020,
  "effective": "2026-07-12",
  "stamp_cents": 82
 },
 "reporting": {
  "adverse_years": 7,
  "bankruptcy_years": 10,
  "collection_grace_days": 180,
  "collector_file_months": 83,
  "inquiry_years": 2
 },
 "rules": {
  "address_malformed": {
   "group": "Personal information",
   "impact": 1,
   "legal": [
    "fcra611",
    "fcra607b"
   ],
   "letter": "personal_info",
   "speed": 5,
   "then": null,
   "title": "Malformed address"
  },
  "address_unknown": {
   "group": "Personal information",
   "impact": 2,
   "legal": [
    "fcra611",
    "fcra607b"
   ],
   "letter": "personal_info",
   "speed": 5,
   "then": null,
   "title": "Address you never lived at"
  },
  "address_variants": {
   "group": "Personal information",
   "impact": 1,
   "legal": [
    "fcra611",
    "fcra607b"
   ],
   "letter": "personal_info",
   "speed": 5,
   "then": null,
   "title": "Several versions of one address"
  },
  "bankruptcy_balance": {
   "group": "Bankruptcy",
   "impact": 5,
   "legal": [
    "fcra611",
    "fcra607b",
    "white_v_experian"
   ],
   "letter": "bankruptcy_correction",
   "speed": 4,
   "then": "furnisher_623",
   "title": "Balance or late status on an account included in bankruptcy"
  },
  "cares_act": {
   "group": "Accommodations",
   "impact": 4,
   "legal": [
    "fcra623a1f",
    "cares_period",
    "fcra611"
   ],
   "letter": "cares_act",
   "speed": 4,
   "then": "furnisher_623",
   "title": "Late marks during a CARES Act accommodation"
  },
  "child_support_tx": {
   "group": "Child support",
   "impact": 4,
   "legal": [
    "tac55_102",
    "tfc231_114",
    "fcra611",
    "fcra607b"
   ],
   "letter": "child_support_zero_delinquent",
   "speed": 3,
   "then": "bureau_611",
   "title": "Child support on a court-ordered arrears schedule reported as delinquent"
  },
  "closed_then_activity": {
   "group": "Internal contradictions",
   "impact": 4,
   "legal": [
    "fcra611",
    "fcra607b",
    "fcra623a1"
   ],
   "letter": "bureau_611",
   "speed": 4,
   "then": "furnisher_623",
   "title": "Activity reported after a paid, closed account"
  },
  "collection_missing_oc": {
   "group": "Collections",
   "impact": 3,
   "legal": [
    "fcra611",
    "fcra607b",
    "metro2_k1"
   ],
   "letter": "bureau_611",
   "speed": 4,
   "then": "validation_regf",
   "title": "Collection without the original creditor"
  },
  "collector_reported_early": {
   "group": "Collections",
   "impact": 3,
   "legal": [
    "regf1006_30a",
    "regf1006_30a_c",
    "regf1006_34"
   ],
   "letter": "validation_regf",
   "speed": 3,
   "then": "cfpb_complaint",
   "title": "Collector may have reported before contacting you"
  },
  "cross_bureau_mismatch": {
   "group": "Cross-bureau",
   "impact": 3,
   "legal": [
    "fcra607b",
    "fcra611"
   ],
   "letter": "bureau_611",
   "speed": 4,
   "then": "furnisher_623",
   "title": "Bureaus report the same account differently"
  },
  "dispute_flag_missing": {
   "group": "Metro 2 consistency",
   "impact": 2,
   "legal": [
    "fcra623a3",
    "saunders",
    "metro2_ccc"
   ],
   "letter": "dispute_notation",
   "speed": 4,
   "then": "bureau_611",
   "title": "Disputed account not marked as disputed"
  },
  "duplicate_debt": {
   "group": "Collections",
   "impact": 5,
   "legal": [
    "fcra611",
    "fcra607b",
    "fcra623a1",
    "metro2_status"
   ],
   "letter": "bureau_611",
   "speed": 4,
   "then": "furnisher_623",
   "title": "Same debt reported with a balance by the original creditor and a collector"
  },
  "employer_unknown": {
   "group": "Personal information",
   "impact": 1,
   "legal": [
    "fcra611",
    "fcra607b"
   ],
   "letter": "personal_info",
   "speed": 5,
   "then": null,
   "title": "Employer you never worked for"
  },
  "identity_mismatch": {
   "group": "Personal information",
   "impact": 3,
   "legal": [
    "fcra611",
    "fcra607b"
   ],
   "letter": "personal_info",
   "speed": 5,
   "then": null,
   "title": "Date of birth or SSN digits do not match"
  },
  "identity_theft": {
   "group": "Identity theft",
   "impact": 5,
   "legal": [
    "fcra605b",
    "fcra623a6"
   ],
   "letter": "block_605b",
   "speed": 5,
   "then": "furnisher_623",
   "title": "Identity theft item (block request)"
  },
  "inquiry_no_account": {
   "group": "Inquiries",
   "impact": 2,
   "legal": [
    "fcra604f",
    "fcra611"
   ],
   "letter": "inquiry_removal",
   "speed": 4,
   "then": "bureau_611",
   "title": "Hard inquiry with no matching account"
  },
  "max_delinquency_mismatch": {
   "group": "Internal contradictions",
   "impact": 4,
   "legal": [
    "fcra611",
    "fcra607b",
    "fcra623a1"
   ],
   "letter": "bureau_611",
   "speed": 4,
   "then": "furnisher_623",
   "title": "Maximum delinquency note disagrees with the payment grid"
  },
  "medical_policy": {
   "group": "Collections",
   "impact": 4,
   "legal": [
    "medical_policy",
    "fcra611"
   ],
   "letter": "bureau_611",
   "speed": 5,
   "then": null,
   "title": "Medical collection the bureaus say they do not report"
  },
  "missing_dofd": {
   "group": "Metro 2 consistency",
   "impact": 3,
   "legal": [
    "fcra623a5",
    "fcra605c",
    "fcra611"
   ],
   "letter": "bureau_611",
   "speed": 3,
   "then": "furnisher_623",
   "title": "Charge-off or collection without a delinquency date"
  },
  "name_variant": {
   "group": "Personal information",
   "impact": 2,
   "legal": [
    "fcra611",
    "fcra607b"
   ],
   "letter": "personal_info",
   "speed": 5,
   "then": null,
   "title": "Name variant that is not yours"
  },
  "not_mine": {
   "group": "Not yours",
   "impact": 5,
   "legal": [
    "fcra611",
    "fcra607b"
   ],
   "letter": "bureau_611",
   "speed": 4,
   "then": "furnisher_623",
   "title": "Account you say is not yours"
  },
  "obsolete": {
   "group": "Obsolete items",
   "impact": 5,
   "legal": [
    "fcra605",
    "fcra605c",
    "fcra611"
   ],
   "letter": "obsolete_605",
   "speed": 5,
   "then": "furnisher_623",
   "title": "Reported past the 7-year limit"
  },
  "obsolete_inquiry": {
   "group": "Obsolete items",
   "impact": 1,
   "legal": [
    "tu_inquiries",
    "fcra611"
   ],
   "letter": "bureau_611",
   "speed": 5,
   "then": null,
   "title": "Inquiry older than 2 years"
  },
  "paid_then_late": {
   "group": "Internal contradictions",
   "impact": 5,
   "legal": [
    "fcra611",
    "fcra607b",
    "fcra623a1"
   ],
   "letter": "bureau_611",
   "speed": 4,
   "then": "furnisher_623",
   "title": "Late payments reported after the account was paid"
  },
  "phone_invalid": {
   "group": "Personal information",
   "impact": 1,
   "legal": [
    "fcra611",
    "fcra607b",
    "nanp"
   ],
   "letter": "personal_info",
   "speed": 5,
   "then": null,
   "title": "Phone number with an invalid area code"
  },
  "phone_unknown": {
   "group": "Personal information",
   "impact": 1,
   "legal": [
    "fcra611",
    "fcra607b"
   ],
   "letter": "personal_info",
   "speed": 5,
   "then": null,
   "title": "Phone number that is not yours"
  },
  "phone_variant": {
   "group": "Personal information",
   "impact": 1,
   "legal": [
    "fcra611",
    "fcra607b"
   ],
   "letter": "personal_info",
   "speed": 5,
   "then": null,
   "title": "Phone numbers that differ only in the area code"
  },
  "reaged": {
   "group": "Obsolete items",
   "impact": 4,
   "legal": [
    "fcra623a5",
    "fcra605c",
    "fcra611"
   ],
   "letter": "bureau_611",
   "speed": 4,
   "then": "furnisher_623",
   "title": "Removal date later than the delinquency allows (re-aging)"
  },
  "reinserted": {
   "group": "Rounds",
   "impact": 5,
   "legal": [
    "fcra611a5b"
   ],
   "letter": "reinsertion_demand",
   "speed": 4,
   "then": "cfpb_complaint",
   "title": "Deleted item came back"
  },
  "skipped_step": {
   "group": "Internal contradictions",
   "impact": 5,
   "legal": [
    "fcra611",
    "fcra607b",
    "fcra623a1",
    "metro2_status"
   ],
   "letter": "bureau_611",
   "speed": 4,
   "then": "furnisher_623",
   "title": "Delinquency jumps a step after a current month"
  },
  "sold_with_balance": {
   "group": "Collections",
   "impact": 4,
   "legal": [
    "fcra611",
    "fcra607b",
    "metro2_status"
   ],
   "letter": "bureau_611",
   "speed": 4,
   "then": "furnisher_623",
   "title": "Sold or transferred account still shows a balance"
  },
  "status_vs_latest_month": {
   "group": "Metro 2 consistency",
   "impact": 3,
   "legal": [
    "fcra611",
    "fcra607b",
    "metro2_status"
   ],
   "letter": "bureau_611",
   "speed": 4,
   "then": "furnisher_623",
   "title": "Pay status disagrees with the latest month in the grid"
  },
  "status_vs_past_due": {
   "group": "Metro 2 consistency",
   "impact": 3,
   "legal": [
    "fcra611",
    "fcra607b",
    "metro2_status"
   ],
   "letter": "bureau_611",
   "speed": 4,
   "then": "furnisher_623",
   "title": "Pay status and amount past due disagree"
  },
  "zero_terms_amounts_due": {
   "group": "Internal contradictions",
   "impact": 3,
   "legal": [
    "fcra611",
    "fcra607b",
    "fcra623a1"
   ],
   "letter": "bureau_611",
   "speed": 4,
   "then": "furnisher_623",
   "title": "Terms of $0 per month with amounts due"
  }
 },
 "sol": {
  "AK": {
   "extinguished": "",
   "flag": "",
   "name": "Alaska",
   "open": 3,
   "oral": 6,
   "promissory": 3,
   "written": 6
  },
  "AL": {
   "extinguished": "",
   "flag": "",
   "name": "Alabama",
   "open": 3,
   "oral": 6,
   "promissory": 6,
   "written": 6
  },
  "AR": {
   "extinguished": "",
   "flag": "",
   "name": "Arkansas",
   "open": 5,
   "oral": 3,
   "promissory": 5,
   "written": 5
  },
  "AZ": {
   "extinguished": "",
   "flag": "",
   "name": "Arizona",
   "open": 6,
   "oral": 3,
   "promissory": 6,
   "written": 6
  },
  "CA": {
   "extinguished": "",
   "flag": "",
   "name": "California",
   "open": 4,
   "oral": 2,
   "promissory": 4,
   "written": 4
  },
  "CO": {
   "extinguished": "",
   "flag": "",
   "name": "Colorado",
   "open": 6,
   "oral": 6,
   "promissory": 6,
   "written": 6
  },
  "CT": {
   "extinguished": "",
   "flag": "",
   "name": "Connecticut",
   "open": 6,
   "oral": 3,
   "promissory": 6,
   "written": 6
  },
  "DC": {
   "extinguished": "",
   "flag": "",
   "name": "District of Columbia",
   "open": 3,
   "oral": 3,
   "promissory": 3,
   "written": 3
  },
  "DE": {
   "extinguished": "",
   "flag": "Open account (4) is longer than written contract (3); check the statute.",
   "name": "Delaware",
   "open": 4,
   "oral": 3,
   "promissory": 3,
   "written": 3
  },
  "FL": {
   "extinguished": "",
   "flag": "",
   "name": "Florida",
   "open": 5,
   "oral": 4,
   "promissory": 5,
   "written": 5
  },
  "GA": {
   "extinguished": "",
   "flag": "",
   "name": "Georgia",
   "open": 6,
   "oral": 4,
   "promissory": 6,
   "written": 6
  },
  "HI": {
   "extinguished": "",
   "flag": "",
   "name": "Hawaii",
   "open": 6,
   "oral": 6,
   "promissory": 6,
   "written": 6
  },
  "IA": {
   "extinguished": "",
   "flag": "",
   "name": "Iowa",
   "open": 5,
   "oral": 5,
   "promissory": 10,
   "written": 10
  },
  "ID": {
   "extinguished": "",
   "flag": "",
   "name": "Idaho",
   "open": 4,
   "oral": 4,
   "promissory": 5,
   "written": 5
  },
  "IL": {
   "extinguished": "",
   "flag": "",
   "name": "Illinois",
   "open": 5,
   "oral": 5,
   "promissory": 10,
   "written": 10
  },
  "IN": {
   "extinguished": "",
   "flag": "",
   "name": "Indiana",
   "open": 6,
   "oral": 5,
   "promissory": 10,
   "written": 10
  },
  "KS": {
   "extinguished": "",
   "flag": "",
   "name": "Kansas",
   "open": 3,
   "oral": 3,
   "promissory": 5,
   "written": 5
  },
  "KY": {
   "extinguished": "",
   "flag": "",
   "name": "Kentucky",
   "open": 10,
   "oral": 5,
   "promissory": 15,
   "written": 10
  },
  "LA": {
   "extinguished": "",
   "flag": "",
   "name": "Louisiana",
   "open": 3,
   "oral": 10,
   "promissory": 10,
   "written": 10
  },
  "MA": {
   "extinguished": "",
   "flag": "",
   "name": "Massachusetts",
   "open": 6,
   "oral": 6,
   "promissory": 6,
   "written": 6
  },
  "MD": {
   "extinguished": "",
   "flag": "",
   "name": "Maryland",
   "open": 3,
   "oral": 3,
   "promissory": 6,
   "written": 3
  },
  "ME": {
   "extinguished": "",
   "flag": "",
   "name": "Maine",
   "open": 6,
   "oral": 6,
   "promissory": 20,
   "written": 6
  },
  "MI": {
   "extinguished": "",
   "flag": "",
   "name": "Michigan",
   "open": 6,
   "oral": 6,
   "promissory": 6,
   "written": 6
  },
  "MN": {
   "extinguished": "",
   "flag": "",
   "name": "Minnesota",
   "open": 6,
   "oral": 6,
   "promissory": 6,
   "written": 6
  },
  "MO": {
   "extinguished": "",
   "flag": "",
   "name": "Missouri",
   "open": 5,
   "oral": 5,
   "promissory": 10,
   "written": 10
  },
  "MS": {
   "extinguished": "Debt is extinguished after the period, not just unenforceable.",
   "flag": "",
   "name": "Mississippi",
   "open": 3,
   "oral": 3,
   "promissory": 3,
   "written": 3
  },
  "MT": {
   "extinguished": "",
   "flag": "",
   "name": "Montana",
   "open": 5,
   "oral": 5,
   "promissory": 8,
   "written": 8
  },
  "NC": {
   "extinguished": "Debt is extinguished after the period for debt buyers.",
   "flag": "",
   "name": "North Carolina",
   "open": 3,
   "oral": 3,
   "promissory": 5,
   "written": 3
  },
  "ND": {
   "extinguished": "",
   "flag": "",
   "name": "North Dakota",
   "open": 6,
   "oral": 6,
   "promissory": 6,
   "written": 6
  },
  "NE": {
   "extinguished": "",
   "flag": "",
   "name": "Nebraska",
   "open": 4,
   "oral": 4,
   "promissory": 5,
   "written": 5
  },
  "NH": {
   "extinguished": "",
   "flag": "",
   "name": "New Hampshire",
   "open": 3,
   "oral": 3,
   "promissory": 6,
   "written": 3
  },
  "NJ": {
   "extinguished": "",
   "flag": "",
   "name": "New Jersey",
   "open": 6,
   "oral": 6,
   "promissory": 6,
   "written": 6
  },
  "NM": {
   "extinguished": "",
   "flag": "",
   "name": "New Mexico",
   "open": 4,
   "oral": 4,
   "promissory": 6,
   "written": 6
  },
  "NV": {
   "extinguished": "",
   "flag": "",
   "name": "Nevada",
   "open": 4,
   "oral": 4,
   "promissory": 3,
   "written": 6
  },
  "NY": {
   "extinguished": "",
   "flag": "3 years for consumer credit under the 2022 Consumer Credit Fairness Act; 6 for other contracts. A payment after expiration does not revive time-barred consumer debt.",
   "name": "New York",
   "open": 3,
   "oral": 3,
   "promissory": 3,
   "written": 3
  },
  "OH": {
   "extinguished": "",
   "flag": "",
   "name": "Ohio",
   "open": 6,
   "oral": 4,
   "promissory": 8,
   "written": 6
  },
  "OK": {
   "extinguished": "",
   "flag": "",
   "name": "Oklahoma",
   "open": 3,
   "oral": 3,
   "promissory": 6,
   "written": 5
  },
  "OR": {
   "extinguished": "",
   "flag": "",
   "name": "Oregon",
   "open": 6,
   "oral": 6,
   "promissory": 6,
   "written": 6
  },
  "PA": {
   "extinguished": "",
   "flag": "",
   "name": "Pennsylvania",
   "open": 4,
   "oral": 4,
   "promissory": 4,
   "written": 4
  },
  "RI": {
   "extinguished": "",
   "flag": "Written contract (4) is shorter than oral (10); check the statute.",
   "name": "Rhode Island",
   "open": 10,
   "oral": 10,
   "promissory": 10,
   "written": 4
  },
  "SC": {
   "extinguished": "",
   "flag": "",
   "name": "South Carolina",
   "open": 3,
   "oral": 3,
   "promissory": 3,
   "written": 3
  },
  "SD": {
   "extinguished": "",
   "flag": "",
   "name": "South Dakota",
   "open": 6,
   "oral": 6,
   "promissory": 6,
   "written": 6
  },
  "TN": {
   "extinguished": "",
   "flag": "",
   "name": "Tennessee",
   "open": 6,
   "oral": 6,
   "promissory": 6,
   "written": 6
  },
  "TX": {
   "extinguished": "",
   "flag": "",
   "name": "Texas",
   "open": 4,
   "oral": 4,
   "promissory": 4,
   "written": 4
  },
  "UT": {
   "extinguished": "",
   "flag": "",
   "name": "Utah",
   "open": 4,
   "oral": 4,
   "promissory": 6,
   "written": 6
  },
  "VA": {
   "extinguished": "",
   "flag": "",
   "name": "Virginia",
   "open": 3,
   "oral": 3,
   "promissory": 6,
   "written": 5
  },
  "VT": {
   "extinguished": "",
   "flag": "",
   "name": "Vermont",
   "open": 6,
   "oral": 6,
   "promissory": 14,
   "written": 6
  },
  "WA": {
   "extinguished": "",
   "flag": "",
   "name": "Washington",
   "open": 6,
   "oral": 3,
   "promissory": 6,
   "written": 6
  },
  "WI": {
   "extinguished": "Debt is extinguished after the period, not just unenforceable.",
   "flag": "",
   "name": "Wisconsin",
   "open": 6,
   "oral": 6,
   "promissory": 10,
   "written": 6
  },
  "WV": {
   "extinguished": "",
   "flag": "",
   "name": "West Virginia",
   "open": 5,
   "oral": 5,
   "promissory": 6,
   "written": 10
  },
  "WY": {
   "extinguished": "",
   "flag": "",
   "name": "Wyoming",
   "open": 8,
   "oral": 8,
   "promissory": 10,
   "written": 10
  }
 },
 "sol_columns": [
  "written",
  "oral",
  "promissory",
  "open"
 ],
 "sol_disclosure_states": [
  "CA",
  "CT",
  "NC",
  "TX",
  "WV",
  "MA",
  "NM",
  "NY",
  "VT"
 ],
 "specialty": {
  "chexsystems": {
   "covers": "Bank account screening; records kept up to 5 years",
   "lines": [
    "Attn: Consumer Relations",
    "P.O. Box 583399",
    "Minneapolis, MN 55458"
   ],
   "name": "Chex Systems, Inc.",
   "phone": "800-428-9623",
   "source": "https://consumerfinance.gov/consumer-tools/credit-reports-and-scores/consumer-reporting-companies/companies-list/chex-systems"
  },
  "clarity": {
   "covers": "Subprime and alternative lending",
   "lines": [
    "Consumer Support Division",
    "P.O. Box 16",
    "Allen, TX 75013"
   ],
   "name": "Clarity Services, Inc.",
   "phone": "866-390-3118",
   "source": "https://www.consumerfinance.gov/consumer-tools/credit-reports-and-scores/consumer-reporting-companies/companies-list/clarity-services/"
  },
  "ews": {
   "covers": "Bank account screening",
   "lines": [
    "Attn: Consumer Services Department",
    "5801 N. Pima Rd",
    "Scottsdale, AZ 85250"
   ],
   "name": "Early Warning Services",
   "phone": "800-745-1560",
   "source": "https://www.consumerfinance.gov/consumer-tools/credit-reports-and-scores/consumer-reporting-companies/companies-list/early-warning-services-llc/"
  },
  "innovis": {
   "covers": "Fourth credit bureau",
   "lines": [
    "P.O. Box 530088",
    "Atlanta, GA 30353-0088"
   ],
   "name": "Innovis Consumer Assistance",
   "phone": "1-866-712-0021",
   "source": "https://www.innovis.com/personal/disputeResolution"
  },
  "lexisnexis": {
   "covers": "Insurance, public records, identity",
   "lines": [
    "P.O. Box 105108",
    "Atlanta, GA 30348-5108"
   ],
   "name": "LexisNexis Risk Solutions Consumer Center",
   "phone": "866-897-8126",
   "source": "https://consumer.risk.lexisnexis.com/request"
  },
  "nctue": {
   "covers": "Telecom, pay TV and utility accounts",
   "lines": [
    "P.O. Box 105398",
    "Atlanta, GA 30348"
   ],
   "name": "NCTUE Disputes",
   "phone": "1-866-343-2821",
   "source": "https://www.nctue.com/consumers"
  }
 },
 "verified": "2026-10-22"
};
