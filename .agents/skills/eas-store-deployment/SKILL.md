---
name: eas-store-deployment
description: Practical release engineering guide for Expo / React Native applications deploying to Apple App Store and Google Play Console via EAS (Expo Application Services). Covers signing, certificates, bundle identifiers, App Privacy declarations, Guideline 2.1 (demo credentials), Guideline 5.1 (data safety and account deletion), TestFlight, and Google Play track management.
license: MIT
metadata:
  author: EVGO
  version: "1.0.0"
---

# Expo EAS Store Deployment & Store Approval Guide

Complete end-to-end guide for building, signing, and submitting React Native Expo apps to the **Apple App Store** and **Google Play Console**.

## 1. EAS Configuration (`eas.json`)

Configure build profiles in the mobile app root:

```json
{
  "cli": {
    "version": ">= 15.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    },
    "preview": {
      "distribution": "internal",
      "ios": {
        "simulator": false
      }
    },
    "production": {
      "autoIncrement": true,
      "ios": {
        "image": "latest"
      },
      "android": {
        "buildType": "app-bundle"
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "team@evgo.uz",
        "ascAppId": "YOUR_APP_STORE_CONNECT_ID"
      },
      "android": {
        "serviceAccountKeyPath": "./google-play-service-account.json"
      }
    }
  }
}
```

## 2. App Store Submission Checklist & Common Pitfalls

### Guideline 2.1 — App Completeness & Review Credentials
- **The Issue**: Apple reviewers test from US/EU IP addresses and do not have Uzbek SIM cards to receive SMS OTPs.
- **The Fix**: Hardcode a dedicated review phone number & code on the backend (e.g. `+998900000000` / `777777`) and submit these credentials in the **App Review Information** section of App Store Connect.

### Guideline 5.1.1 — Data Privacy & Account Deletion
- **Mandatory**: Any app supporting account creation MUST support in-app account deletion.
- **Verification**: Ensure Settings -> Account -> "Delete Account" endpoint works and purges or anonymizes user PII.

### Guideline 5.1.5 — Location Permissions
- Include transparent strings in `ios.infoPlist`:
  - `NSLocationWhenInUseUsageDescription`: Explain direct value (e.g., *"To display nearby charging stations and navigate your route"*).

### Legal URLs
- `https://evgo.uz/privacy` (Privacy Policy)
- `https://evgo.uz/terms` (Terms of Service)
- Both MUST be live on a public domain with valid SSL before submitting the app for review.

## 3. Google Play Data Safety Requirements

1. **Location**: Precise and approximate location declared as used for "App functionality".
2. **Financial Data**: Purchase history / billing logs declared as used for "Account management / Fraud prevention".
3. **Account Deletion URL**: Link to `https://evgo.uz/privacy` or web account deletion request form.
