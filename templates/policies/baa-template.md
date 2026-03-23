# Business Associate Agreement

**This Business Associate Agreement ("Agreement")** is entered into as of {EFFECTIVE_DATE} by and between:

**Covered Entity:** {COVERED_ENTITY_NAME}
Address: {COVERED_ENTITY_ADDRESS}
Contact: {COVERED_ENTITY_CONTACT}, {COVERED_ENTITY_CONTACT_TITLE}

**Business Associate:** {BUSINESS_ASSOCIATE_NAME}
Address: {BUSINESS_ASSOCIATE_ADDRESS}
Contact: {BUSINESS_ASSOCIATE_CONTACT}, {BUSINESS_ASSOCIATE_CONTACT_TITLE}

(each a "Party" and collectively the "Parties")

## Recitals

WHEREAS, Covered Entity and Business Associate have entered into or intend to enter into an arrangement ("Underlying Agreement") under which Business Associate may create, receive, maintain, or transmit Protected Health Information ("PHI") on behalf of Covered Entity;

WHEREAS, the Parties intend to comply with the requirements of the Health Insurance Portability and Accountability Act of 1996 ("HIPAA"), the Health Information Technology for Economic and Clinical Health Act ("HITECH"), and their implementing regulations (collectively, the "HIPAA Rules");

NOW, THEREFORE, the Parties agree as follows:

## 1. Definitions

Terms used but not defined in this Agreement have the same meaning as in the HIPAA Rules, including: Breach, Business Associate, Covered Entity, Designated Record Set, Individual, Protected Health Information (PHI), Required By Law, Secretary, Security Incident, Subcontractor, and Unsecured Protected Health Information.

## 2. Permitted Uses and Disclosures

### 2.1 Permitted Uses

Business Associate may use or disclose PHI only as necessary to:

(a) Perform services described in the Underlying Agreement.
(b) Carry out its own management and administration, provided disclosures are Required By Law or Business Associate obtains reasonable assurances from the recipient that PHI will be held confidentially.
(c) Provide Data Aggregation services to Covered Entity, if applicable.

### 2.2 Prohibited Uses

Business Associate shall not:

(a) Use or disclose PHI in a manner not permitted by this Agreement or the HIPAA Rules.
(b) Use or disclose PHI for marketing purposes without prior written authorization.
(c) Sell PHI.
(d) Use or disclose PHI in a manner that would violate Subpart E of 45 CFR Part 164 if done by the Covered Entity, except as permitted under Sections 2.1(b) and 2.1(c).

## 3. Safeguards

Business Associate shall:

(a) Implement administrative, physical, and technical safeguards that reasonably and appropriately protect the confidentiality, integrity, and availability of electronic PHI, as required by the Security Rule.
(b) Ensure that any agent or subcontractor to whom Business Associate provides PHI agrees to the same restrictions and conditions that apply to Business Associate under this Agreement.
(c) Encrypt all electronic PHI at rest (AES-256 minimum) and in transit (TLS 1.2 minimum).
(d) Implement access controls ensuring only authorized personnel access PHI.
(e) Maintain audit logs of all access to PHI for a minimum of {AUDIT_LOG_RETENTION_YEARS} years.
(f) Conduct an annual risk assessment of systems that process PHI and provide a summary to Covered Entity upon request.

## 4. Reporting Obligations

### 4.1 Breach Notification

Business Associate shall report to Covered Entity any Breach of Unsecured PHI without unreasonable delay and in no event later than {BREACH_NOTIFICATION_DAYS} days (maximum 30 calendar days) after discovery. The report must include:

(a) Identification of each individual whose PHI was or is reasonably believed to have been affected.
(b) A description of the nature of the Breach, including the types of PHI involved.
(c) Steps individuals should take to protect themselves.
(d) A description of what Business Associate is doing to investigate, mitigate harm, and prevent future Breaches.

### 4.2 Security Incidents

Business Associate shall report any Security Incident of which it becomes aware to Covered Entity within {SECURITY_INCIDENT_NOTIFICATION_DAYS} business days. The Parties acknowledge that unsuccessful Security Incidents (e.g., pings, port scans, unsuccessful login attempts) occur routinely and agree that no additional notice is required for such unsuccessful attempts.

## 5. Subcontractors

(a) Business Associate shall ensure that any subcontractor that creates, receives, maintains, or transmits PHI on behalf of Business Associate agrees in writing to the same restrictions, conditions, and requirements that apply to Business Associate under this Agreement.
(b) Business Associate shall maintain a current list of subcontractors with access to PHI and provide it to Covered Entity upon request.
(c) Business Associate is responsible for the acts and omissions of its subcontractors as if they were Business Associate's own acts and omissions.

## 6. Individual Rights

Business Associate shall:

(a) Make PHI in a Designated Record Set available to Covered Entity or, at Covered Entity's direction, to an Individual, within {ACCESS_REQUEST_DAYS} days (maximum 30 days) to satisfy Covered Entity's obligations under 45 CFR 164.524.
(b) Make PHI available for amendment and incorporate amendments directed by Covered Entity in accordance with 45 CFR 164.526.
(c) Maintain and make available information required to provide an accounting of disclosures in accordance with 45 CFR 164.528.

## 7. Covered Entity Obligations

Covered Entity shall:

(a) Notify Business Associate of any limitations in its Notice of Privacy Practices that may affect Business Associate's use or disclosure of PHI.
(b) Notify Business Associate of any restrictions on the use or disclosure of PHI agreed to by Covered Entity per 45 CFR 164.522.
(c) Not request Business Associate to use or disclose PHI in any manner that would violate the HIPAA Rules.

## 8. Audit and Monitoring

(a) Covered Entity, or its designated auditor, has the right to audit Business Associate's compliance with this Agreement upon {AUDIT_NOTICE_DAYS} days' written notice, no more than {AUDIT_FREQUENCY} per calendar year.
(b) Business Associate shall make its internal practices, books, and records relating to the use and disclosure of PHI available to the Secretary of HHS for purposes of determining compliance with the HIPAA Rules.

## 9. Term and Termination

### 9.1 Term

This Agreement is effective as of {EFFECTIVE_DATE} and continues until the Underlying Agreement terminates or until terminated as provided herein.

### 9.2 Termination for Breach

Either Party may terminate this Agreement if the other Party materially breaches this Agreement and fails to cure the breach within {CURE_PERIOD_DAYS} days (maximum 30 days) of written notice. If cure is not feasible, the non-breaching Party may terminate immediately.

### 9.3 Effect of Termination — Return or Destruction of PHI

Upon termination:

(a) Business Associate shall return or destroy all PHI received from or created on behalf of Covered Entity within {PHI_RETURN_DAYS} days of termination.
(b) If return or destruction is not feasible, Business Associate shall extend the protections of this Agreement to the retained PHI and limit further use and disclosure to the purposes that make return or destruction infeasible.
(c) Business Associate shall certify in writing to Covered Entity that PHI has been returned or destroyed, specifying the method of destruction.

## 10. Indemnification

Business Associate shall indemnify and hold harmless Covered Entity from any costs, liabilities, penalties, or damages arising from Business Associate's breach of this Agreement or the HIPAA Rules, including but not limited to HHS penalties, state attorney general penalties, legal fees, notification costs, and credit monitoring costs.

## 11. Miscellaneous

(a) **Amendment.** This Agreement may be amended only in writing signed by both Parties. The Parties agree to amend this Agreement as necessary to comply with changes to the HIPAA Rules.
(b) **Governing Law.** This Agreement shall be governed by federal HIPAA law and the laws of the State of {GOVERNING_STATE}.
(c) **Survival.** The obligations of Business Associate under Section 9.3 shall survive termination.
(d) **Entire Agreement.** This Agreement constitutes the entire agreement between the Parties with respect to its subject matter and supersedes all prior agreements.

## Signatures

**Covered Entity: {COVERED_ENTITY_NAME}**

Signature: ___________________________
Name: {COVERED_ENTITY_SIGNATORY}
Title: {COVERED_ENTITY_SIGNATORY_TITLE}
Date: _______________

**Business Associate: {BUSINESS_ASSOCIATE_NAME}**

Signature: ___________________________
Name: {BUSINESS_ASSOCIATE_SIGNATORY}
Title: {BUSINESS_ASSOCIATE_SIGNATORY_TITLE}
Date: _______________
