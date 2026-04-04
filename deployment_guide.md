# Deployment Guide: SLF Rolodex

This guide provides step-by-step instructions on how to install and run the SLF Rolodex project on an online server.

## 1. Requirements

Before you begin, ensure your server meets the following requirements:

- **Operating System**: Linux (Ubuntu 22.04+ recommended) or macOS.
- **Node.js**: Version 18.0.0 or higher.
- **Package Manager**: npm (comes with Node.js) or yarn.
- **Supabase Account**: You will need a Supabase project to handle the database and authentication.
- **Static Hosting (Optional)**: Since this is a Vite project, you can also deploy the production build to services like Netlify, Vercel, or GitHub Pages.

## 2. Environment Configuration

The application requires connection to a Supabase instance. Create a `.env` file in the root directory (you can use `.env.local` as a template).

```env
VITE_SUPABASE_URL="your-supabase-project-url"
VITE_SUPABASE_ANON_KEY="your-supabase-anon-key"
```

## 2.1 User Roles Setup (Required)

To enable admin/staff permissions, run the SQL in:

`scripts/setup_user_management.sql`

This creates the `app_users` table and RLS policies for:
- `admin`: can create/read/update/delete contacts and manage users
- `staff`: can create/read/update contacts but cannot delete contacts or manage users

The first authenticated user can bootstrap as admin automatically from the app login screen.

## 3. Installation Steps

### Log in to your server and follow these steps:

1. **Clone the repository**:
   ```bash
   git clone <your-repository-url>
   cd SLF-Rolodex
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Create the `.env` file and add your Supabase credentials:
   ```bash
   nano .env
   ```
   *(Paste the contents from step 2 and save)*

## 4. Building for Production

To create a production-ready bundle, run:
```bash
npm run build
```
This will generate a `dist` folder containing the static files (HTML, JS, CSS).

## 5. Serving the Application

### Option A: Using Nginx (Recommended for VPS)
If you are using a VPS, you can serve the `dist` folder using Nginx.

1. **Update Nginx configuration**:
   ```nginx
   server {
       listen 80;
       server_name yourdomain.com;
       root /path/to/SLF-Rolodex/dist;
       index index.html;

       location / {
           try_files $uri $uri/ /index.html;
       }
   }
   ```
2. **Restart Nginx**:
   ```bash
   sudo systemctl restart nginx
   ```

### Option B: Using a Static Web Server
You can also use a simple server like `serve`:
```bash
npm install -g serve
serve -s dist
```

## 6. Vercel Deployment (Starting from Zero)

Vercel is the recommended platform for hosting Vite projects. Follow these steps to deploy from scratch:

### 1. Push your code to GitHub
If your project is not already on GitHub:
1.  Create a new repository on [GitHub](https://github.com/new).
2.  In your terminal, run:
    ```bash
    git init
    git add .
    git commit -m "Initial commit"
    git branch -M main
    git remote add origin https://github.com/your-username/your-repo-name.git
    git push -u origin main
    ```

### 2. Connect to Vercel
1.  Sign in to [Vercel](https://vercel.com) (use your GitHub account).
2.  Click **"Add New"** > **"Project"**.
3.  Import the repository you just pushed.

### 3. Configure Deployment
- **Framework Preset**: Vercel should automatically detect **Vite**.
- **Build & Development Settings**: The defaults are usually correct (`npm run build` and `dist`).
- **Environment Variables**:
  Add the following keys from your `.env.local`:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`

### 4. Deploy
Click **"Deploy"**. Vercel will build and host your site.

> [!TIP]
> **Single Page Application (SPA) Routing**:
> I've included a `vercel.json` file in the root of the project. This ensures that when you refresh the page or navigate directly to a sub-route (e.g., `/contacts`), Vercel correctly serves `index.html` instead of a 404 error.

## 7. Troubleshooting

- **404 on Refresh**: If you are using React Router and get a 404 when refreshing a page, ensure your web server is configured to redirect all requests to `index.html`.
- **Supabase Connectivity**: Ensure your Supabase URL and API key are correct and that your database has the necessary tables and policies.
- **Signup confirmation redirects to localhost**: In Supabase Auth settings, set **Site URL** and **Redirect URLs** to your production app URL (for example `https://slf-rolodex.vercel.app`). This project now uses admin-created accounts, so self-signup is disabled in-app.
