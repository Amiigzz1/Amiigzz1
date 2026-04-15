# Majlis — Compliance

This document is a checklist, not legal advice. Each item below must be
reviewed with qualified counsel in the target jurisdiction before public
launch.

## 1. PDPL (Saudi Arabia) — Personal Data Protection Law

- **Data localization.** Personal data of Saudi residents is stored in AWS
  `me-south-1` (Bahrain). A secondary replica in `me-central-1` (UAE) is
  used for DR; transfers between the two are encrypted and logged.
- **Legal basis.** We rely on *consent* for account creation and *contract
  performance* for voice-room hosting. Consent is captured on the signup
  screen with a standalone checkbox; no pre-ticked boxes.
- **Data subject rights.** Users may request access, correction, or deletion
  via `privacy@majlis.app`. SLA: 30 days.
- **DPO.** A named Data Protection Officer is appointed before launch in KSA
  (role published in-app and on the marketing site).
- **Breach notification.** In the event of a personal data breach, the
  SDAIA/NDMO is notified within 72 hours and affected users without undue
  delay.
- **Processor agreements.** DPAs executed with Agora, Firebase, Tap Payments,
  Fawry, Sentry, OpenAI.

## 2. UAE VoIP

The UAE restricts *direct* VoIP (one-to-one voice calls) outside of licensed
telcos. Majlis operates **group voice rooms** (many-to-many, publicly
joinable, non-call-replacement). This is the same model WhatsApp Communities
and Clubhouse operate under in the UAE. Before public UAE launch:

- Obtain a written memo from UAE telecoms counsel classifying our service.
- Consider a TDRA pre-consultation.
- Disable any 1:1 voice feature (we have none planned) and document the
  absence prominently in the product scope.

## 3. Anti-gambling

Saudi Arabia, Kuwait, and several other markets prohibit gambling. To stay on
the right side of the line:

- Lucky-draw features use **virtual currency only** on the input side.
- Odds and prize pools are displayed *before* entry.
- Prizes are virtual items or diamonds; diamonds can only be cashed out via
  the creator withdrawal flow (see §4), which is classified as **creator
  compensation**, not prize redemption.
- No slot-machine / spinner mechanics tied to real money.

## 4. KYC tiers

| Tier | Who                | Verification                                   |
|------|--------------------|------------------------------------------------|
| 0    | Any new user       | Phone + OTP                                    |
| 1    | Gift senders       | Phone + OTP (IAP spend capped at platform limits) |
| 2    | Withdrawal-eligible hosts | National ID + selfie + bank/wallet details |

Tier 2 is mandatory before any cashout. Records retained per local
anti-money-laundering rules (typically 5 years post-relationship).

## 5. Age gate

- Minimum age: **13** (COPPA-style floor; app-store requirement).
- Cashout eligibility: **18+**. Hosts confirm age during KYC.
- Birthdates are collected at signup and validated against device locale
  rules.

## 6. Logging & retention

| Data                  | Retention            | Notes                                    |
|-----------------------|----------------------|------------------------------------------|
| Auth logs             | 90 days              | IP hashed after 30 days                  |
| Chat text             | 30 days live + 90 days cold | Deletion-on-request honored          |
| Voice sampled clips   | 30 days              | Only clips flagged by moderation kept    |
| Payment records       | 7 years              | Tax & AML                                |
| Deleted-account data  | 30-day soft-delete, then purge | Backup tapes recycled ≤ 90 days |

## 7. Moderation due process

- **No automatic bans.** Every ban is reviewed by a human moderator.
- Users receive a notice with the specific rule cited (in Arabic).
- Each user may appeal once; appeals are reviewed within 48 hours by a
  different moderator.
- Community guidelines are published in-app in Arabic and English and
  versioned in `docs/community-guidelines/`.

## 8. Third-party subprocessors (provisional)

| Vendor       | Purpose            | Data region             |
|--------------|--------------------|-------------------------|
| Agora        | Voice transport    | Global edge, processor  |
| Firebase     | Auth / push        | US/EU (OTP ephemeral)   |
| AWS          | Hosting            | me-south-1, me-central-1|
| Tap Payments | GCC payments       | KSA                     |
| Fawry        | Egypt payments     | EG                      |
| OpenAI       | Moderation         | US                      |
| Sentry       | Error monitoring   | EU                      |

The subprocessor list is published in-app under *Settings → Privacy*.
