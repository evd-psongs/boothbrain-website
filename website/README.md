# BoothBrain Website

Simple, clean website for BoothBrain app with all required pages for App Store submission.

**🚀 QUICK START: See [DEPLOY.md](DEPLOY.md) for simple deployment instructions!**

Your website will be live at: `https://YOUR_USERNAME.github.io/boothbrain-website/`

## 📄 Pages Included

- **index.html** - Homepage with features and download links
- **privacy.html** - Privacy Policy (required for App Store)
- **terms.html** - Terms of Service (required for App Store)
- **support.html** - Support page with FAQ
- **styles.css** - Professional styling
- **CNAME** - Custom domain configuration for GitHub Pages

## 🚀 Quick Deploy to GitHub Pages (FREE!)

### Step 1: Create GitHub Repository

1. Go to [GitHub](https://github.com) and sign in (or create account)
2. Click "New repository"
3. Name it: `boothbrain-website` (or any name you like)
4. Make it **Public**
5. Click "Create repository"

### Step 2: Upload Website Files

**Option A: Via GitHub Web Interface (easiest)**

1. In your new repository, click "Add file" → "Upload files"
2. Drag all files from the `/website` folder:
   - index.html
   - privacy.html
   - terms.html
   - support.html
   - styles.css
   - CNAME
3. Click "Commit changes"

**Option B: Via Command Line (if you use git)**

```bash
cd /mnt/c/Users/songs/BoothBrain/website
git init
git add .
git commit -m "Initial website commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/boothbrain-website.git
git push -u origin main
```

### Step 3: Enable GitHub Pages

1. In your repository, go to **Settings**
2. Scroll down to **Pages** (in the left sidebar)
3. Under "Source", select **main** branch
4. Click **Save**
5. Wait 1-2 minutes for deployment

### Step 4: Configure Custom Domain

1. Go to your domain registrar where you bought `boothbrain.app`
2. Find DNS settings
3. Add these DNS records:

**For Apex Domain (boothbrain.app):**
```
Type: A
Name: @
Value: 185.199.108.153

Type: A
Name: @
Value: 185.199.109.153

Type: A
Name: @
Value: 185.199.110.153

Type: A
Name: @
Value: 185.199.111.153
```

**For www Subdomain:**
```
Type: CNAME
Name: www
Value: YOUR_GITHUB_USERNAME.github.io
```

4. Wait 10-60 minutes for DNS to propagate
5. Go back to GitHub Pages settings
6. In "Custom domain" field, enter: `boothbrain.app`
7. Click **Save**
8. Check "Enforce HTTPS" (after DNS propagates)

### Step 5: Verify It Works

Visit these URLs and make sure they load:
- https://boothbrain.app
- https://boothbrain.app/privacy.html
- https://boothbrain.app/terms.html
- https://boothbrain.app/support.html

## ✅ App Store Requirements

These URLs are REQUIRED for App Store and Google Play submission:

| Requirement | URL | Status |
|------------|-----|--------|
| Privacy Policy | https://boothbrain.app/privacy.html | ✅ Ready |
| Terms of Service | https://boothbrain.app/terms.html | ✅ Ready |
| Support URL | https://boothbrain.app/support.html | ✅ Ready |
| Marketing URL | https://boothbrain.app | ✅ Ready |

## 📱 Update Download Links

After your app is approved, update the download links in `index.html`:

```html
<!-- Replace these placeholder links -->
<a href="YOUR_APP_STORE_URL" class="btn btn-primary">Download on the App Store</a>
<a href="YOUR_GOOGLE_PLAY_URL" class="btn btn-secondary">Get it on Google Play</a>
```

With your actual app store URLs:
- **App Store:** `https://apps.apple.com/app/idYOUR_APP_ID`
- **Google Play:** `https://play.google.com/store/apps/details?id=com.boothbrain.app`

## 🎨 Customization

### Update Content

All content is in plain HTML - just edit the files directly:
- Change text in the HTML files
- Update email addresses (already set to song.sopaul@gmail.com)
- Add more FAQ items in support.html
- Update feature descriptions

### Update Styling

Edit `styles.css` to change:
- Colors (search for color hex codes like `#007AFF`)
- Fonts (change the `font-family` in body)
- Spacing and layout

### Add Analytics (Optional)

Add Google Analytics or similar before `</head>` in each HTML file:

```html
<!-- Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'GA_MEASUREMENT_ID');
</script>
```

## 🔧 Alternative Hosting Options

If you don't want to use GitHub Pages:

### Netlify (Also Free)
1. Go to [Netlify](https://netlify.com)
2. Drag and drop the `/website` folder
3. Set custom domain in settings

### Vercel (Also Free)
1. Go to [Vercel](https://vercel.com)
2. Import from GitHub or upload files
3. Configure custom domain

### Traditional Web Hosting
Upload files via FTP to any web host (Namecheap, Bluehost, etc.)

## 📋 Checklist

Before App Store submission:

- [ ] Deploy website to GitHub Pages
- [ ] Configure custom domain (boothbrain.app)
- [ ] Verify all 4 pages load correctly
- [ ] Test on mobile devices
- [ ] Enable HTTPS in GitHub Pages
- [ ] Update download links after app approval
- [ ] Add app store URLs to app.config.ts

## 🆘 Troubleshooting

**"DNS_PROBE_FINISHED_NXDOMAIN" error**
- DNS hasn't propagated yet. Wait 1-24 hours.
- Verify DNS records are correct at your registrar.

**"404 Page Not Found"**
- Make sure CNAME file is in the repository root
- Check GitHub Pages is enabled in settings
- Verify branch is set to `main`

**Pages not styled correctly**
- Check that styles.css uploaded correctly
- Clear browser cache (Ctrl+Shift+R)

**HTTPS not working**
- Wait for DNS to fully propagate
- Check "Enforce HTTPS" in GitHub Pages settings

## 📞 Support

Questions about deployment? Check:
- [GitHub Pages Docs](https://docs.github.com/en/pages)
- [Custom Domain Setup](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site)

---

**Website is ready to deploy!** Follow Step 1-5 above to get it live.
