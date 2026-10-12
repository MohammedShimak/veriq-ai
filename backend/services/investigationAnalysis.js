import { generateContentWithRetry } from "./gemini.js";
import { safeParseJSON } from "../utils/jsonHelper.js";
import crypto from "crypto";

/**
 * Maximum rounds allowed to prevent infinite question loops
 */
export const MAX_CLARIFICATION_ROUNDS = 3;

/**
 * Supported Consumer Protection Act, 2019 Dispute Categories
 */
export const CONSUMER_DISPUTE_CATEGORIES = [
  "Defective Product",
  "Defective Electronics & Appliances",
  "E-Commerce & Retail",
  "E-Commerce / Delivery Issue",
  "Refunds & Delivery",
  "Refund / Billing Dispute",
  "Banking & Payments",
  "Insurance",
  "Telecom & Internet",
  "Healthcare & Medical Services",
  "Real Estate & Housing",
  "Travel & Hotels",
  "Education & Coaching",
  "Utilities & Public Services",
  "Deficiency in Service",
  "General Consumer Dispute"
];

/**
 * Classifies a consumer dispute into standard categories under CPA 2019.
 * 
 * @param {string} complaint 
 * @param {string} [product] 
 * @param {string} [company] 
 * @param {string} [explicitCategory] 
 * @returns {string} Standard category name
 */
export function classifyDisputeCategory(complaint = "", product = "", company = "", explicitCategory = "") {
  if (explicitCategory && explicitCategory !== "General Consumer Law" && explicitCategory !== "General Consumer Dispute") {
    const explicitLower = explicitCategory.toLowerCase().trim();
    if (explicitLower.includes("bank") || explicitLower.includes("payment")) return "Banking & Payments";
    if (explicitLower.includes("insur")) return "Insurance";
    if (explicitLower.includes("telecom") || explicitLower.includes("internet") || explicitLower.includes("broadband") || explicitLower.includes("wifi")) return "Telecom & Internet";
    if (explicitLower.includes("health") || explicitLower.includes("medic") || explicitLower.includes("doctor") || explicitLower.includes("hospital")) return "Healthcare & Medical Services";
    if (explicitLower.includes("real estate") || explicitLower.includes("housing") || explicitLower.includes("builder") || explicitLower.includes("flat")) return "Real Estate & Housing";
    if (explicitLower.includes("travel") || explicitLower.includes("flight") || explicitLower.includes("hotel") || explicitLower.includes("railway") || explicitLower.includes("airline")) return "Travel & Hotels";
    if (explicitLower.includes("education") || explicitLower.includes("coaching") || explicitLower.includes("college") || explicitLower.includes("school")) return "Education & Coaching";
    if (explicitLower.includes("utilit") || explicitLower.includes("electric") || explicitLower.includes("water") || explicitLower.includes("gas") || explicitLower.includes("power")) return "Utilities & Public Services";
    if (explicitLower.includes("e-commerce") || explicitLower.includes("retail") || explicitLower.includes("shopping")) return "E-Commerce & Retail";
    if (explicitLower.includes("refund") || explicitLower.includes("delivery")) return "Refunds & Delivery";
    if (explicitLower.includes("electronic") || explicitLower.includes("appliance") || explicitLower.includes("defect") || explicitLower.includes("device")) return "Defective Product";
  }

  const text = `${complaint} ${product} ${company}`.toLowerCase();

  // 1. Banking & Payments
  if (
    /\b(?:bank|banking|atm|credit card|debit card|emi|upi|neft|rtgs|unauthorized transaction|unauthorised transaction|fraudulent transaction|account debited|wallet|rbi|loan|interest charged|cheque|hdfc|sbi|icici|axis bank|paytm|gpay|phonepe|chargeback)\b/i.test(text)
  ) {
    return "Banking & Payments";
  }

  // 2. Insurance (strictly word-boundary guarded to avoid false substring triggers like 'smart panel' matching 'tpa')
  if (
    /\b(?:insurance|policy|mediclaim|cashless|repudiat\w*|premium|surveyor|health insurance|motor insurance|life insurance|vehicle insurance|irda|star health|tpa|lic|indemnity)\b/i.test(text)
  ) {
    return "Insurance";
  }

  // 3. Travel & Hotels
  if (
    /\b(?:flight|airline|pnr|boarding|baggage|luggage|hotel|resort|indigo|air india|spicejet|train|irctc|railway|tour|package|makemytrip|goibibo|booking\.com|yatra|flight delay|cancelled flight|flight cancellation)\b/i.test(text)
  ) {
    return "Travel & Hotels";
  }

  // 4. Real Estate & Housing
  if (
    /\b(?:builder|flat|apartment|possession|rera|housing|society|allotment|developer|occupancy certificate|delayed possession|carpet area|amenities|villa|plot|real estate|homebuyer)\b/i.test(text)
  ) {
    return "Real Estate & Housing";
  }

  // 5. Healthcare & Medical Services
  if (
    /\b(?:hospital|doctor|medical|surgery|treatment|clinic|patient|physician|medicine|negligence|diagnosis|prescription|discharge summary|malpractice|healthcare)\b/i.test(text)
  ) {
    return "Healthcare & Medical Services";
  }

  // 6. Telecom & Internet
  if (
    /\b(?:telecom|broadband|wifi|wi-fi|internet|fiber|fibre|sim|network|jio|airtel|bsnl|vodafone|recharge|porting|mnp|call drop|dth|trai)\b/i.test(text)
  ) {
    return "Telecom & Internet";
  }

  // 7. Education & Coaching
  if (
    /\b(?:coaching|institute|college|course|university|school|tuition|fees|admission|curriculum|degree|diploma|allen|byju|fiitjee|neet|jee|student)\b/i.test(text)
  ) {
    return "Education & Coaching";
  }

  // 8. Utilities & Public Services
  if (
    /\b(?:electricity|power cut|meter|water bill|gas connection|lpg|cylinder|utility|disconnection|eb bill|bijli|water supply|substation|power outage)\b/i.test(text)
  ) {
    return "Utilities & Public Services";
  }

  // 9. E-Commerce & Retail
  if (
    /\b(?:amazon|flipkart|myntra|meesho|ajio|e-commerce|ecommerce|wrong product|wrong item|fake product|counterfeit|empty box|tampered parcel|marketplace|replacement denied|unboxing|courier)\b/i.test(text)
  ) {
    return "E-Commerce & Retail";
  }

  // 10. Refunds & Delivery
  if (
    /\b(?:refund|not delivered|delivery delay|money not returned|order cancelled|cancelled order|delivery partner|package lost|failed delivery|undelivered|billing dispute|denied refund)\b/i.test(text)
  ) {
    return "Refunds & Delivery";
  }

  // 11. Defective Product (Electronics & Durables)
  if (
    /\b(?:defect|defective|damaged|broken|flicker|screen|smartphone|mobile phone|laptop|tv|television|washing machine|refrigerator|fridge|ac|air conditioner|motherboard|service center|job sheet|technician|warranty|hardware|battery|cooling failure|device failure)\b/i.test(text)
  ) {
    return "Defective Product";
  }

  // 12. Fallback
  return "General Consumer Dispute";
}

/**
 * Deterministic helper to detect chronological contradictions in complaint text
 * @param {string} text 
 * @returns {string[]} Array of contradiction descriptions
 */
export function detectDateContradictions(text = "") {
  if (!text || typeof text !== "string") return [];
  const contradictions = [];

  const dateRegex = /\b(\d{1,2}(?:st|nd|rd|th)?[\s/-]+(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|\d{1,2})[\s/,-]+(?:\d{2,4}))\b/gi;
  const matches = [...text.matchAll(dateRegex)];

  if (matches.length >= 2) {
    const cleanDateStr = (s) => s.replace(/(\d+)(st|nd|rd|th)/i, "$1");
    const d1 = new Date(cleanDateStr(matches[0][0]));
    const d2 = new Date(cleanDateStr(matches[1][0]));

    if (!isNaN(d1.getTime()) && !isNaN(d2.getTime())) {
      const idx1 = matches[0].index;
      const idx2 = matches[1].index;
      const textBefore1 = text.substring(Math.max(0, idx1 - 60), idx1).toLowerCase();
      const textBefore2 = text.substring(Math.max(0, idx2 - 60), idx2).toLowerCase();

      const isEarlierEvent = textBefore1.includes("bought") || textBefore1.includes("purchase") || textBefore1.includes("order") || textBefore1.includes("deliver") || textBefore1.includes("booked") || textBefore1.includes("paid");
      const isLaterEvent = textBefore2.includes("crack") || textBefore2.includes("defect") || textBefore2.includes("broke") || textBefore2.includes("fail") || textBefore2.includes("screen") || textBefore2.includes("damage") || textBefore2.includes("stopped") || textBefore2.includes("complain") || textBefore2.includes("issue") || textBefore2.includes("cancel") || textBefore2.includes("hospital");

      if (isEarlierEvent && isLaterEvent && d1.getTime() > d2.getTime()) {
        contradictions.push(
          `Chronological discrepancy: The reported initial transaction date (${matches[0][0]}) appears to occur after the reported incident/grievance date (${matches[1][0]}).`
        );
      } else if (d1.getTime() > d2.getTime() && (textBefore1.includes("date") || textBefore1.includes("on")) && (textBefore2.includes("subsequent") || textBefore2.includes("after") || textBefore2.includes("later"))) {
        contradictions.push(
          `Chronological discrepancy: First stated date (${matches[0][0]}) occurs after second stated date (${matches[1][0]}).`
        );
      }
    }
  }

  return contradictions;
}

/**
 * Category-specific metadata, missing facts, and structured fallback questions
 */
export function getCategoryConfig(category) {
  switch (category) {
    case "Banking & Payments":
      return {
        missingFacts: [
          "Exact date and time of disputed transaction",
          "Whether OTP, password, or card CVV was shared",
          "Date dispute was formally reported to bank (Zero Liability window under RBI)",
          "Bank grievance docket or complaint reference number"
        ],
        evidence: [
          "Bank Account Statement showing disputed debit",
          "SMS / Email transaction alert timestamp",
          "Written complaint or ticket acknowledged by Bank",
          "Police Cyber Crime complaint (if applicable)"
        ],
        fallbackQuestions: [
          {
            id: "q_banking_dispute_type",
            question: "What is the specific nature of your banking/payment dispute?",
            type: "single_choice",
            options: [
              "Unauthorized / fraudulent transaction (debit without consent)",
              "ATM cash not dispensed but account debited",
              "Double debit / failed merchant transfer",
              "Arbitrary penalty charges or excessive interest",
              "Loan / EMI credit score reporting dispute",
              "Other",
              "Not sure"
            ],
            allowOther: true,
            importance: "CRITICAL",
            legalRelevance: "Determines applicable RBI circular on customer liability and deficiency in service under Section 2(11) CPA 2019."
          },
          {
            id: "q_banking_credential_sharing",
            question: "Did you share any OTP, PIN, password, or card CVV with anyone or enter it on an unverified link?",
            type: "single_choice",
            options: [
              "No, never shared credentials or OTP",
              "Yes, deceived by caller / phishing page",
              "Not sure",
              "Other"
            ],
            allowOther: true,
            importance: "CRITICAL",
            legalRelevance: "Crucial to establish Zero or Limited Liability under RBI Circular DBR.No.Leg.BC.78/09.07.005/2017-18."
          },
          {
            id: "q_banking_reporting_timeline",
            question: "How soon after noticing the unauthorized debit did you notify the bank?",
            type: "single_choice",
            options: [
              "Within 24 hours of transaction",
              "Within 3 working days (qualifies for zero customer liability)",
              "Between 4 and 7 working days (limited liability)",
              "After more than 7 working days",
              "Have not reported to the bank yet",
              "Other"
            ],
            allowOther: true,
            importance: "HIGH",
            legalRelevance: "Statutory timeline establishing customer protection bounds under RBI banking regulations."
          },
          {
            id: "q_banking_written_response",
            question: "Has the bank issued a formal written grievance closure or denial letter?",
            type: "single_choice",
            options: [
              "Yes, bank denied liability claiming customer negligence",
              "Yes, bank promised chargeback / reversal but delayed",
              "No formal written response received",
              "Other",
              "Not sure"
            ],
            allowOther: true,
            importance: "HIGH",
            legalRelevance: "Documents final exhaustion of internal bank remedies before approaching Banking Ombudsman or Consumer Forum.",
            conditionalFollowUp: {
              id: "q_banking_written_response_followup",
              parentQuestionId: "q_banking_written_response",
              showIfOptions: ["Yes, bank denied liability claiming customer negligence", "Other"],
              question: "Please specify the reason or clause cited by the bank in their denial:",
              type: "text",
              placeholder: "e.g. Bank stated that transaction was authenticated via 2-factor OTP..."
            }
          }
        ]
      };

    case "Insurance":
      return {
        missingFacts: [
          "Insurance policy number and current coverage validity",
          "Formal claim submission date",
          "Exact ground or clause stated in insurer's repudiation letter",
          "Whether prior medical or vehicle history was disclosed at proposal"
        ],
        evidence: [
          "Insurance Policy Schedule & Terms document",
          "Claim Form & Acknowledgment receipt",
          "Hospital Discharge Summary or Surveyor Inspection Report",
          "Formal Claim Repudiation or deduction letter from Insurer"
        ],
        fallbackQuestions: [
          {
            id: "q_insurance_policy_type",
            question: "What category of insurance policy is subject to this dispute?",
            type: "single_choice",
            options: [
              "Health / Mediclaim Insurance",
              "Motor / Vehicle Insurance (Accident / Theft)",
              "Life / Term Insurance",
              "Travel Insurance",
              "Property / Home / Fire Insurance",
              "Other",
              "Not sure"
            ],
            allowOther: true,
            importance: "CRITICAL",
            legalRelevance: "Identifies applicable IRDAI regulatory guidelines and statutory indemnity principles."
          },
          {
            id: "q_insurance_claim_status",
            question: "What is the current status of your claim with the insurance company?",
            type: "single_choice",
            options: [
              "Claim completely repudiated / rejected by insurer",
              "Partial deduction / arbitrary capping of claimed expenses",
              "Cashless facility denied at network hospital",
              "Inordinate delay / claim pending without reason",
              "Other",
              "Not sure"
            ],
            allowOther: true,
            importance: "CRITICAL",
            legalRelevance: "Establishes cause of action for Deficiency in Service under Section 2(11) CPA 2019."
          },
          {
            id: "q_insurance_repudiation_reason",
            question: "What primary ground was stated in the insurer's repudiation or deduction letter?",
            type: "single_choice",
            options: [
              "Pre-existing disease (PED) non-disclosure alleged",
              "Delay in claim intimation beyond policy timeline",
              "Treatment considered non-medical or exploratory",
              "Disputed surveyor assessment / room rent cap",
              "No formal written reason provided",
              "Other",
              "Not sure"
            ],
            allowOther: true,
            importance: "HIGH",
            legalRelevance: "Allows testing against Supreme Court rulings prohibiting arbitrary repudiation (e.g., Manmohan Nanda vs. United India Assurance).",
            conditionalFollowUp: {
              id: "q_insurance_repudiation_reason_followup",
              parentQuestionId: "q_insurance_repudiation_reason",
              showIfOptions: ["Pre-existing disease (PED) non-disclosure alleged", "Other"],
              question: "Did you disclose prior health conditions when taking the policy?",
              type: "single_choice",
              options: [
                "Yes, fully disclosed on proposal form",
                "Condition diagnosed after policy commenced",
                "Agent filled the form without asking",
                "Not sure",
                "Other"
              ]
            }
          },
          {
            id: "q_insurance_documents_held",
            question: "Which of the following documents do you currently have in your possession?",
            type: "multiple_choice",
            options: [
              "Insurance Policy Schedule",
              "Hospital Discharge Summary",
              "Itemized hospital / repair bills with receipts",
              "Insurer Repudiation or Deduction letter",
              "Surveyor inspection report",
              "None of these",
              "Other"
            ],
            allowOther: true,
            importance: "HIGH",
            legalRelevance: "Identifies documentary proof required to establish evidentiary admissibility under Consumer Protection Rules."
          }
        ]
      };

    case "Telecom & Internet":
      return {
        missingFacts: [
          "Telecom service identifier (Broadband ID, Mobile Number, or Customer ID)",
          "Duration of service outage or billing discrepancy",
          "Customer complaint docket / SR number issued by telecom provider",
          "Whether disconnection or porting restriction was imposed"
        ],
        evidence: [
          "Monthly Telecom / Broadband Tax Invoice",
          "Customer Care complaint docket SMS or email",
          "Network speed test logs or broadband downtime records",
          "Porting request (UPC) generation proof"
        ],
        fallbackQuestions: [
          {
            id: "q_telecom_issue_type",
            question: "What is the primary telecom or internet service issue?",
            type: "single_choice",
            options: [
              "Continuous broadband / fiber connection outage",
              "Wrongful billing / unauthorized VAS subscriptions",
              "Unlawful rejection of mobile number porting (MNP)",
              "Non-refund of security deposit upon disconnection",
              "Severe speed throttling below statutory minimum",
              "Other",
              "Not sure"
            ],
            allowOther: true,
            importance: "CRITICAL",
            legalRelevance: "Determines deficiency in service under CPA 2019 and Quality of Service standards under TRAI regulations."
          },
          {
            id: "q_telecom_outage_duration",
            question: "For how long has the service interruption or billing grievance persisted?",
            type: "single_choice",
            options: [
              "Less than 24 hours",
              "Between 1 and 7 days",
              "Between 1 week and 1 month",
              "More than 1 month",
              "Other",
              "Not sure"
            ],
            allowOther: true,
            importance: "HIGH",
            legalRelevance: "Quantifies proportionate compensation and billing rebate mandated for service downtime."
          },
          {
            id: "q_telecom_ticket_number",
            question: "Did the service provider issue a formal service request (SR) or complaint ticket number?",
            type: "text",
            placeholder: "e.g. SR-893021 / Docket #102948 (or 'None provided')",
            importance: "HIGH",
            legalRelevance: "Proves that the consumer notified the provider before statutory claim escalation."
          },
          {
            id: "q_telecom_requested_relief",
            question: "What primary resolution are you seeking from the provider?",
            type: "single_choice",
            options: [
              "Pro-rata refund / billing credit for outage period",
              "Immediate disconnection and refund of security deposit",
              "Clearance of MNP porting request",
              "Waiver of erroneous charges",
              "Other",
              "Not sure"
            ],
            allowOther: true,
            importance: "MEDIUM",
            legalRelevance: "Frames the relief prayer under Section 39 CPA 2019."
          }
        ]
      };

    case "Travel & Hotels":
      return {
        missingFacts: [
          "Booking PNR, reservation code, or ticket number",
          "Date of scheduled travel or hotel check-in",
          "Reason cited by carrier/hotel for cancellation or downgrade",
          "Whether alternate accommodation, flight, or refund was provided"
        ],
        evidence: [
          "Confirmed Booking Ticket / PNR receipt",
          "Cancellation notice or delay announcement from provider",
          "Payment transaction receipt",
          "Written communication regarding refund refusal"
        ],
        fallbackQuestions: [
          {
            id: "q_travel_grievance_type",
            question: "What is the primary nature of your travel or hotel grievance?",
            type: "single_choice",
            options: [
              "Flight / train cancelled by carrier without prompt refund",
              "Severe flight / train delay without food or accommodation",
              "Denied boarding due to commercial overbooking",
              "Hotel room denied, downgraded, or found unhygienic",
              "Lost or damaged baggage / luggage",
              "Tour operator failed to provide promised itinerary",
              "Other",
              "Not sure"
            ],
            allowOther: true,
            importance: "CRITICAL",
            legalRelevance: "Determines liability under DGCA Passenger Charter, Railway Rules, or Consumer Protection Act."
          },
          {
            id: "q_travel_remedy_offered",
            question: "What alternative or remedy did the travel operator provide at the time of the issue?",
            type: "single_choice",
            options: [
              "Full refund promised but pending for weeks",
              "Only credit shell / travel voucher offered (refused bank refund)",
              "Alternative flight / room provided but substandard",
              "Refused any compensation, food, or assistance",
              "No communication / representative unreachable",
              "Other",
              "Not sure"
            ],
            allowOther: true,
            importance: "HIGH",
            legalRelevance: "Enforces DGCA mandates that passengers have statutory right to full cash refund rather than forced credit shells."
          },
          {
            id: "q_travel_pnr",
            question: "What is your booking PNR, reservation code, or ticket reference number?",
            type: "text",
            placeholder: "e.g. PNR: 6E-28491 / IRCTC: 2948192849 / Booking ID: H-91823",
            importance: "HIGH",
            legalRelevance: "Identifies the contractual privity of contract and booking transaction details."
          },
          {
            id: "q_travel_date",
            question: "On what date was the scheduled travel or hotel stay?",
            type: "date",
            importance: "CRITICAL",
            legalRelevance: "Determines statutory limitation period under Section 69 CPA 2019."
          }
        ]
      };

    case "Real Estate & Housing":
      return {
        missingFacts: [
          "Agreed possession date specified in the Builder-Buyer Agreement",
          "Total consideration paid versus total agreed flat cost",
          "Whether project has obtained Occupancy Certificate (OC)",
          "RERA registration status of the housing project"
        ],
        evidence: [
          "Builder-Buyer Agreement / Allotment Letter",
          "All payment receipts and bank transaction proofs",
          "Demand letters and penalty notices from builder",
          "RERA registration certificate (if available)"
        ],
        fallbackQuestions: [
          {
            id: "q_housing_grievance_type",
            question: "What is the primary grievance regarding your housing purchase?",
            type: "single_choice",
            options: [
              "Inordinate delay in handing over physical possession",
              "Substandard construction / major structural defects",
              "Demanding arbitrary extra charges (escalation / amenities)",
              "Handing over without Occupancy Certificate (OC)",
              "Unlawful cancellation and forfeiture of booking amount",
              "Other",
              "Not sure"
            ],
            allowOther: true,
            importance: "CRITICAL",
            legalRelevance: "Triggers Supreme Court precedents holding delayed housing possession as statutory deficiency in service (LDA vs M.K. Gupta)."
          },
          {
            id: "q_housing_rera_status",
            question: "Is this real estate project registered under State RERA?",
            type: "single_choice",
            options: [
              "Yes, project is registered under RERA",
              "No, project is unregistered",
              "Not sure",
              "Other"
            ],
            allowOther: true,
            importance: "HIGH",
            legalRelevance: "Establishes dual-jurisdiction rights under CPA 2019 and RERA Act, 2016 (Imperia Structures precedent)."
          },
          {
            id: "q_housing_agreed_possession_date",
            question: "What was the promised date of possession as per your agreement?",
            type: "date",
            importance: "CRITICAL",
            legalRelevance: "Determines default timeline for claiming interest and possession delay penalty."
          },
          {
            id: "q_housing_total_paid",
            question: "What is the total amount paid so far to the builder?",
            type: "number",
            unit: "₹",
            importance: "HIGH",
            legalRelevance: "Quantifies consumer claim value and Commission pecuniary jurisdiction."
          }
        ]
      };

    case "Healthcare & Medical Services":
      return {
        missingFacts: [
          "Date and nature of medical treatment or procedure",
          "Name of treating hospital, clinic, or practitioner",
          "Nature of alleged negligence, overcharging, or deficiency",
          "Itemized medical records and discharge summary held"
        ],
        evidence: [
          "Hospital Discharge Summary and admission records",
          "Itemized medical bill with payment receipts",
          "Diagnostic lab reports, scans, and doctor prescriptions",
          "Written complaint or response from hospital administration"
        ],
        fallbackQuestions: [
          {
            id: "q_medical_grievance_type",
            question: "What is the primary nature of your healthcare grievance?",
            type: "single_choice",
            options: [
              "Excessive overcharging beyond agreed estimate / tariff",
              "Medical negligence or incorrect surgical / clinical treatment",
              "Denial of emergency admission or life-saving care",
              "Refusal to release medical records / discharge summary",
              "Adverse reaction due to wrong prescription or expired medicine",
              "Other",
              "Not sure"
            ],
            allowOther: true,
            importance: "CRITICAL",
            legalRelevance: "Determines Bolam / Jacob Mathew legal test for medical deficiency under Section 2(11) CPA 2019."
          },
          {
            id: "q_medical_records_held",
            question: "Which of the following medical records do you currently possess?",
            type: "multiple_choice",
            options: [
              "Hospital Discharge Summary",
              "Itemized hospital bills with payment receipts",
              "Diagnostic lab reports (blood / scans / biopsy)",
              "Treating doctor's written prescriptions",
              "Independent medical second opinion",
              "None of these",
              "Other"
            ],
            allowOther: true,
            importance: "HIGH",
            legalRelevance: "Assesses documentary sufficiency required to sustain medical grievance proceedings."
          },
          {
            id: "q_medical_treatment_date",
            question: "On what date did the admission, procedure, or medical incident occur?",
            type: "date",
            importance: "CRITICAL",
            legalRelevance: "Establishes limitation period under Section 69 CPA 2019."
          },
          {
            id: "q_medical_written_complaint",
            question: "Have you submitted a formal written grievance to the hospital or State Medical Council?",
            type: "single_choice",
            options: [
              "Yes, written complaint given to hospital management",
              "Yes, complaint filed before State Medical Council",
              "No, verbal complaints only",
              "Not yet",
              "Other"
            ],
            allowOther: true,
            importance: "MEDIUM",
            legalRelevance: "Verifies pre-litigation grievance escalation records."
          }
        ]
      };

    case "Education & Coaching":
      return {
        missingFacts: [
          "Course enrollment date and total fee paid",
          "Date refund was requested upon discontinuing course",
          "Reason for leaving (false claims, faculty change, personal)",
          "Prospectus terms or fee receipt terms regarding refund"
        ],
        evidence: [
          "Coaching / College Admission Form & Fee Receipt",
          "Institution Prospectus or fee policy brochure",
          "Written refund application / email with date proof",
          "Institution denial reply or communication records"
        ],
        fallbackQuestions: [
          {
            id: "q_education_issue_type",
            question: "What is the primary dispute with the education or coaching provider?",
            type: "single_choice",
            options: [
              "Refusal to refund unutilized course fees upon exit",
              "Misleading advertisement regarding ranks, faculty, or placement",
              "Abrupt closure of batch / substandard teaching quality",
              "Arbitrary fee hike or withholding certificates / marksheet",
              "Coaching center loan / EMI deduction dispute",
              "Other",
              "Not sure"
            ],
            allowOther: true,
            importance: "CRITICAL",
            legalRelevance: "Applies Supreme Court and NCDRC precedents prohibiting non-refundable advance fee clauses in education."
          },
          {
            id: "q_education_refund_timing",
            question: "When did you request the refund or exit from the course?",
            type: "single_choice",
            options: [
              "Before classes officially commenced",
              "Within the first 15 days of classes",
              "Within the first month",
              "After attending for more than a month",
              "Other",
              "Not sure"
            ],
            allowOther: true,
            importance: "HIGH",
            legalRelevance: "Determines statutory entitlement to pro-rata refund after deduction of nominal administrative charges."
          },
          {
            id: "q_education_fees_paid",
            question: "What was the total fee amount paid to the institution?",
            type: "number",
            unit: "₹",
            importance: "HIGH",
            legalRelevance: "Quantifies the disputed consideration amount."
          },
          {
            id: "q_education_loan_involved",
            question: "Was the course fee financed through an education loan or third-party NBFC EMI?",
            type: "single_choice",
            options: [
              "Yes, financed through coaching tie-up loan (EMIs still deducting)",
              "No, paid directly via cash / card / bank transfer",
              "Not sure",
              "Other"
            ],
            allowOther: true,
            importance: "HIGH",
            legalRelevance: "Assesses necessity to implead NBFC lender to stop ongoing auto-debits under CCPA guidelines."
          }
        ]
      };

    case "Utilities & Public Services":
      return {
        missingFacts: [
          "Consumer connection number or meter identifier",
          "Disputed billing cycle and billed amount",
          "Whether meter testing / inspection was conducted",
          "Notice of disconnection issued by provider"
        ],
        evidence: [
          "Disputed Utility Bill (Electricity, Water, Gas)",
          "Previous 6 months normal utility bills for comparison",
          "Meter inspection report or testing slip",
          "Written complaint acknowledgment from utility board"
        ],
        fallbackQuestions: [
          {
            id: "q_utility_issue_type",
            question: "What is the primary grievance regarding utility services?",
            type: "single_choice",
            options: [
              "Abnormal / inflated meter bill far exceeding normal usage",
              "Threat of wrongful disconnection of essential supply",
              "Inordinate delay in releasing new connection / meter",
              "Frequent unannounced long power or water cuts",
              "Non-refund of security deposit upon shifting",
              "Other",
              "Not sure"
            ],
            allowOther: true,
            importance: "CRITICAL",
            legalRelevance: "Assesses deficiency under Electricity Act, 2003 and Section 2(11) Consumer Protection Act, 2019."
          },
          {
            id: "q_utility_meter_tested",
            question: "Has the utility board tested or calibrated the meter?",
            type: "single_choice",
            options: [
              "Meter tested and found faulty by board",
              "Meter tested but board claimed it is accurate",
              "Meter testing applied for, but board delayed",
              "No testing requested yet",
              "Other",
              "Not sure"
            ],
            allowOther: true,
            importance: "HIGH",
            legalRelevance: "Statutory proof requirement for challenging suspected fast/defective meters."
          },
          {
            id: "q_utility_consumer_number",
            question: "What is your consumer connection number or meter identifier?",
            type: "text",
            placeholder: "e.g. CA No: 102948192 / Consumer No: 83921",
            importance: "HIGH",
            legalRelevance: "Identifies the official account in board utility records."
          },
          {
            id: "q_utility_disputed_amount",
            question: "What is the disputed excess billing amount?",
            type: "number",
            unit: "₹",
            importance: "HIGH",
            legalRelevance: "Defines the financial quantum under dispute."
          }
        ]
      };

    case "E-Commerce & Retail":
    case "E-Commerce / Delivery Issue":
      return {
        missingFacts: [
          "E-commerce order ID and delivery date",
          "Exact condition of delivery (Wrong product, Fake, Empty box, Damaged)",
          "Seller and marketplace return window status",
          "Whether unboxing video or parcel photos were captured"
        ],
        evidence: [
          "Tax Invoice and Order Summary page",
          "Outer shipping label photograph showing tracking number",
          "Unboxing video or photographs of delivered item",
          "Customer support chat transcript or email rejection"
        ],
        fallbackQuestions: [
          {
            id: "q_ecom_delivery_condition",
            question: "What was the exact condition of the item or package upon delivery?",
            type: "single_choice",
            options: [
              "Completely wrong item received (different product inside)",
              "Package was empty or contained dummy weight / stones",
              "Package seal was tampered, torn, or damaged in transit",
              "Delivered counterfeit / fake replica product",
              "Package never delivered but marked delivered on portal",
              "Other",
              "Not sure"
            ],
            allowOther: true,
            importance: "CRITICAL",
            legalRelevance: "Establishes breach of warranty and unfair trade practice under Consumer Protection (E-Commerce) Rules, 2020.",
            conditionalFollowUp: {
              showIfOptions: [
                "Completely wrong item received (different product inside)",
                "Package was empty or contained dummy weight / stones",
                "Package seal was tampered, torn, or damaged in transit",
                "Delivered counterfeit / fake replica product",
                "Other"
              ],
              question: "Do you possess an unboxing video or photographs taken immediately upon delivery?",
              type: "single_choice",
              options: [
                "Yes, full unboxing video available",
                "Yes, clear photographs of parcel and product",
                "No photos or video captured",
                "Other"
              ]
            }
          },
          {
            id: "q_ecom_return_status",
            question: "What is the current status of your return or replacement request on the platform?",
            type: "single_choice",
            options: [
              "Return request rejected citing policy or return window",
              "Return approved but pickup agent failed to arrive",
              "Return item picked up, but refund withheld / denied",
              "Account blocked / blocked from raising return",
              "Other",
              "Not sure"
            ],
            allowOther: true,
            importance: "HIGH",
            legalRelevance: "Determines marketplace liability and refusal of statutory 14-day replacement/refund."
          },
          {
            id: "q_ecom_delivery_date",
            question: "On what date was the parcel delivered to you?",
            type: "date",
            importance: "CRITICAL",
            legalRelevance: "Validates whether the dispute was reported within the statutory return window."
          },
          {
            id: "q_ecom_order_id",
            question: "What is the e-commerce Order ID or tracking number?",
            type: "text",
            placeholder: "e.g. OD12948192847192800 / Tracking: DEL-918231",
            importance: "HIGH",
            legalRelevance: "Establishes transaction identity and order privity under Section 2(47) CPA 2019."
          }
        ]
      };

    case "Refunds & Delivery":
    case "Refund / Billing Dispute":
      return {
        missingFacts: [
          "Order / payment transaction reference ID",
          "Exact date refund was promised or cancellation accepted",
          "Original payment channel used (UPI, Card, Net Banking, COD)",
          "Official reason given by the seller for withholding refund"
        ],
        evidence: [
          "Order Confirmation and Payment Debit receipt",
          "Cancellation confirmation email / screenshot",
          "Bank statement showing absence of refund credit",
          "Customer support chats promising refund timeline"
        ],
        fallbackQuestions: [
          {
            id: "q_refund_current_status",
            question: "What is the current status of your refund request?",
            type: "single_choice",
            options: [
              "Refund formally promised by seller, but never credited",
              "Refund rejected / denied by seller citing terms",
              "Partial refund received with unexplained deductions",
              "Seller stopped responding to calls and messages",
              "Other",
              "Not sure"
            ],
            allowOther: true,
            importance: "CRITICAL",
            legalRelevance: "Establishes withholding of consideration without lawful authority under Section 2(47) CPA 2019."
          },
          {
            id: "q_refund_payment_mode",
            question: "Which payment method was used for the original transaction?",
            type: "single_choice",
            options: [
              "UPI (Google Pay, PhonePe, Paytm, BHIM)",
              "Debit / Credit Card",
              "Net Banking",
              "Cash on Delivery (COD)",
              "E-Wallet / Gift Card balance",
              "Other",
              "Not sure"
            ],
            allowOther: true,
            importance: "HIGH",
            legalRelevance: "Traces the financial channel for verification of bank chargeback and refund routing."
          },
          {
            id: "q_refund_disputed_amount",
            question: "What is the exact amount currently pending refund?",
            type: "number",
            unit: "₹",
            importance: "HIGH",
            legalRelevance: "Quantifies the primary claim prayer and statutory interest calculations."
          },
          {
            id: "q_refund_cancellation_date",
            question: "On what date was the order cancelled or refund promised?",
            type: "date",
            importance: "CRITICAL",
            legalRelevance: "Determines expiration of statutory 7-day refund window under E-Commerce Rules, 2020."
          }
        ]
      };

    case "Defective Product":
    case "Defective Electronics & Appliances":
      return {
        missingFacts: [
          "Date of purchase and delivery of the electronic product",
          "Manufacturer warranty duration and current validity status",
          "Date when defect first manifested",
          "Whether authorized service center issued a job sheet / inspection report"
        ],
        evidence: [
          "Tax Invoice and Warranty Card",
          "Service Center Job Sheet / Inspection Report",
          "Photographs or video demonstrating the defect",
          "Customer support complaint ticket emails"
        ],
        fallbackQuestions: [
          {
            id: "q_electronics_defect_nature",
            question: "What is the primary technical failure or defect in the product?",
            type: "single_choice",
            options: [
              "Complete power / motherboard / hardware failure",
              "Display / screen flickering, lines, or dead pixels",
              "Battery draining rapidly or overheating danger",
              "Mechanical / cooling / motor breakdown",
              "Repetitive software / firmware failure after update",
              "Other",
              "Not sure"
            ],
            allowOther: true,
            importance: "CRITICAL",
            legalRelevance: "Identifies whether the defect is a manufacturing defect under Section 2(24) and Section 84 CPA 2019."
          },
          {
            id: "q_electronics_warranty_status",
            question: "Is the product currently covered under warranty?",
            type: "single_choice",
            options: [
              "Within standard manufacturer 1-year warranty",
              "Covered under purchased extended warranty",
              "Defect occurred within warranty, but warranty now expired",
              "Out of warranty",
              "Not sure",
              "Other"
            ],
            allowOther: true,
            importance: "CRITICAL",
            legalRelevance: "Establishes statutory warranty obligation under Section 2(10) CPA 2019."
          },
          {
            id: "q_electronics_service_center",
            question: "Have you visited an authorized service center or received a technician inspection?",
            type: "single_choice",
            options: [
              "Yes, service center issued job sheet confirming defect",
              "Yes, service center refused repair alleging physical / liquid damage",
              "Technician visited home but could not resolve issue",
              "Product currently deposited at service center for weeks",
              "Have not visited service center yet",
              "Other"
            ],
            allowOther: true,
            importance: "HIGH",
            legalRelevance: "Provides independent technical proof of manufacturing defect without customer misuse.",
            conditionalFollowUp: {
              id: "q_electronics_service_center_followup",
              parentQuestionId: "q_electronics_service_center",
              showIfOptions: ["Yes, service center refused repair alleging physical / liquid damage", "Other"],
              question: "Do you dispute the service center's claim of physical or liquid damage?",
              type: "single_choice",
              options: [
                "Yes, device was never dropped, tampered, or exposed to liquid",
                "Damage was present right upon delivery",
                "Not sure",
                "Other"
              ]
            }
          },
          {
            id: "q_electronics_purchase_date",
            question: "On what date was the product purchased or delivered?",
            type: "date",
            importance: "CRITICAL",
            legalRelevance: "Establishes statutory warranty window and Section 69 limitation period."
          }
        ]
      };

    default: // General Consumer Dispute
      return {
        missingFacts: [
          "Date of transaction, agreement, or service engagement",
          "Disputed consideration amount",
          "Details of written communication sent to opposite party",
          "Exact remedy sought under Consumer Protection Act, 2019"
        ],
        evidence: [
          "Tax Invoice, Contract, or Receipt",
          "Written complaint email or notice to opposite party",
          "Photographs or documentary proof of deficiency",
          "Opposite party written response or proof of refusal"
        ],
        fallbackQuestions: [
          {
            id: "q_general_remedy_sought",
            question: "What primary resolution are you seeking for this dispute?",
            type: "single_choice",
            options: [
              "Full refund of money paid along with interest",
              "Replacement with new, defect-free product or service",
              "Immediate repair / rectification free of cost",
              "Compensation for financial loss and mental harassment",
              "Waiver of unfair / unilateral charges",
              "Other",
              "Not sure"
            ],
            allowOther: true,
            importance: "CRITICAL",
            legalRelevance: "Frames the statutory prayer for relief under Section 39 CPA 2019."
          },
          {
            id: "q_general_written_notice",
            question: "Have you sent a formal written complaint or legal notice to the opposite party?",
            type: "single_choice",
            options: [
              "Yes, sent formal email with acknowledged delivery",
              "Yes, physical letter / registered legal notice sent",
              "Only verbal phone conversations with customer care",
              "Have not communicated in writing yet",
              "Other"
            ],
            allowOther: true,
            importance: "HIGH",
            legalRelevance: "Proves that opposite party was afforded reasonable opportunity to rectify before legal escalation."
          },
          {
            id: "q_general_transaction_date",
            question: "On what date did this transaction, purchase, or service occur?",
            type: "date",
            importance: "CRITICAL",
            legalRelevance: "Establishes the 2-year limitation period from cause of action under Section 69 CPA 2019."
          },
          {
            id: "q_general_disputed_amount",
            question: "What is the total disputed consideration or amount paid?",
            type: "number",
            unit: "₹",
            importance: "HIGH",
            legalRelevance: "Establishes the pecuniary jurisdiction of the District Commission under Section 34 CPA 2019."
          }
        ]
      };
  }
}

/**
 * Fallback rule-based extractor when AI is unavailable or fails.
 * Guarantees zero downtime, never invents facts, and preserves strict safety.
 */
function fallbackComplaintAnalysis({ complaint = "", product = "", company = "", amount = "", category = "" }) {
  const cleanComplaint = complaint.trim();
  const lower = cleanComplaint.toLowerCase();

  const disputeCategory = classifyDisputeCategory(cleanComplaint, product, company, category);
  const detectedContradictions = detectDateContradictions(cleanComplaint);
  const config = getCategoryConfig(disputeCategory);

  // Filter missing facts based on what is already mentioned
  const missing = [];
  for (const fact of config.missingFacts) {
    const factLower = fact.toLowerCase();
    if (factLower.includes("date") && (lower.includes("202") || lower.includes("dated") || cleanComplaint.match(/\b\d{1,2}[\s/-]+\w+[\s/-]+\d{2,4}\b/))) {
      continue;
    }
    if (factLower.includes("amount") && (amount.trim() || cleanComplaint.match(/(?:rs|inr|₹)\s*\d+/i))) {
      continue;
    }
    missing.push(fact);
  }

  return {
    disputeCategory,
    productOrService: product.trim() || "Not provided",
    companyOrSeller: company.trim() || "Not provided",
    purchaseOrServiceDate: cleanComplaint.match(/\b\d{1,2}(?:st|nd|rd|th)?[\s/-]+\w+[\s/-]+\d{2,4}\b/i)?.[0] || "Not provided",
    disputedAmount: amount.trim() || cleanComplaint.match(/(?:rs\.?|inr|₹)\s*[\d,]+/i)?.[0] || "Not provided",
    reportedProblem: cleanComplaint,
    actionsTaken: lower.includes("contacted") || lower.includes("complained") || lower.includes("emailed")
      ? ["Contacted seller / customer care"]
      : [],
    responsesReceived: lower.includes("denied") || lower.includes("rejected") || lower.includes("refused")
      ? ["Opposite party denied relief"]
      : (lower.includes("promised") ? ["Opposite party promised resolution but delayed"] : []),
    possibleContradictions: detectedContradictions,
    missingMaterialFacts: missing.length > 0 ? missing : config.missingFacts.slice(0, 3),
    potentialRelevantEvidence: config.evidence,
    userReportedFacts: [
      {
        factId: crypto.randomUUID(),
        text: cleanComplaint,
        source: "USER_INPUT",
        addedAt: new Date()
      }
    ],
    analyzedAt: new Date()
  };
}

/**
 * Analyzes an initial consumer complaint under CPA 2019 principles.
 * Extracts structured facts without inventing missing information.
 * 
 * @param {object} params
 * @param {string} params.complaint
 * @param {string} [params.product]
 * @param {string} [params.company]
 * @param {string} [params.amount]
 * @param {string} [params.category]
 * @returns {Promise<object>} Structured analysis object
 */
export async function analyzeComplaint({ complaint, product = "", company = "", amount = "", category = "" }) {
  if (!complaint || typeof complaint !== "string" || !complaint.trim()) {
    throw new Error("Complaint text is required for analysis.");
  }

  const cleanComplaint = complaint.trim();
  const dateContradictions = detectDateContradictions(cleanComplaint);
  const inferredCategory = classifyDisputeCategory(cleanComplaint, product, company, category);

  const prompt = `
ROLE: You are the Lead Case Intake & Factual Analysis Investigator for Veriq AI, analyzing consumer disputes under the Indian Consumer Protection Act, 2019 (CPA 2019).

CRITICAL GROUNDING RULES:
1. NEVER INVENT FACTS. If information is not explicitly mentioned, label it strictly as "Not provided" or an empty array.
2. DO NOT invent invoice numbers, dates, company policies, or inspection findings.
3. Classify all user statements strictly as USER-REPORTED (unverified claims).
4. NEVER state or promise that the user will be called, phoned, or contacted offline by Veriq AI or representatives. Veriq AI is an AI investigation engine.
5. Highlight internal contradictions in dates or events without guessing which statement is true.

VALID DISPUTE CATEGORIES:
- E-Commerce & Retail
- Refunds & Delivery
- Banking & Payments
- Insurance
- Telecom & Internet
- Healthcare & Medical Services
- Real Estate & Housing
- Travel & Hotels
- Education & Coaching
- Utilities & Public Services
- Defective Electronics & Appliances
- General Consumer Dispute

INTAKE DATA:
- Initial Complaint: "${cleanComplaint}"
- User-specified Product/Service: "${product || "Not provided"}"
- User-specified Seller/Company: "${company || "Not provided"}"
- User-specified Disputed Amount: "${amount || "Not provided"}"
- Preliminary Category: "${inferredCategory}"

Analyze the complaint and return ONLY a valid JSON object matching this schema (no markdown, no code fences):
{
  "disputeCategory": "<one of the 12 VALID DISPUTE CATEGORIES listed above>",
  "productOrService": "<explicit product/service name or 'Not provided'>",
  "companyOrSeller": "<explicit company/seller/manufacturer name or 'Not provided'>",
  "purchaseOrServiceDate": "<explicit purchase/service/incident date if stated in text, else 'Not provided'>",
  "disputedAmount": "<explicit amount if stated, else 'Not provided'>",
  "reportedProblem": "<concise factual summary of the user's grievance>",
  "actionsTaken": [
    "<action taken by user, e.g. 'Sent written notice via email'> (empty array if none stated)"
  ],
  "responsesReceived": [
    "<response received from company, e.g. 'Denied refund citing 7-day policy'> (empty array if none stated)"
  ],
  "possibleContradictions": [
    "<any contradiction found in the story, e.g. dates or conflicting statements>"
  ],
  "missingMaterialFacts": [
    "<material fact needed under CPA 2019 for this specific category that is currently missing, max 4>"
  ],
  "potentialRelevantEvidence": [
    "<documentary evidence relevant to this category, e.g. 'Bank Statement', 'Hospital Discharge Summary', 'Tax Invoice'>"
  ],
  "extractedFacts": [
    "<concise individual user-reported factual claim 1>",
    "<concise individual user-reported factual claim 2>"
  ]
}
`;

  try {
    const result = await generateContentWithRetry(prompt);
    const rawText = result.response.text();
    const parsed = safeParseJSON(rawText);

    if (!parsed || typeof parsed !== "object") {
      throw new Error("Failed to parse Gemini analysis output.");
    }

    const combinedContradictions = Array.from(
      new Set([
        ...dateContradictions,
        ...(Array.isArray(parsed.possibleContradictions) ? parsed.possibleContradictions : [])
      ])
    );

    const factsList = Array.isArray(parsed.extractedFacts) && parsed.extractedFacts.length > 0
      ? parsed.extractedFacts
      : [cleanComplaint];

    const userReportedFacts = factsList.map((factText) => ({
      factId: crypto.randomUUID(),
      text: factText,
      source: "USER_INPUT",
      addedAt: new Date()
    }));

    const resolvedCategory = CONSUMER_DISPUTE_CATEGORIES.includes(parsed.disputeCategory)
      ? parsed.disputeCategory
      : inferredCategory;

    return {
      disputeCategory: resolvedCategory,
      productOrService: (parsed.productOrService && parsed.productOrService !== "Not provided")
        ? parsed.productOrService
        : (product.trim() || "Not provided"),
      companyOrSeller: (parsed.companyOrSeller && parsed.companyOrSeller !== "Not provided")
        ? parsed.companyOrSeller
        : (company.trim() || "Not provided"),
      purchaseOrServiceDate: parsed.purchaseOrServiceDate || "Not provided",
      disputedAmount: (parsed.disputedAmount && parsed.disputedAmount !== "Not provided")
        ? parsed.disputedAmount
        : (amount.trim() || "Not provided"),
      reportedProblem: parsed.reportedProblem || cleanComplaint,
      actionsTaken: Array.isArray(parsed.actionsTaken) ? parsed.actionsTaken : [],
      responsesReceived: Array.isArray(parsed.responsesReceived) ? parsed.responsesReceived : [],
      possibleContradictions: combinedContradictions,
      missingMaterialFacts: Array.isArray(parsed.missingMaterialFacts) && parsed.missingMaterialFacts.length > 0
        ? parsed.missingMaterialFacts
        : getCategoryConfig(resolvedCategory).missingFacts.slice(0, 3),
      potentialRelevantEvidence: Array.isArray(parsed.potentialRelevantEvidence) && parsed.potentialRelevantEvidence.length > 0
        ? parsed.potentialRelevantEvidence
        : getCategoryConfig(resolvedCategory).evidence,
      userReportedFacts,
      analyzedAt: new Date()
    };
  } catch (err) {
    console.warn("⚠️ analyzeComplaint AI error, activating safe fallback:", err.message);
    return fallbackComplaintAnalysis({ complaint: cleanComplaint, product, company, amount, category });
  }
}

/**
 * Generates dynamic follow-up clarification questions tailored to the category and complaint.
 * Uses structured answer controls: radio buttons, checkboxes, date pickers, numeric inputs, text areas.
 * Avoids asking questions already answered and prevents infinite question loops.
 * 
 * @param {object} params
 * @param {object} params.analysis Structured analysis object
 * @param {object} [params.intake] Original intake metadata
 * @param {Array} [params.clarificationHistory] Previous Q&A
 * @param {Array} [params.userReportedFacts] All facts recorded so far
 * @param {number} [params.roundNumber] Current question round (1-indexed)
 * @returns {Promise<{ questions: Array, isComplete: boolean, round: number, message?: string }>}
 */
export async function generateFollowUpQuestions({
  analysis = {},
  intake = {},
  clarificationHistory = [],
  userReportedFacts = [],
  roundNumber = 1
}) {
  const safeAnalysis = analysis || {};
  const safeIntake = intake || {};

  // Anti-loop hard limit: stop questioning once max rounds reached
  if (roundNumber > MAX_CLARIFICATION_ROUNDS) {
    return {
      questions: [],
      isComplete: true,
      round: roundNumber,
      message: "Maximum clarification rounds reached. Investigation moves to evidence gathering."
    };
  }

  const category = safeAnalysis.disputeCategory || classifyDisputeCategory(
    safeIntake.complaint || "",
    safeIntake.product || "",
    safeIntake.company || "",
    safeIntake.category || ""
  );

  const answeredQuestionTexts = (clarificationHistory || []).map((h) => (h.question || "").toLowerCase().trim());
  const answeredQuestionIds = new Set((clarificationHistory || []).map((h) => h.questionId));
  const knownFacts = (userReportedFacts || []).map((f) => f.text).join("\n- ");

  const missingFacts = Array.isArray(safeAnalysis.missingMaterialFacts) ? safeAnalysis.missingMaterialFacts : [];
  const contradictions = Array.isArray(safeAnalysis.possibleContradictions) ? safeAnalysis.possibleContradictions : [];

  // If subsequent round and all material facts and contradictions are settled
  if (roundNumber > 1 && missingFacts.length === 0 && contradictions.length === 0) {
    return {
      questions: [],
      isComplete: true,
      round: roundNumber,
      message: "Sufficient clarification collected for this stage. No further questions required."
    };
  }

  const categoryConfig = getCategoryConfig(category);

  const prompt = `
ROLE: You are the Lead Dynamic Case Investigator for Veriq AI (Indian Consumer Protection Act, 2019).
OBJECTIVE: Generate 2 to 4 HIGH-PRIORITY clarification questions directly tailored to this ${category} complaint.

CRITICAL INSTRUCTIONS ON ANSWER CONTROLS:
Every question MUST specify an appropriate structured control "type":
- "single_choice": for single-choice answers (rendered as radio buttons). MUST provide "options" array. Include "Other" and "Not sure" where appropriate.
- "multiple_choice": for multiple selections (rendered as checkboxes). MUST provide "options" array.
- "date": for dates (rendered as a date picker).
- "number": for amounts, quantities, or days (rendered as numeric input). May include "unit" (e.g. "₹").
- "text": for short specific text answers (e.g. docket number, PNR, IFSC).
- "textarea": for unrestricted narrative explanations.

CONDITIONAL FOLLOW-UPS:
If an answer option makes a subsequent detail relevant, include "conditionalFollowUp":
{
  "showIfOptions": ["Option A", "Option B"],
  "question": "<concise conditional follow-up question>",
  "type": "<text | single_choice>",
  "options": ["Sub-option 1", "Sub-option 2"] (if single_choice)
}

STRICT CONSTRAINTS:
1. DO NOT REPEAT QUESTIONS. The following questions have ALREADY BEEN ANSWERED:
${clarificationHistory.length > 0 ? clarificationHistory.map((h, i) => `[Already Answered Q${i + 1}]: "${h.question}" -> Answer: "${typeof h.answer === "object" ? JSON.stringify(h.answer) : h.answer}"`).join("\n") : "None yet."}

2. DO NOT ASK for information ALREADY PROVIDED in intake or facts:
- Product/Service: ${safeAnalysis.productOrService || safeIntake.product || "Not provided"}
- Seller/Company: ${safeAnalysis.companyOrSeller || safeIntake.company || "Not provided"}
- Disputed Amount: ${safeAnalysis.disputedAmount || safeIntake.amount || "Not provided"}
- Stated Date: ${safeAnalysis.purchaseOrServiceDate || "Not provided"}
- Already Recorded Facts:
- ${knownFacts || "None recorded yet"}

3. NEVER state or imply that the user will be phoned, called, or contacted offline by Veriq AI or any representative.
4. TAILOR QUESTIONS TO ${category.toUpperCase()}. Do NOT ask about physical hardware repairs for banking, insurance, telecom, travel, or housing disputes!
5. IF CONTRADICTIONS EXIST, GENERATE A CLARIFYING QUESTION TO RESOLVE IT:
${contradictions.length > 0 ? `Identified Contradictions:\n- ${contradictions.join("\n- ")}` : "None identified."}

Generate 2 to 4 questions for Round ${roundNumber}.
Return ONLY a valid JSON array of objects (no markdown, no code fences):
[
  {
    "id": "q_${roundNumber}_<unique_slug>",
    "question": "<Concise, plain English question>",
    "type": "<single_choice | multiple_choice | date | number | text | textarea>",
    "options": ["<Option 1>", "<Option 2>", "Other", "Not sure"],
    "allowOther": true,
    "unit": "<₹ or null>",
    "conditionalFollowUp": null,
    "importance": "<CRITICAL | HIGH | MEDIUM>",
    "legalRelevance": "<1-sentence legal reason under CPA 2019 why this fact matters>"
  }
]
`;

  try {
    const result = await generateContentWithRetry(prompt);
    const rawText = result.response.text();
    const parsed = safeParseJSON(rawText);

    let candidateQuestions = [];
    if (Array.isArray(parsed)) {
      candidateQuestions = parsed;
    } else if (parsed && Array.isArray(parsed.questions)) {
      candidateQuestions = parsed.questions;
    } else if (parsed && typeof parsed === "object") {
      const arrayVal = Object.values(parsed).find((v) => Array.isArray(v));
      if (arrayVal) candidateQuestions = arrayVal;
    }

    // Clean and validate candidate questions
    const validatedQuestions = [];
    for (const q of candidateQuestions) {
      if (!q || typeof q !== "object") continue;
      const qText = (q.question || "").trim();
      if (!qText) continue;

      // Filter out misleading questions promising offline phone calls
      const qTextLower = qText.toLowerCase();
      if (qTextLower.includes("will be called") || qTextLower.includes("call you again") || qTextLower.includes("our representative will call")) {
        continue;
      }

      // Check against already answered questions
      const isAlreadyAnswered = answeredQuestionIds.has(q.id) || answeredQuestionTexts.some((prev) => {
        return prev === qTextLower || (prev.length > 25 && qTextLower === prev);
      });
      if (isAlreadyAnswered) continue;

      // Ensure valid control type
      let controlType = q.type;
      if (!["single_choice", "multiple_choice", "date", "number", "text", "textarea"].includes(controlType)) {
        if (qTextLower.includes("date") || qTextLower.includes("when did") || qTextLower.includes("what day")) {
          controlType = "date";
        } else if (qTextLower.includes("amount") || qTextLower.includes("how much") || qTextLower.includes("cost") || qTextLower.includes("fee")) {
          controlType = "number";
        } else if (Array.isArray(q.options) && q.options.length > 0) {
          controlType = "single_choice";
        } else {
          controlType = "text";
        }
      }

      // Ensure options for single_choice or multiple_choice
      let options = Array.isArray(q.options) ? q.options.filter(Boolean) : [];
      if ((controlType === "single_choice" || controlType === "multiple_choice") && options.length === 0) {
        options = ["Yes", "No", "Not sure", "Other"];
      }
      if (controlType === "single_choice" && !options.some((o) => o.toLowerCase().includes("other"))) {
        options.push("Other");
      }
      if (controlType === "single_choice" && !options.some((o) => o.toLowerCase().includes("not sure"))) {
        options.push("Not sure");
      }

      validatedQuestions.push({
        id: q.id || `q_${roundNumber}_${validatedQuestions.length + 1}_${Date.now()}`,
        question: qText,
        type: controlType,
        options,
        allowOther: q.allowOther ?? true,
        placeholder: q.placeholder || "",
        min: q.min ?? null,
        max: q.max ?? null,
        unit: q.unit || (controlType === "number" ? "₹" : ""),
        conditionalFollowUp: q.conditionalFollowUp ? {
          ...q.conditionalFollowUp,
          id: q.conditionalFollowUp.id || `${q.id || 'q'}_followup`,
          parentQuestionId: q.conditionalFollowUp.parentQuestionId || q.id
        } : null,
        importance: q.importance || "HIGH",
        legalRelevance: q.legalRelevance || "Clarifies material fact for consumer claim assessment under CPA 2019.",
        round: roundNumber,
        status: "PENDING",
        answer: null,
        answeredAt: null
      });
    }

    // Prepend contradiction question if chronological discrepancy detected and not yet addressed
    if (contradictions.length > 0 && !validatedQuestions.some((q) => q.question.toLowerCase().includes("discrepancy") || q.question.toLowerCase().includes("timeline"))) {
      validatedQuestions.unshift({
        id: `q_contradiction_${roundNumber}_${Date.now()}`,
        question: `Could you clarify the exact sequence of dates? (${contradictions[0]})`,
        type: "text",
        options: [],
        allowOther: false,
        placeholder: "Clarify which date occurred first...",
        importance: "CRITICAL",
        legalRelevance: "Essential to establish limitation period and cause of action under Section 69 CPA 2019.",
        round: roundNumber,
        status: "PENDING",
        answer: null,
        answeredAt: null
      });
    }

    // If candidate questions were empty or filtered out, do NOT prematurely complete if material facts or contradictions remain
    if (validatedQuestions.length === 0) {
      const hasMissingFacts = missingFacts.length > 0;
      const noAnswersYet = clarificationHistory.length === 0;
      if (hasMissingFacts || noAnswersYet || contradictions.length > 0 || roundNumber === 1) {
        console.warn(`⚠️ AI returned no valid questions for Round ${roundNumber}, activating category-aware fallback generator.`);
        return generateCategoryFallbackQuestions(category, roundNumber, answeredQuestionTexts, answeredQuestionIds, analysis, intake, contradictions);
      }
    }

    return {
      questions: validatedQuestions.slice(0, 4),
      isComplete: validatedQuestions.length === 0,
      round: roundNumber,
      message: validatedQuestions.length === 0 ? "All essential facts recorded. Clarification complete." : undefined
    };
  } catch (err) {
    console.warn("⚠️ generateFollowUpQuestions AI error, using category-aware fallback questions:", err.message);
    return generateCategoryFallbackQuestions(category, roundNumber, answeredQuestionTexts, answeredQuestionIds, analysis, intake, contradictions);
  }
}

/**
 * Generates category-aware structured fallback questions when AI is unavailable or produces empty results
 */
function generateCategoryFallbackQuestions(category, roundNumber, answeredQuestionTexts, answeredQuestionIds, analysis, intake, contradictions) {
  const config = getCategoryConfig(category);
  const candidateFallbacks = [...config.fallbackQuestions];

  // If contradictions exist, prepend contradiction question
  if (contradictions.length > 0) {
    candidateFallbacks.unshift({
      id: `q_contradiction_${roundNumber}`,
      question: `Could you clarify the exact sequence of dates? (${contradictions[0]})`,
      type: "text",
      options: [],
      allowOther: false,
      placeholder: "Clarify which date occurred first...",
      importance: "CRITICAL",
      legalRelevance: "Essential to establish limitation period under Section 69 CPA 2019.",
      round: roundNumber,
      status: "PENDING",
      answer: null,
      answeredAt: null
    });
  }

  // Filter out any fallback questions whose facts are already known or answered
  const filtered = candidateFallbacks.filter((q) => {
    if (answeredQuestionIds.has(q.id)) return false;
    const qLower = q.question.toLowerCase();
    if (answeredQuestionTexts.some((prev) => prev.includes(qLower) || qLower.includes(prev))) {
      return false;
    }
    // If date is already known, do not ask date
    if (q.type === "date" && analysis?.purchaseOrServiceDate && analysis.purchaseOrServiceDate !== "Not provided") {
      return false;
    }
    // If amount is already known, do not ask amount
    if (q.type === "number" && (analysis?.disputedAmount && analysis.disputedAmount !== "Not provided" || intake?.amount)) {
      return false;
    }
    return true;
  });

  const finalQuestions = filtered.slice(0, 4).map((q, idx) => ({
    ...q,
    id: q.id || `q_fallback_${roundNumber}_${idx + 1}`,
    round: roundNumber,
    status: "PENDING",
    answer: null,
    answeredAt: null
  }));

  return {
    questions: finalQuestions,
    isComplete: finalQuestions.length === 0,
    round: roundNumber,
    message: finalQuestions.length === 0 ? "No additional clarification questions required." : undefined
  };
}
