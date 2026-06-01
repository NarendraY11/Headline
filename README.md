# Aero Systems Prep

A complete pilot ground-school exam preparation platform, designed to help aviation professionals master A320 systems and pass challenging technical exams with ease.

## Tech Stack
This application is built with a modern full-stack web architecture:
- **Frontend**: React 19, Vite
- **Styling**: Tailwind CSS v4, Framer Motion for animations
- **Database / Auth**: Supabase (PostgreSQL, Row Level Security, Auth)
- **Payments**: Razorpay
- **AI Integration**: Google Gemini API (AI explanations, tutoring, and practice features)
- **Icons**: Lucide React

## Setup & Local Development

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   Copy `.env.example` to `.env` and fill in your actual credentials.
   ```bash
   cp .env.example .env
   ```

   **Required variables include:**
   - `GEMINI_API_KEY`: Required for Gemini AI API calls.
   - `APP_URL` & `VITE_APP_PUBLIC_URL`: Current host URL of the application.
   - `VITE_SUPABASE_URL`: Your Supabase project URL.
   - `VITE_SUPABASE_ANON_KEY`: Supabase anon public key.
   - `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key (for backend admin operations).
   - `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`: Razorpay keys for handling subscriptions.
   - `VITE_ADSENSE_CLIENT`, `VITE_ADSENSE_SLOT_*`: Google Adsense configurations.

3. **Start the development server:**
   ```bash
   npm run dev
   ```
   The application will be accessible at `http://localhost:3000`.

## Building for Production
To build the application for production, compiling both the client-side SPA and the backend Express server:
```bash
npm run build
```

To run the production build locally:
```bash
npm run start
```
