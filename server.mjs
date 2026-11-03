import express from 'express';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { join } from 'node:path';

const app = express();
const projectId = process.env.VITE_FIREBASE_PROJECT_ID;
const jwks = createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));
app.disable('x-powered-by');
app.get('/api/glucose', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  const bearer = req.headers.authorization || '';
  if (!bearer.startsWith('Bearer ')) return res.status(401).json({ error: 'Sign in required' });
  try {
    const { payload } = await jwtVerify(bearer.slice(7), jwks, {
      issuer: 'https://securetoken.google.com/' + projectId,
      audience: projectId,
      algorithms: ['RS256']
    });
    if (!payload.sub) return res.status(401).json({ error: 'Invalid session' });
    const origin = process.env.NIGHTSCOUT_URL;
    const secret = process.env.NIGHTSCOUT_API_SECRET;
    if (!origin || !secret) return res.status(503).json({ error: 'Glucose integration not configured' });
    const upstream = await fetch(new URL('/api/v1/entries.json?count=288', origin), {
      headers: { 'api-secret': secret, accept: 'application/json' },
      signal: AbortSignal.timeout(12000)
    });
    if (!upstream.ok) return res.status(502).json({ error: 'Nightscout unavailable (' + upstream.status + ')' });
    const raw = await upstream.json();
    const data = (Array.isArray(raw) ? raw : []).slice(0, 288).map(e => ({
      time: Number(e.date),
      mmol: Math.round(Number(e.sgv) / 18.0182 * 10) / 10,
      direction: String(e.direction || 'NOT COMPUTABLE')
    })).filter(e => Number.isFinite(e.time) && Number.isFinite(e.mmol) && e.mmol > 0);
    return res.json({ readings: data });
  } catch (err) {
    if (err?.code?.startsWith?.('ERR_JWT') || err?.code === 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED') return res.status(401).json({ error: 'Session expired. Sign in again.' });
    console.error('Glucose proxy error', err?.message);
    return res.status(502).json({ error: 'Glucose data temporarily unavailable' });
  }
});
app.use(express.static(join(process.cwd(), 'dist')));
app.get('*', (_req, res) => res.sendFile(join(process.cwd(), 'dist', 'index.html')));
app.listen(Number(process.env.PORT || 4173), '0.0.0.0');
