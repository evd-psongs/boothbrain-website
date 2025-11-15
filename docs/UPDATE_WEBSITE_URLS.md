# Update Website URLs in App

## 📝 Action Required

I've added an "About" section to your Settings screen with links to your website!

**Location:** `app/(tabs)/settings.tsx` (lines 828-861)

## ⚠️ Replace Placeholder URLs

You need to replace `YOUR_USERNAME` with your actual GitHub username in 3 places:

### File: `app/(tabs)/settings.tsx`

Find and replace these lines (around line 838, 847, 856):

```typescript
// Line ~838 - Website link
onPress={() => Linking.openURL('https://YOUR_USERNAME.github.io/boothbrain-website/')}

// Line ~847 - Privacy Policy link
onPress={() => Linking.openURL('https://YOUR_USERNAME.github.io/boothbrain-website/privacy.html')}

// Line ~856 - Terms of Service link
onPress={() => Linking.openURL('https://YOUR_USERNAME.github.io/boothbrain-website/terms.html')}
```

### Example

If your GitHub username is `songsopaul`, replace:
```typescript
'https://YOUR_USERNAME.github.io/boothbrain-website/'
```

With:
```typescript
'https://songsopaul.github.io/boothbrain-website/'
```

## 🎨 What Was Added

New "About" section in Settings with 3 buttons:
1. **Visit our website** - Opens your homepage
2. **Privacy Policy** - Opens privacy.html
3. **Terms of Service** - Opens terms.html

The section appears between "Need help?" and "Sign out" sections.

## ✅ How to Update

### Option 1: Find & Replace (Easiest)

1. Open `app/(tabs)/settings.tsx`
2. Press Ctrl+H (or Cmd+H on Mac) to find & replace
3. Find: `YOUR_USERNAME`
4. Replace with: your actual GitHub username
5. Click "Replace All" (should replace 3 instances)
6. Save file

### Option 2: Manual Edit

1. Open `app/(tabs)/settings.tsx`
2. Search for "YOUR_USERNAME" (appears 3 times)
3. Replace each with your GitHub username
4. Save file

## 🧪 Test It

After updating, test in your app:
1. Run the app (Expo Go or build)
2. Go to Settings
3. Scroll to "About" section (between Support and Sign out)
4. Tap each link to verify they open correctly

## 📱 What Users Will See

**About**
Learn more about BoothBrain and our privacy practices.

[Visit our website]
[Privacy Policy]
[Terms of Service]

When tapped, each button opens the URL in the device's default browser.

---

**Once you update the URLs, this section will be ready for production!** ✅
