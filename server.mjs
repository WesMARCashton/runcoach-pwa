import express from 'express';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { join } from 'node:path';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const app = express();
const projectId = process.env.VITE_FIREBASE_PROJECT_ID;
const jwks = createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'));
app.disable('x-powered-by');

const adminDb = () => {
  const credentials = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!credentials) throw Error('Server Firebase credentials not configured');
  if (!getApps().length) initializeApp({ credential: cert(JSON.parse(credentials)) });
  return getFirestore();
};
const hashToken = token => createHash('sha256').update(token).digest('hex');
async function requireFirebase(req, res, next) {
  try {
    const token = (req.headers.authorization || '').replace(/^Bearer /, '');
    const { payload } = await jwtVerify(token, jwks, {
      issuer: 'https://securetoken.google.com/' + projectId, audience: projectId, algorithms: ['RS256']
    });
    if (!payload.sub) throw Error('No user');
    req.uid = payload.sub;
    next();
  } catch { res.status(401).json({error:'Sign in required'}); }
}
app.use(express.json({limit:'150kb'}));
app.post('/api/pair/start', requireFirebase, async (req,res) => {
  try {
    const code = String(Math.floor(100000 + Math.random()*900000));
    const key = randomBytes(18).toString('hex');
    await adminDb().collection('pairing').doc(key).set({
      uid:req.uid, codeHash:hashToken(code), expires:Date.now()+600000, used:false
    });
    res.set('Cache-Control','no-store').json({code, pairId:key, expiresIn:600});
  } catch(e) { console.error('Pair start',e.message); res.status(503).json({error:'Pairing not configured'}); }
});
app.post('/api/pair/claim', async(req,res) => {
  try {
    const {pairId,code} = req.body || {};
    if(!/^[a-f0-9]{36}$/.test(String(pairId)) || !/^\\d{6}$/.test(String(code))) return res.status(400).json({error:'Invalid pairing details'});
    const ref=adminDb().collection('pairing').doc(pairId);
    const token=randomBytes(32).toString('hex');
    const ok=await adminDb().runTransaction(async tx=>{
      const snap=await tx.get(ref); const v=snap.data();
      if(!v || v.used || v.expires<Date.now() || v.codeHash!==hashToken(code)) return false;
      tx.update(ref,{used:true});
      tx.set(adminDb().collection('devices').doc(hashToken(token)),{uid:v.uid,createdAt:FieldValue.serverTimestamp(),lastSync:null});
      return true;
    });
    if(!ok) return res.status(403).json({error:'Code expired or incorrect'});
    res.set('Cache-Control','no-store').json({deviceToken:token});
  } catch(e){console.error('Pair claim',e.message);res.status(503).json({error:'Pairing unavailable'});}
});
app.post('/api/workouts/sync', async(req,res)=>{
  try {
    const token=(req.headers.authorization||'').replace(/^Bearer /,'');
    if(!/^[a-f0-9]{64}$/.test(token)) return res.status(401).json({error:'Device not paired'});
    const db=adminDb(), device=await db.collection('devices').doc(hashToken(token)).get();
    if(!device.exists) return res.status(401).json({error:'Device not paired'});
    const workouts=req.body?.workouts;
    if(!Array.isArray(workouts)||workouts.length>100) return res.status(400).json({error:'Invalid workouts'});
    const batch=db.batch();
    for(const w of workouts){
      if(!/^[a-zA-Z0-9._:-]{1,160}$/.test(String(w.id)) || !['running','walking','other'].includes(w.type)) continue;
      const start=Number(w.start),end=Number(w.end);
      if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start||end-start>86400000) continue;
      batch.set(db.collection('users').doc(device.data().uid).collection('workouts').doc(hashToken(w.id)),{
        type:w.type,start,end,source:'health-connect',durationMinutes:Math.round((end-start)/60000),updatedAt:FieldValue.serverTimestamp()
      },{merge:true});
    }
    batch.update(device.ref,{lastSync:FieldValue.serverTimestamp()});
    await batch.commit();
    res.json({ok:true});
  }catch(e){console.error('Workout sync',e.message);res.status(503).json({error:'Sync unavailable'});}
});
app.get('/api/workouts',requireFirebase,async(req,res)=>{
  try {
    const snap=await adminDb().collection('users').doc(req.uid).collection('workouts').orderBy('start','desc').limit(100).get();
    res.json({workouts:snap.docs.map(d=>({id:d.id,...d.data(),updatedAt:undefined}))});
  }catch(e){console.error('Workouts',e.message);res.status(503).json({error:'Workouts unavailable'});}
});


app.get('/api/workouts/:id/glucose',requireFirebase,async(req,res)=>{
  try {
    if(!/^[a-f0-9]{64}$/.test(req.params.id))return res.status(400).json({error:'Invalid workout'});
    const doc=await adminDb().collection('users').doc(req.uid).collection('workouts').doc(req.params.id).get();
    if(!doc.exists)return res.status(404).json({error:'Workout not found'});
    const w=doc.data(),from=w.start-30*60000,to=w.end+3*3600000;
    const url=new URL('/api/v1/entries.json',process.env.NIGHTSCOUT_URL);
    url.searchParams.set('find[date][$gte]',String(from));
    url.searchParams.set('find[date][$lte]',String(to));
    url.searchParams.set('count','500');
    const response=await fetch(url,{headers:{'api-secret':createHash('sha1').update(process.env.NIGHTSCOUT_API_SECRET).digest('hex')}});
    if(!response.ok)return res.status(502).json({error:'Nightscout unavailable ('+response.status+')'});
    const raw=await response.json();
    const readings=(Array.isArray(raw)?raw:[]).filter(e=>Number(e.date)>=from&&Number(e.date)<=to)
      .map(e=>({time:Number(e.date),mmol:Math.round(Number(e.sgv)/18.0182*10)/10}))
      .filter(e=>Number.isFinite(e.mmol)).sort((a,b)=>a.time-b.time);
    const before=readings.filter(e=>e.time<=w.start).at(-1)||null;
    const during=readings.filter(e=>e.time>=w.start&&e.time<=w.end);
    const finish=during.at(-1)||null;
    const after=readings.filter(e=>e.time>w.end).at(-1)||null;
    res.set('Cache-Control','no-store').json({readings,before,finish,after,start:w.start,end:w.end});
  }catch(e){console.error('Workout glucose',e.message);res.status(503).json({error:'Glucose analysis unavailable'});}
});

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
      headers: { 'api-secret': createHash('sha1').update(secret).digest('hex'), accept: 'application/json' },
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
