# Master Mind Institute

Responsive Hindi + English learning website and mobile-friendly admin panel for Classes 9–12.

## Run it
1. Install Node.js on a computer.
2. Extract this ZIP and open the project folder in a terminal.
3. Run `npm install`.
4. Copy `.env.example` to `.env.local`.
5. Fill in your Supabase Project URL and Publishable Key.
6. Run `npm run dev` and open the local URL shown by Vite.

## Supabase setup
1. In Supabase, open SQL Editor.
2. Run the complete `supabase/setup.sql` file.
3. Confirm the `study-materials` Storage bucket exists. This project uses that bucket.
4. Sign in with the Supabase Auth account whose `profiles.role` is `super_admin` or `admin`.

## What is included
- Student sign up/sign in
- Class 9th–12th content library
- Video lessons via YouTube/other video URLs
- Notes, DPP, PYQ and other PDF/file uploads
- Admin panel for adding, editing and deleting learning resources
- Hindi/English interface toggle
- Responsive layout for phones and desktop

## Important
- The Publishable Key is designed for browser use. Never put a Supabase Secret/Service Role key in frontend code.
- The app relies on Row Level Security. Do not disable RLS.
- Public bucket files can be viewed by anyone who has the file URL. Do not upload private student records.
- This starter expects `profiles`, `study_materials`, and the `study-materials` storage bucket created by `supabase/setup.sql`.
