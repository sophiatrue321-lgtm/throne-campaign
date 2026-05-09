# The Throne Campaign

Bristol relocation campaign — May 11 to June 11, 2026.

## How to deploy this to GitHub Pages (step by step)

### Step 1: Create the GitHub repo

1. Go to https://github.com and log in as `sophiatrue321`
2. Click the green **"New"** button (top left, near "Repositories")
3. Fill in:
   - **Repository name:** `throne-campaign`
   - **Description:** `Bristol relocation campaign`
   - **Public** (this MUST be public for free GitHub Pages)
   - **Add a README file:** UNcheck this (we already have one)
4. Click **"Create repository"**

### Step 2: Upload these files

The easiest way for a beginner is via the GitHub web interface:

1. On the empty repo page, click **"uploading an existing file"** (it's a link in the middle of the page)
2. Drag and drop these four files:
   - `index.html`
   - `styles.css`
   - `config.js`
   - `app.js`
   - `README.md` (this file)
3. Scroll down. In the "Commit changes" section, leave the default message
4. Click **"Commit changes"** (green button)

### Step 3: Turn on GitHub Pages

1. In the repo, click **"Settings"** (tab near the top right)
2. In the left sidebar, click **"Pages"**
3. Under "Build and deployment":
   - **Source:** Deploy from a branch
   - **Branch:** `main` (or `master`), folder `/ (root)`
4. Click **"Save"**
5. Wait 1-2 minutes — GitHub will build and deploy your site

### Step 4: Find your live URL

Your site will be live at:

```
https://sophiatrue321.github.io/throne-campaign/
```

It can take 5-10 minutes for the URL to start working after first deployment.

### Step 5: Test it

Open the URL in a browser. You should see:
- A burgundy/gold themed page
- "The Throne Campaign" title with a crown
- A total raised counter (£0 / £5,250)
- 8 item cards (Moving Team, Luxury Sofa, etc.)
- 5 tribute platform buttons (linking to # for now)

## How to update the site

Whenever you change something:

1. Go to the file in your repo on GitHub
2. Click the pencil icon (top right of the file content)
3. Make your changes
4. Scroll down and click "Commit changes"
5. The site updates within 1-2 minutes

## What still needs to happen before launch

- [ ] Update `config.js` with real platform URLs
- [ ] Build the tribute claim form (Session 2)
- [ ] Build the admin approval page (Session 2)
- [ ] Build the wheel mechanic (Session 3)
- [ ] Add Wix banner linking to the campaign (Session 4)
- [ ] End-to-end test before public launch

## Files

| File | Purpose |
|---|---|
| `index.html` | The page structure |
| `styles.css` | Visual design (burgundy/gold throne aesthetic) |
| `config.js` | Supabase credentials & platform URLs |
| `app.js` | Connects to Supabase, renders thermometers |
| `01_schema.sql` | Database schema (already run in Supabase) |

## Security notes

- The Supabase **anon key** in `config.js` is SAFE to be public. It's designed to be exposed.
- The actual security is **Row Level Security (RLS)** in the database.
- Service role keys, admin passwords, and any secrets are NEVER in this repo.

---

*The throne does not beg. It receives.*
