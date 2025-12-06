# 📚 BoothBrain Documentation Index

**Last Updated:** 2025-12-06
**Purpose:** Single source of truth for all project documentation

---

## 🎯 Quick Navigation

### New to the project?
→ Start with [README.md](./README.md) for overview
→ Then [BUILD_CHEATSHEET.md](./BUILD_CHEATSHEET.md) for build commands

### Ready to launch?
→ [FINAL_CHECKLIST.md](./FINAL_CHECKLIST.md) - Complete launch checklist

### Need to build?
→ [BUILD_CHEATSHEET.md](./BUILD_CHEATSHEET.md) - All build commands
→ [EXPO_BUILD_GUIDE.md](./EXPO_BUILD_GUIDE.md) - Detailed build guide

### Working with payments?
→ [ANDROID_PAYMENT_STRATEGY.md](./ANDROID_PAYMENT_STRATEGY.md) - Android IAP strategy
→ [REVENUECAT_WEBHOOK_DEPLOYMENT.md](./REVENUECAT_WEBHOOK_DEPLOYMENT.md) - Webhook setup
→ [archive/APPLE_IAP_IMPLEMENTATION_PLAN.md](./archive/APPLE_IAP_IMPLEMENTATION_PLAN.md) - Full Apple IAP guide (completed)

---

## 📖 Documentation Status Guide

| Symbol | Meaning |
|--------|---------|
| 🟢 **ACTIVE** | Current, regularly updated, use this! |
| 📘 **REFERENCE** | Stable content, doesn't change often |
| ✅ **COMPLETE** | Task finished, kept for reference |
| 📦 **ARCHIVED** | Historical, replaced by newer docs |

---

## 🟢 ACTIVE DOCUMENTS (Use These!)

### Development & Builds
| Document | Status | Purpose | Lines | Last Updated |
|----------|--------|---------|-------|--------------|
| [BUILD_CHEATSHEET.md](./BUILD_CHEATSHEET.md) | 🟢 **ACTIVE** | Quick reference for all build commands | 368 | 2025-12-05 |
| [EXPO_BUILD_GUIDE.md](./EXPO_BUILD_GUIDE.md) | 🟢 **ACTIVE** | Detailed EAS build instructions | 420 | 2025-11-15 |

### Launch & Deployment
| Document | Status | Purpose | Lines | Last Updated |
|----------|--------|---------|-------|--------------|
| [FINAL_CHECKLIST.md](./FINAL_CHECKLIST.md) | 🟢 **ACTIVE** | Complete launch checklist with timeline | 442 | 2025-12-05 |
| [PRE_LAUNCH_CHECKLIST.md](./PRE_LAUNCH_CHECKLIST.md) | 🟢 **ACTIVE** | Pre-submission tasks and requirements | 403 | 2025-12-05 |

### Payment Integration
| Document | Status | Purpose | Lines | Last Updated |
|----------|--------|---------|-------|--------------|
| [ANDROID_PAYMENT_STRATEGY.md](./ANDROID_PAYMENT_STRATEGY.md) | 🟢 **ACTIVE** | Android Google Play billing strategy | 476 | 2025-12-04 |
| [REVENUECAT_WEBHOOK_DEPLOYMENT.md](./REVENUECAT_WEBHOOK_DEPLOYMENT.md) | 🟢 **ACTIVE** | RevenueCat webhook deployment guide | 252 | 2025-12-04 |

---

## 📘 REFERENCE DOCUMENTS (Stable Content)

### Legal & Compliance
| Document | Status | Purpose | Lines | Last Updated |
|----------|--------|---------|-------|--------------|
| [PRIVACY_POLICY.md](./PRIVACY_POLICY.md) | 📘 **REFERENCE** | App privacy policy (required by App Store) | 181 | 2025-11-15 |
| [TERMS_OF_SERVICE.md](./TERMS_OF_SERVICE.md) | 📘 **REFERENCE** | User terms of service | 203 | 2025-11-15 |

### App Store Submission
| Document | Status | Purpose | Lines | Last Updated |
|----------|--------|---------|-------|--------------|
| [APP_STORE_LISTING.md](./APP_STORE_LISTING.md) | 📘 **REFERENCE** | App descriptions, keywords, categories | 261 | 2025-11-15 |
| [SUPPORT_INFO.md](./SUPPORT_INFO.md) | 📘 **REFERENCE** | Support setup, FAQ, email templates | 320 | 2025-11-15 |

### Project Overview
| Document | Status | Purpose | Lines | Last Updated |
|----------|--------|---------|-------|--------------|
| [README.md](./README.md) | 📘 **REFERENCE** | Documentation overview and quick start | 143 | 2025-11-15 |

---

## 📦 ARCHIVED DOCUMENTS (Historical Reference)

### Completed Implementation Guides
| Document | Status | Purpose | Lines | Why Archived |
|----------|--------|---------|-------|--------------|
| [archive/APPLE_IAP_IMPLEMENTATION_PLAN.md](./archive/APPLE_IAP_IMPLEMENTATION_PLAN.md) | ✅ **COMPLETE** | Complete Apple IAP implementation guide | 2251 | Implementation complete (2025-12-04) |
| [archive/APPLE_IAP_FIXES_APPLIED.md](./archive/APPLE_IAP_FIXES_APPLIED.md) | ✅ **COMPLETE** | 7 critical IAP fixes documented | 327 | Fixes applied and merged |
| [archive/APPLE_IAP_TESTING_CHECKLIST.md](./archive/APPLE_IAP_TESTING_CHECKLIST.md) | ✅ **COMPLETE** | Apple IAP testing procedures | 267 | Testing completed |

### Setup & Configuration (One-Time)
| Document | Status | Purpose | Lines | Why Archived |
|----------|--------|---------|-------|--------------|
| [archive/PRE_EAS_BUILD_CHECKLIST.md](./archive/PRE_EAS_BUILD_CHECKLIST.md) | ✅ **COMPLETE** | Initial EAS build setup steps | 398 | Setup complete, use BUILD_CHEATSHEET.md now |
| [archive/EXPO_GO_TESTING_GUIDE.md](./archive/EXPO_GO_TESTING_GUIDE.md) | ✅ **COMPLETE** | Expo Go testing procedures | 342 | Testing complete, moving to TestFlight |
| [archive/UPDATE_WEBSITE_URLS.md](./archive/UPDATE_WEBSITE_URLS.md) | ✅ **COMPLETE** | Website URL update instructions | 88 | URLs updated, website deployed |
| [archive/SCREENSHOT_TEST_DATA.md](./archive/SCREENSHOT_TEST_DATA.md) | ✅ **COMPLETE** | Test data for app screenshots | 474 | Screenshots created |

---

## 🔄 Documentation Maintenance

### When to Update This Index

Update `INDEX.md` when you:
- ✅ Create a new document
- ✅ Archive an old document
- ✅ Change a document's purpose or status
- ✅ Merge or consolidate documents

### When to Archive a Document

Archive when:
- ✅ Implementation/task is complete (e.g., IAP implementation done)
- ✅ One-time setup is finished (e.g., EAS build configured)
- ✅ Document superseded by newer version
- ✅ Content is purely historical

**Don't archive:**
- ❌ Legal documents (Privacy Policy, Terms of Service)
- ❌ App Store content (descriptions, keywords)
- ❌ Active development guides
- ❌ Build/deployment checklists still in use

### Cleanup Commands

```bash
# List docs by last modified date
find docs -name "*.md" -type f -exec stat -c "%y %n" {} \; | sort -r

# Count lines in all docs
wc -l docs/*.md | sort -n

# See which docs haven't changed in 30+ days
find docs -name "*.md" -mtime +30
```

---

## 📊 Documentation Statistics

**Total Documents:** 18 files
**Active/Reference:** 11 files (2,368 lines)
**Archived:** 7 files (4,154 lines)

### By Category:
- **Development/Build:** 2 active docs
- **Launch/Deployment:** 2 active docs
- **Payments:** 2 active docs
- **Legal/Compliance:** 2 reference docs
- **App Store:** 2 reference docs
- **Archived/Complete:** 7 docs

---

## 🎯 Common Scenarios

### "I need to build the app for TestFlight"
1. Open [BUILD_CHEATSHEET.md](./BUILD_CHEATSHEET.md)
2. Run: `npm run build:prod:ios`
3. Submit: `npm run submit:ios`

### "I'm ready to launch to App Store"
1. Open [FINAL_CHECKLIST.md](./FINAL_CHECKLIST.md)
2. Follow Day 1-5 timeline
3. Reference [APP_STORE_LISTING.md](./APP_STORE_LISTING.md) for descriptions

### "I need to deploy the RevenueCat webhook"
1. Open [REVENUECAT_WEBHOOK_DEPLOYMENT.md](./REVENUECAT_WEBHOOK_DEPLOYMENT.md)
2. Follow deployment steps
3. Test webhook delivery

### "How was Apple IAP implemented?"
1. See [archive/APPLE_IAP_IMPLEMENTATION_PLAN.md](./archive/APPLE_IAP_IMPLEMENTATION_PLAN.md) (2251 lines)
2. For fixes applied: [archive/APPLE_IAP_FIXES_APPLIED.md](./archive/APPLE_IAP_FIXES_APPLIED.md)

### "What launch tasks are left?"
1. Open [FINAL_CHECKLIST.md](./FINAL_CHECKLIST.md)
2. Check Critical → Important → Nice-to-Have sections

---

## 🔍 Related Project Files

- **Project Instructions:** `/CLAUDE.md` (main session log, living document)
- **Build Configuration:** `/eas.json`, `/app.config.ts`
- **Website Files:** `/website/` (deployed to GitHub Pages)
- **Database Migrations:** `/supabase/migrations/`
- **Edge Functions:** `/supabase/functions/`

---

## 💡 Tips

1. **Start here:** Always check this INDEX first before creating new docs
2. **Keep it current:** Update this file when docs change
3. **Archive aggressively:** Don't let completed docs clutter active list
4. **Use search:** Ctrl+F this file to find what you need
5. **Check timestamps:** "Last Updated" shows doc freshness

---

**Questions?** Check the main [README.md](./README.md) or [CLAUDE.md](../CLAUDE.md)
