/**
 * NeedhiAI Consumer Help Hub Service
 * Provides grounded procedural guidance, statutory benchmarks under CPA 2019,
 * category-aware information collection checklists, and structured document drafting.
 */

export const HELP_HUB_INTENTS = {
  UNDERSTAND_MY_PROBLEM: {
    id: "UNDERSTAND_MY_PROBLEM",
    title: "Understand My Problem",
    tagline: "Identify your legal rights and essential evidence to collect",
    icon: "🔍"
  },
  LEARN_THE_PROCESS: {
    id: "LEARN_THE_PROCESS",
    title: "Learn The Process",
    tagline: "Jurisdiction thresholds, filing fees, limitation periods & authorities",
    icon: "📖"
  },
  PREPARE_A_DOCUMENT: {
    id: "PREPARE_A_DOCUMENT",
    title: "Prepare a Document",
    tagline: "Draft complaint petitions, grievance emails, notices & checklists",
    icon: "📝"
  },
  INVESTIGATE_MY_CASE: {
    id: "INVESTIGATE_MY_CASE",
    title: "Investigate My Case",
    tagline: "Start or continue an AI-guided multi-stage factual case investigation",
    icon: "⚖️"
  }
};

export const CONSUMER_CATEGORIES = [
  {
    id: "ecommerce_retail",
    name: "E-Commerce & Retail",
    icon: "🛍️",
    description: "Online purchases, defective goods, delayed delivery, return or refund refusals.",
    governingRules: "Consumer Protection (E-Commerce) Rules, 2020 & CPA 2019 Sections 2(10), 2(47)",
    primaryAuthority: "National Consumer Helpline (1915) & Central Consumer Protection Authority (CCPA)",
    evidenceChecklist: [
      "Tax invoice / Order confirmation email",
      "Payment receipt / Bank transaction statement",
      "Photos or unboxing video of damaged / defective goods",
      "Screenshots of return / refund request on platform",
      "Customer service chat logs and ticket numbers"
    ],
    commonScenarios: [
      "Seller refused replacement for defective electronics within 7 days",
      "Package delivered empty or with wrong items and return request rejected",
      "Refund promised in wallet or uncredited after 14 days",
      "Platform arbitrarily cancelled prepaid order without consent"
    ]
  },
  {
    id: "banking_upi",
    name: "Banking, UPI & Financial Services",
    icon: "💳",
    description: "Unauthorized transactions, failed UPI debits, credit card disputes, loan irregularities.",
    governingRules: "RBI Master Direction on Customer Protection & Banking Regulation Act Sec 35A",
    primaryAuthority: "RBI Integrated Ombudsman (cms.rbi.org.in / 14448)",
    evidenceChecklist: [
      "Bank statement highlighting disputed transaction",
      "UPI UTR reference number or SMS transaction alert",
      "Written dispute report / police cyber cell complaint acknowledgment",
      "Bank acknowledgement email within 3 working days",
      "Written bank rejection or closure response"
    ],
    commonScenarios: [
      "Money debited via UPI but merchant never received payment, auto-reversal failed",
      "Unauthorized debit from savings account reported within 3 days (Zero Liability)",
      "Credit card billed with disputed charges not authorized by OTP",
      "Bank failed to return original property title deeds after full loan repayment"
    ]
  },
  {
    id: "insurance",
    name: "Insurance (Health, Motor, Life)",
    icon: "🛡️",
    description: "Wrongful claim rejection, cashless pre-auth denial, delayed settlement.",
    governingRules: "IRDAI (Protection of Policyholders' Interests) Regulations, 2017",
    primaryAuthority: "Insurance Ombudsman & IRDAI Bima Bharosa (bimabharosa.irdai.gov.in)",
    evidenceChecklist: [
      "Original Insurance Policy Schedule and Terms & Conditions",
      "Claim form submitted with hospital / discharge summary",
      "All medical bills, pharmacy receipts, and diagnostic reports",
      "Written Claim Rejection Letter detailing specific clause invoked",
      "Grievance escalation letter to Insurer's Grievance Redressal Officer (GRO)"
    ],
    commonScenarios: [
      "Health insurance claim rejected citing alleged pre-existing disease not declared",
      "Cashless approval denied for emergency hospital admission without valid grounds",
      "Motor insurance total loss claim settled at arbitrary low salvage value",
      "Settlement delayed beyond statutory 30-day period without interest"
    ]
  },
  {
    id: "real_estate",
    name: "Real Estate & Housing",
    icon: "🏢",
    description: "Delayed flat possession, builder plan alterations, refund of booking advance.",
    governingRules: "Real Estate (Regulation and Development) Act, 2016 (RERA) & CPA 2019",
    primaryAuthority: "State RERA Authority & District Consumer Commission",
    evidenceChecklist: [
      "Builder-Buyer Agreement / Allotment Letter with committed possession date",
      "Receipts and bank statements for all instalments paid",
      "Demand letters and correspondence with developer",
      "Architect completion certificate or absence thereof",
      "RERA project registration details and brochure promises"
    ],
    commonScenarios: [
      "Builder delayed apartment handover by over 3 years beyond agreement date",
      "Builder demanded escalated charges not stipulated in original allotment",
      "Substandard construction quality differing from approved model flat",
      "Refusal to refund booking advance after project cancellation"
    ]
  },
  {
    id: "telecom_digital",
    name: "Telecom & Digital Services",
    icon: "📱",
    description: "Broadband downtime, arbitrary billing, unsolicited value-added services, number porting.",
    governingRules: "TRAI Telecom Consumer Protection Regulations & CPA 2019",
    primaryAuthority: "Service Provider Appellate Authority & Department of Telecommunications (DoT)",
    evidenceChecklist: [
      "Monthly itemized phone / broadband bills",
      "Proof of outage complaints logged with docket numbers",
      "Speed test logs demonstrating persistent service failure",
      "Payment receipts and porting request SMS records"
    ],
    commonScenarios: [
      "Broadband disconnected for over 15 days without bill rebate or resolution",
      "Continuous billing after formal written cancellation request",
      "Unsolicited VAS services activated without consumer consent",
      "Rejection of Mobile Number Portability (MNP) on frivolous grounds"
    ]
  },
  {
    id: "healthcare",
    name: "Healthcare & Medical Services",
    icon: "🏥",
    description: "Medical negligence, excessive hospital overcharging, substandard clinical care.",
    governingRules: "Consumer Protection Act, 2019 & Clinical Establishments Act",
    primaryAuthority: "State Medical Council & District Consumer Disputes Redressal Commission",
    evidenceChecklist: [
      "Complete medical case sheet, discharge summary, and operative notes",
      "All diagnostic test reports (X-rays, MRIs, blood reports)",
      "Itemized hospital inpatient billing and payment receipts",
      "Second opinion reports from independent qualified medical specialists"
    ],
    commonScenarios: [
      "Surgical procedure performed with retained foreign object or departure from standard protocol",
      "Hospital charged exorbitant tariffs exceeding government-capped ceiling rates",
      "Hospital refused to release patient records or body pending dispute on bills"
    ]
  },
  {
    id: "travel_transport",
    name: "Travel, Airlines & Transport",
    icon: "✈️",
    description: "Flight cancellations, lost baggage, denied boarding, hotel misrepresentation.",
    governingRules: "DGCA Civil Aviation Requirements (CAR Section 3, Series M) & CPA 2019",
    primaryAuthority: "DGCA AirSewa Portal (airsewa.gov.in) & Consumer Commissions",
    evidenceChecklist: [
      "Confirmed Flight / Train / Hotel booking tickets and PNR number",
      "Property Arrival Damage Report (PIR) for lost or damaged luggage",
      "Airline cancellation SMS or email notice",
      "Receipts of out-of-pocket expenses incurred due to delay or denied boarding"
    ],
    commonScenarios: [
      "Airline cancelled flight without statutory compensation or alternative arrangement",
      "Luggage lost or permanently damaged during transit with minimal ex-gratia offered",
      "Hotel booked via travel portal had completely different amenities or refused room"
    ]
  },
  {
    id: "utilities_services",
    name: "Utilities & Public Services",
    icon: "⚡",
    description: "Faulty electricity meters, water supply disruption, municipal service deficits.",
    governingRules: "State Electricity Regulatory Commission (SERC) Consumer Regulations & CPA 2019",
    primaryAuthority: "Electricity Consumer Grievance Redressal Forum (CGRF) & Ombudsman",
    evidenceChecklist: [
      "Consumer connection number and meter reading receipts",
      "Past 12 months electricity / utility bills showing normal consumption",
      "Photographs of current meter reading demonstrating mismatch",
      "Written representations made to Assistant Executive Engineer"
    ],
    commonScenarios: [
      "Electricity board issued arbitrary inflated supplemental assessment bill",
      "Defective meter recorded excessive units and board refused independent testing",
      "Failure to restore power supply within stipulated citizen charter timeline"
    ]
  },
  {
    id: "other_general",
    name: "Other / Unsure Category",
    icon: "📋",
    description: "Education fees, coaching centers, gyms, dry cleaners, repair technicians.",
    governingRules: "Consumer Protection Act, 2019 General Provisions",
    primaryAuthority: "National Consumer Helpline (1915) & District Consumer Commission",
    evidenceChecklist: [
      "Proof of consideration paid (fee receipt, contract, invoice)",
      "Written terms and brochure of services promised",
      "Written demand for refund or rectification communicated to provider",
      "Evidence demonstrating deficiency or non-performance"
    ],
    commonScenarios: [
      "Coaching institute refused proportional refund after student withdrew before term",
      "Professional service provider abandoned work after taking substantial advance",
      "Dry cleaner damaged high-value apparel and offered token compensation"
    ]
  }
];

/**
 * Procedural guidance on jurisdiction, fees, deadlines, and portals under CPA 2019.
 */
export const PROCEDURAL_KNOWLEDGE = {
  jurisdiction: {
    title: "Pecuniary Jurisdiction (Where to File)",
    description: "Thresholds under amended Consumer Protection (Jurisdiction of Commission) Rules, 2021",
    tiers: [
      {
        forum: "District Consumer Disputes Redressal Commission",
        claimLimit: "Up to ₹50,00,000 (Fifty Lakhs)",
        location: "In every district across India. Section 34(2) permits filing where complainant resides or works."
      },
      {
        forum: "State Consumer Disputes Redressal Commission",
        claimLimit: "Above ₹50,00,000 up to ₹2,00,00,000 (Two Crores)",
        location: "Located in the State Capital. Exercises original and appellate jurisdiction over District orders."
      },
      {
        forum: "National Consumer Disputes Redressal Commission (NCDRC)",
        claimLimit: "Exceeding ₹2,00,00,000 (Two Crores)",
        location: "New Delhi. Apex consumer court with pan-India original and appellate jurisdiction."
      }
    ],
    territorialRule: "Under Section 34(2) of CPA 2019, consumers can conveniently file complaints in the District Commission where they reside or work for gain, even if the company's head office is located in another state."
  },
  filingFees: {
    title: "Statutory Filing Fees (Schedule of Fees)",
    description: "Filing fee slabs under Consumer Protection Regulations (Free for claims up to ₹5 Lakhs)",
    slabs: [
      { amountRange: "Up to ₹5 Lakhs", fee: "NIL (Completely Free)" },
      { amountRange: "Above ₹5 Lakhs up to ₹10 Lakhs", fee: "₹200" },
      { amountRange: "Above ₹10 Lakhs up to ₹20 Lakhs", fee: "₹400" },
      { amountRange: "Above ₹20 Lakhs up to ₹50 Lakhs", fee: "₹1,000" },
      { amountRange: "Above ₹50 Lakhs up to ₹1 Crore", fee: "₹2,000" },
      { amountRange: "Above ₹1 Crore up to ₹2 Crores", fee: "₹2,500" },
      { amountRange: "Above ₹2 Crores (NCDRC)", fee: "₹5,000" }
    ],
    paymentMode: "Demand Draft / Postal Order or online via Bharatkosh / e-Daakhil payment gateway."
  },
  limitationPeriod: {
    title: "Limitation Period (Deadline to File)",
    statute: "Section 69, Consumer Protection Act, 2019",
    rule: "A complaint must be filed within TWO (2) YEARS from the date on which the cause of action arose (e.g. date of transaction, delivery of defective goods, or formal rejection of claim).",
    condonationOfDelay: "Under Section 69(2), the Commission may condone delay beyond 2 years only if the complainant satisfies the Commission that there was sufficient and bona fide cause for not filing within the limitation period."
  },
  officialPortals: [
    {
      name: "e-Daakhil Portal",
      url: "https://edaakhil.nic.in",
      purpose: "Official Government of India portal for e-filing consumer complaints across all District, State, and National Commissions without physical court visits.",
      features: "Digital document upload, online fee payment, case tracking, and virtual hearings."
    },
    {
      name: "National Consumer Helpline (NCH)",
      url: "https://consumerhelpline.gov.in",
      phone: "1915 or 1800-11-4000",
      sms: "8800001915",
      purpose: "Pre-litigation conciliation and grievance redressal mechanism operated by Department of Consumer Affairs. 85%+ disputes resolved via direct company liaison."
    },
    {
      name: "Central Consumer Protection Authority (CCPA)",
      url: "https://consumeraffairs.nic.in",
      purpose: "Regulatory enforcement authority for unfair trade practices, misleading advertisements, and class-action violations."
    }
  ]
};

/**
 * Generates structured document drafts with placeholders and cautions.
 * Never invents facts or case numbers.
 */
export function generateDocumentDraft({
  documentType,
  category = "ecommerce_retail",
  consumerData = {}
}) {
  const name = consumerData.consumerName || "[Consumer Full Name]";
  const address = consumerData.consumerAddress || "[Consumer Full Residential Address]";
  const phone = consumerData.phone || "[Phone Number]";
  const email = consumerData.email || "[Email Address]";
  const company = consumerData.companyName || "[Company / Merchant Full Legal Name]";
  const companyAddress = consumerData.companyAddress || "[Company Registered Office Address]";
  const product = consumerData.productName || "[Product / Service Name]";
  const orderId = consumerData.orderId || "[Order ID / Invoice # / Policy #]";
  const date = consumerData.transactionDate || "[Date of Transaction / DD-MM-YYYY]";
  const amount = consumerData.disputedAmount || "[Amount Paid in INR (e.g. ₹15,000)]";
  const problem = consumerData.problemDescription || "[Detailed factual description of defect, deficiency, or delay]";
  const remedy = consumerData.remedySought || "[Full Refund / Replacement / Rectification / Compensation]";

  const currentDate = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

  let title = "";
  let draftText = "";
  let cautions = [];

  switch (documentType) {
    case "GRIEVANCE_EMAIL":
      title = "Official Grievance Email to Nodal / Grievance Officer";
      cautions = [
        "Send this to the company's designated Grievance Officer, Nodal Officer, or customer-support escalation email.",
        "Keep email delivery receipts and ticket numbers as formal evidence of prior notification."
      ];
      draftText = `Subject: FORMAL GRIEVANCE: Defective ${product} | Order/Ref: ${orderId} | Immediate Resolution Demanded

Date: ${currentDate}

To,
The Grievance Officer / Nodal Redressal Officer,
${company}
${companyAddress}
Email: [grievance-officer@company.com]

Dear Sir/Madam,

RE: FORMAL GRIEVANCE UNDER CONSUMER PROTECTION (E-COMMERCE) RULES, 2020 / CONSUMER PROTECTION ACT, 2019
ORDER / REFERENCE NUMBER: ${orderId}
PRODUCT / SERVICE: ${product}
TRANSACTION DATE: ${date}
CONSIDERATION PAID: ${amount}

I am writing to register an official consumer grievance regarding the aforementioned transaction.

1. FACTUAL BACKGROUND:
On ${date}, I purchased/availed ${product} from ${company} for a total consideration of ${amount} (Transaction/Order ID: ${orderId}). The consideration was fully paid and received by your organization.

2. NATURE OF DEFICIENCY / UNFAIR TRADE PRACTICE:
${problem}

3. STEPS TAKEN AND PREVIOUS CORRESPONDENCE:
I previously contacted your customer service team on [Date of First Contact] via [Email/Chat/Phone with Ticket #${orderId}]. However, no satisfactory redressal has been provided, and my legitimate request for refund/replacement was wrongfully denied or delayed beyond statutory limits.

4. STATUTORY VIOLATION:
Under the Consumer Protection Act, 2019 (Sections 2(10), 2(11), and 2(47)) and Rule 5 of the Consumer Protection (E-Commerce) Rules, 2020, your company is obligated to acknowledge consumer grievances within 48 hours and resolve the matter within one month. The continued refusal or delay in rectifying the defect constitutes deficiency of service and unfair trade practice.

5. RELIEF SOUGHT:
In light of the above, I demand that ${company} immediately:
a) Grant ${remedy} within 7 (seven) days of receipt of this notice; and
b) Confirm the reversal/refund transaction reference number via email.

Please be advised that if this grievance is not resolved within seven (7) days, I shall be compelled to escalate this matter to the National Consumer Helpline (1915) and file a formal consumer complaint before the competent District Consumer Disputes Redressal Commission via e-Daakhil, seeking refund, interest, and costs entirely at your risk.

Yours faithfully,

${name}
Address: ${address}
Phone: ${phone}
Email: ${email}
Enclosures: [Attach Purchase Invoice, Payment Receipt, Photographs of Defect]`;
      break;

    case "REFUND_REQUEST":
      title = "Formal Demand Notice for Refund / Replacement";
      cautions = [
        "Use this formal notice to establish a clear paper trail before escalating to the Consumer Commission.",
        "Verify your payment amount and transaction dates accurately."
      ];
      draftText = `FORMAL DEMAND FOR REFUND AND REPLACEMENT

Date: ${currentDate}

To,
${company}
${companyAddress}

FROM:
${name}
${address}
Phone: ${phone} | Email: ${email}

SUBJECT: FORMAL DEMAND NOTICE FOR FULL REFUND OF ${amount} / REPLACEMENT UNDER SECTION 39 OF CONSUMER PROTECTION ACT, 2019

REF: INVOICE / ORDER NO: ${orderId} DATED: ${date}

Sir/Madam,

Please take notice that I, the undersigned consumer, had purchased ${product} from your establishment on ${date} against payment of ${amount}.

Upon receipt/usage of the said product/service, the following defects and deficiencies were discovered:
"${problem}"

The product/service suffers from inherent manufacturing defects and service shortcomings as defined under Sections 2(10) and 2(11) of the Consumer Protection Act, 2019. Despite timely notification within the return/warranty period, your establishment has failed to provide a defect-free replacement or refund.

I HEREBY CALL UPON YOU to grant ${remedy} within ten (10) days from the receipt of this demand notice.

Failing compliance, I shall initiate appropriate legal proceedings before the competent Consumer Commission under Section 35 of the Consumer Protection Act, 2019, claiming the principal amount along with interest, statutory compensation for mental agony, and litigation expenses.

Yours sincerely,

____________________
(${name})
Encl: Copy of Tax Invoice & Payment Receipt`;
      break;

    case "LEGAL_NOTICE":
      title = "Pre-Litigation Legal Notice Draft (Subject to Legal Review)";
      cautions = [
        "CAUTION: This document is a structured drafting template for pre-litigation notice. It does not constitute legal counsel and has not been vetted by an advocate.",
        "We strongly advise consulting an enrolled legal practitioner before issuing a formal legal notice."
      ];
      draftText = `LEGAL NOTICE (WITHOUT PREJUDICE)

Date: ${currentDate}

TO:
${company}
Through its Managing Director / Directors / Authorized Representative
Registered Office: ${companyAddress}

FROM:
${name}
Resident of: ${address}
Contact: ${phone} | Email: ${email}

SUB: PRE-LITIGATION LEGAL NOTICE UNDER SECTIONS 2(10), 2(11), 2(47), AND 35 OF THE CONSUMER PROTECTION ACT, 2019 REGARDING DEFICIENCY OF SERVICE AND UNFAIR TRADE PRACTICE CONCERNING ${product} (ORDER/REF: ${orderId})

Sir/Madam,

Under instructions from myself as an aggrieved consumer, I hereby serve upon you this formal Legal Notice as under:

1. That I am a 'Consumer' within the statutory meaning of Section 2(7) of the Consumer Protection Act, 2019, having purchased ${product} from your company on ${date} for a valuable consideration of ${amount} vide Invoice/Order ID: ${orderId}.

2. That the transaction was concluded on the basis of representations and warranties provided by your company regarding product quality, performance, and after-sales support.

3. That upon delivery/usage, the product/service was found to be severely defective and deficient in the following material particulars:
${problem}

4. That I promptly notified your customer support and grievance department on multiple occasions. However, your company has neglected and refused to rectify the defect or process the legitimate refund request, thereby committing deficiency of service under Section 2(11) and unfair trade practice under Section 2(47) of the Act.

5. That on account of your illegal, negligent, and unfair acts, I have suffered acute mental agony, harassment, and severe financial loss.

I HEREBY CALL UPON YOU by means of this Legal Notice to:
a) Refund the entire sum of ${amount} along with interest @ 9% per annum from ${date} until realization; OR
b) Provide an immediate, defect-free replacement of ${product}; AND
c) Pay a reasonable sum of ₹[Amount] towards compensation for harassment and legal notice expenses;

within 15 (FIFTEEN) DAYS of the receipt of this notice, failing which I shall be constrained to initiate formal consumer proceedings against your company before the District Consumer Disputes Redressal Commission under Section 35 of the Consumer Protection Act, 2019, and register a complaint with the Central Consumer Protection Authority (CCPA), holding you liable for all consequential costs and expenses.

A copy of this notice is retained for production before the court of competent jurisdiction.

Yours faithfully,

________________________
(${name})
Complainant / Consumer`;
      break;

    case "CONSUMER_COMPLAINT":
    default:
      title = "Draft Consumer Complaint Petition (District Commission Format)";
      cautions = [
        "This draft follows the standardized petition structure required by District Consumer Disputes Redressal Commissions under Section 35 of CPA 2019.",
        "Must be filed online via e-Daakhil (edaakhil.nic.in) or submitted in physical sets (typically 3 copies plus 1 for each Opposite Party) along with an affidavit."
      ];
      draftText = `BEFORE THE DISTRICT CONSUMER DISPUTES REDRESSAL COMMISSION AT [DISTRICT NAME, STATE]

CONSUMER COMPLAINT NO. ________ OF ${new Date().getFullYear()}

IN THE MATTER OF:

${name}
Age: [Age] years, S/o / D/o / W/o [Relative Name]
Residing at: ${address}
Phone: ${phone} | Email: ${email}
... COMPLAINANT

VERSUS

${company}
Through its Authorized Representative / Managing Director
Having its Office / Branch at: ${companyAddress}
Email: [company@domain.com] | Phone: [Phone]
... OPPOSITE PARTY

COMPLAINT UNDER SECTION 35 OF THE CONSUMER PROTECTION ACT, 2019

MOST RESPECTFULLY SHOWETH:

1. PARTICULARS OF THE PARTIES:
The Complainant is an individual residing at the address stated above. The Opposite Party is a commercial entity engaged in the business of providing ${product} and having its office/presence as stated in the cause title.

2. JURISDICTION OF THIS HON'BLE COMMISSION:
This Hon'ble Commission has territorial jurisdiction under Section 34(2) of the Consumer Protection Act, 2019 as the Complainant resides and/or personally works for gain within the territorial limits of this Commission. Furthermore, the total value of goods/services and compensation claimed is ${amount}, which is well within the pecuniary limit of ₹50,00,000/- (Fifty Lakhs) prescribed for this District Commission.

3. LIMITATION:
The cause of action arose on ${date} and continues to subsist. The present complaint is filed within the statutory period of two (2) years under Section 69 of the Consumer Protection Act, 2019.

4. BRIEF FACTS OF THE CASE:
4.1 On ${date}, the Complainant purchased/availed ${product} from the Opposite Party against full consideration of ${amount} vide Invoice/Order No. ${orderId} (Annexure C-1).
4.2 That the Opposite Party delivered goods/services which suffered from severe defects and deficiencies:
${problem}
4.3 That the Complainant repeatedly contacted the Opposite Party seeking redressal, but the Opposite Party wrongfully neglected and refused to provide relief (Annexure C-2).

5. GROUNDS OF COMPLAINT:
5.1 That the failure of the Opposite Party amounts to 'Defect' under Section 2(10) and 'Deficiency in Service' under Section 2(11) of the Act.
5.2 That the refusal to provide replacement/refund constitutes 'Unfair Trade Practice' under Section 2(47) of the Act.

6. PRAYER / RELIEF SOUGHT:
In the premises aforesaid, the Complainant most respectfully prays that this Hon'ble Commission may be pleased to:
a) Direct the Opposite Party to ${remedy};
b) Direct the Opposite Party to pay reasonable compensation of ₹[Amount] for mental agony, harassment, and loss;
c) Award litigation costs of ₹[Amount] in favor of the Complainant; and
d) Pass any other relief that this Hon'ble Commission may deem fit in the interest of justice.

DATED: ${currentDate}
PLACE: [District Name]

COMPLAINANT: ________________________
(${name})

VERIFICATION:
I, the Complainant above-named, do hereby verify that the contents of paragraphs 1 to 6 of the above complaint are true and correct to the best of my knowledge, information, and belief, and no material fact has been concealed therefrom.
Verified at [District] on this ${currentDate}.

DEPONENT: ________________________
(${name})`;
      break;
  }

  return {
    documentType,
    title,
    category,
    draftText,
    cautions,
    placeholders: [
      "[Consumer Full Name]",
      "[Consumer Full Residential Address]",
      "[Company / Merchant Full Legal Name]",
      "[Company Registered Office Address]",
      "[Product / Service Name]",
      "[Order ID / Invoice # / Policy #]",
      "[Date of Transaction / DD-MM-YYYY]",
      "[Amount Paid in INR]",
      "[Detailed factual description of defect, deficiency, or delay]",
      "[Full Refund / Replacement / Rectification / Compensation]"
    ],
    generatedAt: new Date(),
    disclaimer: "DRAFT TEMPLATE: Generated by NeedhiAI for user preparation and review. This draft has not been filed, served, or vetted by an advocate. Please review and verify all factual particulars before dispatch."
  };
}

/**
 * Searches procedural knowledge and returns grounded guidance for a user query.
 */
export function searchHelpHubKnowledge(query = "") {
  const cleanQ = (query || "").toLowerCase().trim();

  // Find matching categories
  const matchedCategories = CONSUMER_CATEGORIES.filter((cat) => {
    return (
      cat.name.toLowerCase().includes(cleanQ) ||
      cat.description.toLowerCase().includes(cleanQ) ||
      cat.commonScenarios.some((s) => s.toLowerCase().includes(cleanQ))
    );
  });

  // Check for jurisdiction queries
  const isJurisdiction = cleanQ.includes("jurisdiction") || cleanQ.includes("limit") || cleanQ.includes("where to file") || cleanQ.includes("threshold") || cleanQ.includes("court");
  // Check for fee queries
  const isFee = cleanQ.includes("fee") || cleanQ.includes("cost") || cleanQ.includes("charge") || cleanQ.includes("free");
  // Check for limitation queries
  const isLimitation = cleanQ.includes("limitation") || cleanQ.includes("time") || cleanQ.includes("deadline") || cleanQ.includes("year") || cleanQ.includes("delay");

  return {
    query,
    matchedCategories: matchedCategories.length > 0 ? matchedCategories : CONSUMER_CATEGORIES.slice(0, 3),
    proceduralGuidance: {
      jurisdiction: isJurisdiction || (!isFee && !isLimitation) ? PROCEDURAL_KNOWLEDGE.jurisdiction : null,
      filingFees: isFee ? PROCEDURAL_KNOWLEDGE.filingFees : null,
      limitationPeriod: isLimitation ? PROCEDURAL_KNOWLEDGE.limitationPeriod : null,
      officialPortals: PROCEDURAL_KNOWLEDGE.officialPortals
    },
    suggestedNextAction: {
      investigateCase: "Start a structured investigation with NeedhiAI to evaluate evidence and legal grounds.",
      draftDocument: "Prepare a formal grievance email, demand notice, or complaint petition."
    }
  };
}
