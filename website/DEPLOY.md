# Deploy BoothBrain Website to GitHub Pages (FREE!)

**No custom domain needed! Use free GitHub Pages URL.**

## 🚀 Quick Deploy (10 minutes)

Your website will be live at:
```
https://YOUR_GITHUB_USERNAME.github.io/boothbrain-website/
```

---

## Step 1: Create GitHub Account

1. Go to https://github.com
2. Click "Sign up"
3. Choose a username (remember this - you'll need it!)
4. Complete sign up

**Already have GitHub?** Just sign in.

---

## Step 2: Create New Repository

1. Click the **+** icon (top right) → "New repository"
2. Repository name: `boothbrain-website`
3. Description: "BoothBrain app website and legal pages"
4. Make sure it's **Public** (required for free GitHub Pages)
5. Click "Create repository"

---

## Step 3: Upload Website Files

### Option A: Upload via Web Interface (Easiest)

1. On the repository page, click "uploading an existing file" link
2. Open your file explorer to: `/mnt/c/Users/songs/BoothBrain/website/`
3. Drag and drop these 6 files into GitHub:
   - ✅ index.html
   - ✅ privacy.html
   - ✅ terms.html
   - ✅ support.html
   - ✅ styles.css
   - ✅ README.md (optional)

4. Scroll down and click **Commit changes**

### Option B: Upload via Git (If you know git)

```bash
cd /mnt/c/Users/songs/BoothBrain/website
git init
git add index.html privacy.html terms.html support.html styles.css
git commit -m "Initial website"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/boothbrain-website.git
git push -u origin main
```

---

## Step 4: Enable GitHub Pages

1. In your repository, click **Settings** (top menu)
2. In the left sidebar, click **Pages**
3. Under "Source":
   - Select **main** branch
   - Leave folder as **/ (root)**
4. Click **Save**

You'll see a message: "Your site is ready to be published at..."

**Wait 2-3 minutes** for GitHub to build your site.

---

## Step 5: Get Your URLs

After 2-3 minutes, your website will be live at:

```
Homepage:        https://YOUR_USERNAME.github.io/boothbrain-website/
Privacy Policy:  https://YOUR_USERNAME.github.io/boothbrain-website/privacy.html
Terms of Service: https://YOUR_USERNAME.github.io/boothbrain-website/terms.html
Support:         https://YOUR_USERNAME.github.io/boothbrain-website/support.html
```

**Replace `YOUR_USERNAME` with your actual GitHub username!**

### Example:
If your GitHub username is `songsopaul`:
```
https://songsopaul.github.io/boothbrain-website/
https://songsopaul.github.io/boothbrain-website/privacy.html
https://songsopaul.github.io/boothbrain-website/terms.html
https://songsopaul.github.io/boothbrain-website/support.html
```

---

## Step 6: Verify It Works

1. Click the URLs above (with your username)
2. Make sure all 4 pages load correctly
3. Test on your phone to verify mobile responsiveness

✅ **If all pages load, you're done!**

---

## 📱 Use These URLs for App Store

Copy these URLs into your App Store Connect and Google Play Console:

| Field | URL |
|-------|-----|
| **Privacy Policy URL** | `https://YOUR_USERNAME.github.io/boothbrain-website/privacy.html` |
| **Terms of Service URL** | `https://YOUR_USERNAME.github.io/boothbrain-website/terms.html` |
| **Support URL** | `https://YOUR_USERNAME.github.io/boothbrain-website/support.html` |
| **Marketing URL** | `https://YOUR_USERNAME.github.io/boothbrain-website/` |

**Important:** Replace `YOUR_USERNAME` with your actual GitHub username!

---

## 🔄 Update Website Later

To update your website content:

1. Go to your repository on GitHub
2. Click on the file you want to edit (e.g., `support.html`)
3. Click the pencil icon (✏️) to edit
4. Make your changes
5. Click "Commit changes"
6. Wait 1-2 minutes for changes to go live

---

## 🎨 Update Download Links (After App Approval)

Once your app is approved, update the download button URLs:

1. Go to GitHub repository
2. Edit `index.html`
3. Find these lines (around line 24 and 90):
   ```html
   <a href="#" class="btn btn-primary">Download on the App Store</a>
   <a href="#" class="btn btn-secondary">Get it on Google Play</a>
   ```

4. Replace `#` with your real app store URLs:
   ```html
   <a href="https://apps.apple.com/app/idYOUR_APP_ID" class="btn btn-primary">Download on the App Store</a>
   <a href="https://play.google.com/store/apps/details?id=com.boothbrain.app" class="btn btn-secondary">Get it on Google Play</a>
   ```

5. Commit changes

---

## ✅ Checklist

- [ ] Created GitHub account
- [ ] Created `boothbrain-website` repository (public)
- [ ] Uploaded all 5 HTML/CSS files
- [ ] Enabled GitHub Pages (Settings → Pages)
- [ ] Waited 2-3 minutes for site to build
- [ ] Verified all 4 pages load correctly
- [ ] Copied URLs for App Store submission
- [ ] Tested pages on mobile

---

## 🆘 Troubleshooting

### "404 - File not found"
- Make sure you enabled GitHub Pages (Settings → Pages)
- Check that you selected **main** branch
- Wait 2-3 minutes after enabling GitHub Pages
- Verify files uploaded correctly (check repository files)

### Pages look unstyled (no colors/formatting)
- Make sure `styles.css` uploaded correctly
- Check that filename is exactly `styles.css` (lowercase)
- Clear browser cache (Ctrl+Shift+R or Cmd+Shift+R)

### Changes not showing up
- Wait 1-2 minutes after committing changes
- Clear browser cache
- Try incognito/private browsing mode

---

## 💡 Want a Custom Domain Later?

You can always add a custom domain later (like boothbrain.app) without changing anything in your app store listings. GitHub supports custom domains on free accounts.

But for now, the GitHub Pages URL works perfectly fine! ✅

---

**Ready to deploy?** Start with Step 1 above! 🚀

Questions? Email yourself at song.sopaul@gmail.com (just kidding - but the website will show that email for support!)
