# Marathon HQ

Mobile-first installable PWA for a spring 2027 marathon: foundation long runs, Nike Run Club companion, dumbbell strength, nutrition, weight and glucose journaling.

## Setup

1. Install Node 20+: `npm install` then `npm run dev`.
2. Create a Firebase project, add a Web app, enable Authentication > Google, and Firestore Database.
3. Copy `.env.example` to `.env.local` and populate Firebase web configuration values. Never commit private credentials.
4. Deploy `firestore.rules` using Firebase CLI (`firebase deploy --only firestore:rules`).
5. Deploy built `dist` to Firebase Hosting (`npm run build && firebase deploy --only hosting`) or another HTTPS host. Add hosting domain under Firebase Auth authorized domains.
6. On Galaxy S25 Ultra Chrome, open HTTPS URL > menu > Add to Home screen > Install.

## Security

All journal data is scoped to the authenticated Firebase UID in Firestore. The repository is currently public; do not commit private health information or secrets. Firebase API keys are client identifiers, not authorization; security relies on Firestore rules and Authentication. Offline PWA shell works, but health entries require online Firestore authentication. No medical dosing decisions are generated.

## Notes

Nike Run Club does not provide a supported general-purpose training sync API. Follow workouts in NRC and log results here. This is an independent companion app, not affiliated with Nike.
