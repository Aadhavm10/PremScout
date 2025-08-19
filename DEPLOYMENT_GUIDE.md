# 🚀 PremScout Deployment & Automation Guide

## 📋 Complete Setup for Daily Auto-Updates

### 🎯 What You Get
- ✅ **Automatic daily updates** at 9 AM UTC
- ✅ **Last updated timestamp** displayed in the app
- ✅ **Zero maintenance** - runs completely automatically
- ✅ **Error handling** and logging
- ✅ **Manual trigger** option from GitHub

---

## 🛠️ Setup Steps

### 1. **Enable GitHub Actions**
```bash
# Commit all the new files
git add .
git commit -m "🤖 Add automated daily updates and last updated display"
git push origin main
```

### 2. **Configure GitHub Repository**
1. Go to your repo: `https://github.com/Aadhavm10/PremScout`
2. Click **Settings** → **Actions** → **General**
3. Under "Workflow permissions":
   - ✅ Select "Read and write permissions"
   - ✅ Check "Allow GitHub Actions to create and approve pull requests"
4. Click **Save**

### 3. **Test the Automation**
#### Option A: Manual Trigger (Immediate)
1. Go to **Actions** tab in your GitHub repo
2. Click "Daily FPL Predictions Update"
3. Click **"Run workflow"** → **"Run workflow"**
4. Watch it run! 🚀

#### Option B: Wait for Daily Run
- Automatically runs every day at **9:00 AM UTC**
- No action needed from you!

---

## 🕐 Schedule Details

### **When It Runs:**
- **Daily at 9:00 AM UTC** (adjust in `.github/workflows/update-predictions.yml`)
- **Automatically on push** to main branch (Vercel deployment)

### **What It Does:**
1. 🔄 Fetches latest FPL data
2. 🤖 Runs ML prediction model  
3. 📊 Generates new CSV predictions
4. 🕐 Updates timestamp
5. 📤 Commits changes to GitHub
6. 🚀 Triggers Vercel redeployment

---

## 📍 Key Files

### **Automation:**
- `.github/workflows/update-predictions.yml` - GitHub Actions workflow
- `last_updated.txt` - Timestamp file
- `test_update.sh` - Local testing script

### **Data:**
- `gameweek_*_predictions.csv` - Generated daily
- `FPL.py` - Main prediction script
- `requirements.txt` - Python dependencies

### **Deployment:**
- `vercel.json` - Vercel configuration
- `api/predictions.py` - Backend API
- `frontend/` - React frontend

---

## 🔧 Customization

### **Change Update Time:**
Edit `.github/workflows/update-predictions.yml`:
```yaml
schedule:
  - cron: '0 15 * * *'  # 3 PM UTC instead of 9 AM
```

### **Timezone Examples:**
- `'0 9 * * *'` = 9 AM UTC
- `'0 17 * * *'` = 5 PM UTC  
- `'30 8 * * *'` = 8:30 AM UTC

---

## 🚨 Troubleshooting

### **If Automation Fails:**
1. Check **Actions** tab for error logs
2. Ensure repository has write permissions
3. Manually run: `./test_update.sh` locally
4. Check `requirements.txt` has all dependencies

### **If Data Doesn't Update:**
1. Verify CSV files exist: `ls gameweek_*_predictions.csv`
2. Check API responds: Visit `/api/predictions` on your site
3. Look for GitHub Actions red ❌ in commits

### **If Timestamp Missing:**
1. Check `last_updated.txt` exists
2. Verify API includes `last_updated` field
3. Refresh your deployed site

---

## 📊 Monitoring

### **Check Everything is Working:**
1. **GitHub Actions**: Green ✅ in Actions tab
2. **Live Site**: Shows "Last updated" at bottom
3. **Vercel**: Automatic deployments in dashboard
4. **API**: `/api/predictions` returns fresh data

### **Daily Checklist** (Optional):
- ✅ GitHub Actions ran successfully
- ✅ New predictions generated
- ✅ Site shows updated timestamp
- ✅ No error notifications

---

## 🎉 You're All Set!

Your FPL prediction app now:
- 🤖 **Updates automatically every day**
- 🕐 **Shows when it was last updated**  
- 🚀 **Deploys changes automatically**
- 📊 **Provides fresh predictions daily**
- 🔄 **Requires zero maintenance**

**Just sit back and enjoy fresh FPL predictions every day!** ⚽✨

---

## 🆘 Need Help?

- **GitHub Actions not running?** Check repository permissions
- **API errors?** Verify CSV files are committed
- **Vercel issues?** Check build logs in dashboard
- **Local testing:** Run `./test_update.sh`
