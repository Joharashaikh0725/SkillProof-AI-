// SkillProof AI: frontend demo. AI parts are rule-based; see getAIReaction() and buildReport()
// for the places to connect a real AI API later.
const KEY = 'skillproof_v2';
const STEPS = ['Problem', 'Ideas', 'Design', 'Interview', 'Improve', 'Report'];
const CHALLENGES = [
  { id: 'deadlines', title: 'Assignment and deadline manager', level: 'Beginner', prompt: 'Students cannot manage their assignments and deadlines. Design a solution for this problem.' },
  { id: 'canteen', title: 'College canteen ordering', level: 'Beginner', prompt: 'Students waste break time standing in canteen queues. Design a way to order and collect food faster.' },
  { id: 'library', title: 'Library book finder', level: 'Intermediate', prompt: 'Students cannot tell which library books are available or where they are shelved. Design a solution.' },
  { id: 'bus', title: 'College bus tracker', level: 'Intermediate', prompt: 'Students miss the college bus because they do not know where it is. Design a solution for them.' },
  { id: 'elder', title: 'Medicine reminder for grandparents', level: 'Advanced', prompt: 'Older adults forget medicines and find phone apps confusing. Design a simple reminder experience for them.' }
];
const ASK = {
  deadlines: 'A student opens your design. How do they find their next assignment deadline?',
  canteen: 'A student has only 10 minutes. How do they order and collect food with your design?',
  library: 'How does a student find out if a book is available and where to find it?',
  bus: 'How does a student know the bus is late before leaving home?',
  elder: 'How would a grandparent set up a medicine reminder without any help?'
};
const svgi = p => `<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
const FEAT_ICON = [
  '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/>',
  '<path d="M12 21s-6-5.2-6-10a6 6 0 0 1 12 0c0 4.8-6 10-6 10z"/><circle cx="12" cy="11" r="2"/>',
  '<path d="M4 5h16v11H9l-5 4z"/>',
  '<path d="M6 3h9l4 4v14H6z"/><path d="M9 14l2 2 4-4"/>',
  '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
  '<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6M17 11a3 3 0 1 0 0-6M21 20c0-2.6-1.6-4.6-4-5.5"/>'
];
const CH_ICON = {
  deadlines: '<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M8 3v4M16 3v4M4 11h16"/>',
  canteen: '<path d="M7 3v7M5 3v5a2 2 0 0 0 4 0V3M7 10v11M17 3c-2 1-3 4-3 7h3v11"/>',
  library: '<path d="M4 4h6a3 3 0 0 1 2 1 3 3 0 0 1 2-1h6v15h-6a3 3 0 0 0-2 1 3 3 0 0 0-2-1H4z"/><path d="M12 5v15"/>',
  bus: '<rect x="4" y="3" width="16" height="14" rx="2"/><path d="M4 11h16M8 21v-4M16 21v-4"/>',
  elder: '<path d="M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 11c0 5.5-7 10-7 10z"/>'
};
const curChal = () => CHALLENGES.find(c => c.id === S.work.cid) || CHALLENGES[0];
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const cfg = window.SKILLPROOF_CONFIG || {};
const sb = (window.supabase && cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY) ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;
const HASH0 = location.hash; // the confirmation link brings the user back with #access_token=...&type=signup
const snip = (t, n = 110) => { t = String(t || '').trim(); return t.length > n ? t.slice(0, n) + '…' : t; };

const blank = cid => ({
  cid, step: 0, saved: false, rid: 0, pick: 0, why: '', notes: '', figma: '',
  problem: { audience: '', pains: [], needs: '' },
  ideas: [{ t: '', d: '' }, { t: '', d: '' }, { t: '', d: '' }],
  interview: [], pins: [], flags: { paste: 0, pasteAns: 0, fast: 0 }, qs: [], designReview: null,
  improve: { testers: 5, passed: 0, feedback: '', changes: '' }
});
let S = { user: null, known: null, work: null, reports: [] };
let view = 'home', tab = 'login', openReport = 0;
const shots = { before: null, after: null }; // kept in memory only (images are large)
const AI = { fn: null, vision: true, off: false, busy: false, scoring: false, ctl: null };

try { const raw = localStorage.getItem(KEY); if (raw) S = JSON.parse(raw); } catch (e) { }
if (S.work) { S.work.pins = S.work.pins || []; S.work.flags = S.work.flags || { paste: 0, pasteAns: 0, fast: 0 }; S.work.qs = S.work.qs || []; S.work.designReview = S.work.designReview || null; S.work.interview.forEach((x, i) => { if (!x.r) x.r = getAIReaction(x.a, i); }); }
if (sb) { S.user = null; S.known = null; S.reports = []; } // with Supabase, login and reports come from the cloud
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { } };
const toast = (t, ok) => { const m = $('#msg'); m.classList.toggle('ok', !!ok); m.textContent = t; m.hidden = false; clearTimeout(toast.id); toast.id = setTimeout(() => m.hidden = true, 3500); };

let modalOk = null;
function openModal(html, onOk) {
  $('#mb').innerHTML = html; modalOk = onOk || null; $('#modal').hidden = false;
  ($('#mb button') || $('#modal .x')).focus();
}
function closeModal() { $('#modal').hidden = true; modalOk = null; }
function confirmBox(title, text, okLabel, fn) {
  openModal(`<h2 id="mt">${title}</h2><p>${text}</p><div class="actions"><button class="btn ghost" data-close>Cancel</button><button class="btn" data-ok>${okLabel}</button></div>`, fn);
}
function welcome() {
  openModal(`<div class="ring">${esc(S.user.name.charAt(0).toUpperCase())}</div><h2 id="mt">Welcome, ${esc(S.user.name.split(' ')[0])}</h2>
    <p>Here is how SkillProof AI works:</p><ul><li>Pick a real design challenge</li><li>Explain your ideas and defend them in an AI interview</li><li>Get a report with a reason and evidence for every score</li></ul>
    <div class="actions"><button class="btn ghost" data-close>Maybe later</button><button class="btn" data-go="challenges">Browse challenges</button></div>`);
}
function reportPopup() {
  const r = S.reports.find(x => x.id === S.work.rid); if (!r) return;
  const best = r.rows.slice().sort((a, b) => b.score - a.score)[0];
  openModal(`<div class="confetti" aria-hidden="true">${Array.from({ length: 14 }, (_, i) => `<i style="left:${i * 7 + 3}%;animation-delay:${(i % 5) * 0.12}s;background:${['#6c4cf1', '#ff5c8a', '#ffc93c', '#10b58f'][i % 4]}"></i>`).join('')}</div><div class="ring">${r.avg}</div><h2 id="mt">Your report is ready</h2>
    <p>Your average score is ${r.avg} out of 5. Your strongest skill was ${best.name.toLowerCase()}. Every score has a reason and evidence.</p>
    <div class="actions"><button class="btn" data-ok>See my report</button></div>`);
}

const skillAvg = () => { const m = {}; S.reports.forEach(r => r.rows.forEach(x => (m[x.name] = m[x.name] || []).push(x.score))); return Object.entries(m).map(([n, a]) => [n, a.reduce((p, c) => p + c, 0) / a.length]).sort((a, b) => b[1] - a[1]); };
const getp = (o, p) => p.split('.').reduce((a, k) => a?.[k], o);
const setp = (o, p, v) => { const k = p.split('.'); const last = k.pop(); k.reduce((a, x) => a[x], o)[last] = v; };

// ---------- views ----------
const LOGO = '<span class="logo" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1c1650" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-10"/></svg></span>';

function navHTML() {
  if (S.user) {
    const n = S.user.name || 'You';
    return [['dashboard', 'Dashboard'], ['challenges', 'Challenges'], ['reports', 'Reports']].map(([g, t]) => `<button class="link" data-go="${g}">${t}</button>`).join('') +
      `<button class="link chip-user" data-go="profile" aria-label="Profile"><span class="avatar">${esc(n.charAt(0).toUpperCase())}</span>${esc(n.split(' ')[0])}</button><button class="link" id="logout">Log out</button>`;
  }
  return `<button class="link" data-go="home">Home</button><button class="link" data-scroll="how">How it works</button><button class="link" data-scroll="features">Features</button>
    <button class="btn ghost sm" data-go="auth" data-tab="login">Log in</button><button class="btn sm" data-go="auth" data-tab="register">Sign up</button>`;
}

function footHTML() {
  const L = S.user ? [['dashboard', 'Dashboard'], ['challenges', 'Challenges'], ['reports', 'Reports'], ['profile', 'Profile']].map(([g, n]) => `<button class="flink" data-go="${g}">${n}</button>`).join('')
    : `<button class="flink" data-go="home">Home</button><button class="flink" data-scroll="how">How it works</button><button class="flink" data-scroll="features">Features</button><button class="flink" data-go="auth" data-tab="login">Log in</button><button class="flink" data-go="auth" data-tab="register">Create account</button>`;
  return `<div class="foot-wave" aria-hidden="true"><svg viewBox="0 0 1440 60" preserveAspectRatio="none"><path d="M0 34C220 70 470 0 720 30S1200 62 1440 22V60H0Z" fill="#1c1650"/></svg></div>
    <div class="foot-in"><div><a class="brand" href="#" data-go="home">${LOGO}SkillProof AI</a><p>Prove how you think, not just what you made.</p>
      <div class="techchips"><span>HTML</span><span>CSS</span><span>JavaScript</span><span>Claude AI</span></div></div>
    <div><h4>Explore</h4>${L}</div>
    <div><h4>Features</h4><span class="fitem">Design pins</span><span class="fitem">AI interview</span><span class="fitem">Evidence-based scores</span><span class="fitem">Mentor review</span></div></div>
    <div class="foot-bot"><span>&copy; ${new Date().getFullYear()} SkillProof AI.</span><button class="totop" data-act="top">Back to top</button></div>`;
}



window.addEventListener('scroll', () => $('#top').classList.toggle('scrolled', window.scrollY > 8), { passive: true });
let lastKey = '';
function render() {
  $('#nav').innerHTML = navHTML(); $('#foot').innerHTML = footHTML();
  $('#top').classList.remove('open'); $('#burger').setAttribute('aria-expanded', 'false');
  if (!S.user && view !== 'auth' && view !== 'shared') view = 'home';
  if (S.user && (view === 'home' || view === 'auth')) view = 'dashboard';
  if (view === 'work' && !S.work) view = 'challenges';
  const V = { home: homeView, auth: authView, dashboard: dashView, challenges: chalView, work: workView, reports: repsView, report: repDetail, profile: profView, shared: sharedView };
  $('#app').innerHTML = V[view]();
  const key = view + (view === 'work' && S.work ? S.work.step : ''); $('#app').classList.toggle('enter', key !== lastKey); lastKey = key;
  const on = view === 'work' ? 'challenges' : view === 'report' ? 'reports' : view;
  document.querySelectorAll('.top [data-go]').forEach(b => b.classList.toggle('on', b.dataset.go === on));
  window.scrollTo(0, 0);
}

function authView() {
  const reg = tab === 'register';
  return `<section class="auth">
    <div><h1>Show how you think.</h1><div class="pills"><span>Solve</span><span>Defend</span><span>Get proof</span></div></div>
    <div class="panel" id="authForm">
      <div class="tabs" role="tablist">
        <button type="button" class="tab" role="tab" data-tab="login" aria-selected="${!reg}">Log in</button>
        <button type="button" class="tab" role="tab" data-tab="register" aria-selected="${reg}">Create account</button>
      </div>
      ${reg ? `<label for="nm">Full name</label><input type="text" id="nm" autocomplete="name">
      <label for="rl">I am a</label><select id="rl"><option>College student</option><option>Job seeker</option></select>` : ''}
      <label for="em">Email</label><input type="email" id="em" autocomplete="email">
      <label for="pw">Password <span class="hint">(at least 6 characters)</span></label><input type="password" id="pw" autocomplete="current-password">
      <div class="actions"><button class="btn" type="button" data-act="auth">${reg ? 'Create my account' : 'Log in'}</button><button type="button" class="btn ghost" data-go="home">Back to home</button></div>
    </div></section>`;
}

function homeView() {
  const feats = [
    ['<path d="M12 21s-6-5.5-6-10a6 6 0 0 1 12 0c0 4.5-6 10-6 10z"/><circle cx="12" cy="11" r="2"/>', 'Design pins', 'Explain every decision on your design'],
    ['<path d="M4 5h16v11H9l-5 4z"/>', 'AI interview', 'Answer questions like a viva'],
    ['<circle cx="12" cy="9" r="5"/><path d="M9 14l-2 7 5-3 5 3-2-7"/>', 'Evidence-based scores', 'Every score has a reason and a quote'],
    ['<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>', 'Authenticity check', 'Flags pasted or rushed answers'],
    ['<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.5 3-6 6-6s6 2.5 6 6M16 5a3 3 0 0 1 0 6M21 20c0-2.5-1.5-4.5-3.5-5.4"/>', 'Mentor review', 'Compare AI scores with a mentor'],
    ['<path d="M7 3h8l4 4v14H7z"/><path d="M15 3v4h4"/>', 'Shareable report', 'Print or copy it for recruiters']
  ];
  return `<section class="hero"><div class="hero-l"><span class="kicker">For students and job seekers</span><h1>Show how you think, not just what you made.</h1>
    <p class="lead">Solve real design problems. Get an AI report with proof.</p>
    <div class="row"><button class="btn" data-go="auth" data-tab="register">Create account</button><button class="btn ghost" data-go="auth" data-tab="login">Log in</button></div>
    <div class="pills"><span>5 challenges</span><span>AI interview</span><span>Proof report</span></div></div>
    <div class="sample-wrap"><span class="float f1">Pin 1</span><span class="float f2">AI viva</span><span class="float f3">+2 improved</span>
    <div class="sample" aria-label="Sample report">
      <div class="sample-top"><span class="sample-t">Sample report</span><span class="avg">4.2<small>/5</small></span></div>
      ${radar([4, 5, 3, 4, 5].map(score => ({ score })))}
      <p class="ev"><span>Evidence</span><mark>“I put the deadline in the top bar”</mark></p>
      <p class="fine">Illustrative scores only</p></div></div></section>
    <div class="numbers"><div><b>5</b><span>real challenges</span></div><div><b>6</b><span>guided steps</span></div><div><b>5</b><span>skills scored</span></div><div><b>1</b><span>proof report</span></div></div>
    <h2 class="sech" id="how">How it works</h2>
    <ol class="steps">
      <li><span class="ic c1">${svgi('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>')}</span><b>1. Solve</b><span>Pick a real problem</span></li>
      <li><span class="ic c2">${svgi('<path d="M4 5h16v11H9l-5 4z"/>')}</span><b>2. Defend</b><span>Answer the AI’s questions</span></li>
      <li><span class="ic c3">${svgi('<circle cx="12" cy="12" r="9"/><path d="M8 12l3 3 5-6"/>')}</span><b>3. Prove</b><span>Get a scored report</span></li></ol>
    <h2 class="sech" id="features">Everything you need to prove it</h2>
    <div class="feats">${feats.map(([ic, t, d], i) => `<div class="feat"><span class="ic k${i % 5}">${svgi(ic)}</span><div><h3>${t}</h3><p>${d}</p></div></div>`).join('')}</div>
    <h2 class="sech">Who is it for?</h2>
    <div class="who"><div class="w1"><h3>Students</h3><p>Practice and build proof</p></div><div class="w2"><h3>Recruiters</h3><p>See how people think</p></div><div class="w3"><h3>Teachers</h3><p>Grade fairly with a rubric</p></div></div>
    <div class="cta"><h2>Ready to prove your skills?</h2><button class="btn" data-go="auth" data-tab="register">Get started</button></div>`;
}

function dashView() {
  const w = S.work, active = w && w.step < 5, n = S.reports.length, sk = skillAvg();
  const bd = [['First report', n >= 1], ['Design pins', S.reports.some(r => (r.decisions || []).length)], ['Improver', S.reports.some(r => r.rows.some(x => x.delta > 0))], ['Mentor checked', S.reports.some(r => r.mentor)], ['3 reports', n >= 3]];
  const avg = n ? (S.reports.reduce((a, r) => a + r.avg, 0) / n).toFixed(1) : '-';
  const done = new Set(S.reports.map(r => r.cid)), next = CHALLENGES.find(c => !done.has(c.id)) || CHALLENGES[0];
  const stat = (v, l) => `<div class="stat"><div class="big">${esc(v)}</div><div class="muted">${l}</div></div>`;
  const cur = active ? CHALLENGES.find(c => c.id === w.cid) : next;
  const reps = S.reports.slice(-5).reverse().map(r => `<div class="rep"><span>${esc(r.title)}</span><div class="pbar"><b style="width:${r.avg / 5 * 100}%"></b></div><strong>${r.avg}</strong></div>`).join('');
  return `<div class="banner"><h1>Hi, ${esc(S.user.name.split(' ')[0])}</h1><p>${n ? `You have ${n} report${n > 1 ? 's' : ''}. Keep building your proof.` : 'Start your first challenge to build your proof.'}</p></div>
    <div class="stats">${stat(n, 'Reports')}${stat(avg, 'Average score')}${stat(sk.length ? sk[0][0] : '-', 'Strongest skill')}${stat(sk.length ? sk[sk.length - 1][0] : '-', 'Needs work')}${agreement() ? stat(agreement(), 'AI-mentor agreement') : ''}</div>
    <div class="panel accent"><h3>${active ? 'In progress' : 'Next challenge'}: ${esc(cur.title)}</h3>
      <p>${active ? `You are on step ${w.step + 1} of 6 (${STEPS[w.step]}).` : esc(cur.prompt)}</p>
      <button class="btn" data-act="start" data-cid="${cur.id}">${active ? 'Continue challenge' : 'Start challenge'}</button></div>
    <div class="panel"><h2>Badges</h2><div class="badges">${bd.map(([t, ok]) => `<span class="bdg ${ok ? 'on' : ''}">${ok ? '✓ ' : ''}${t}</span>`).join('')}</div></div>
    ${sk.length ? `<div class="panel"><h2>Your skills</h2>${sk.map(([n, a]) => `<div class="rep"><span>${n}</span><div class="pbar"><b style="width:${a / 5 * 100}%"></b></div><strong>${a.toFixed(1)}</strong></div>`).join('')}</div>` : ''}
    <div class="panel"><h2>Your progress</h2>${reps || '<p class="muted">No reports yet. Finish a challenge to see how your scores change.</p>'}
      ${n ? '<button class="btn ghost" data-go="reports">See all reports</button>' : '<button class="btn ghost" data-go="challenges">Browse challenges</button>'}</div>`;
}

function chalView() {
  return `<h1>Challenges</h1><p class="muted">Pick one real problem and finish all six steps to get a report.</p>
    <div class="cards">${CHALLENGES.map((c, i) => {
      const k = S.reports.filter(r => r.cid === c.id).length, act = S.work && S.work.step < 5 && S.work.cid === c.id;
      return `<div class="panel"><div class="cardtop"><span class="ic k${i}">${svgi(CH_ICON[c.id])}</span><span class="tag lv-${c.level}">${c.level}</span></div><h3>${esc(c.title)}</h3><p>${esc(c.prompt)}</p>
        <p class="muted">${act ? 'In progress' : k ? `Completed ${k} time${k > 1 ? 's' : ''}` : 'Not started'}</p>
        <div class="row"><button class="btn ghost" data-act="details" data-cid="${c.id}">Details</button><button class="btn" data-act="start" data-cid="${c.id}">${act ? 'Continue' : k ? 'Try again' : 'Start'}</button></div></div>`;
    }).join('')}</div>`;
}

function repsView() {
  const l = S.reports.slice().reverse();
  return `<h1>Your reports</h1>` + (l.length ? `<div class="panel">${l.map(r => `<div class="rep2"><div><strong>${esc(r.title)}</strong><div class="muted">${esc(r.date)}</div></div><strong>${r.avg} / 5</strong><button class="btn ghost" data-act="viewrep" data-id="${r.id}">View</button></div>`).join('')}</div>`
    : `<div class="panel"><p>No reports yet. Finish a challenge to get your first one.</p><button class="btn" data-go="challenges">Choose a challenge</button></div>`);
}

function repDetail() {
  const r = S.reports.find(x => x.id === openReport);
  if (!r) return repsView();
  return `<button class="link dark" data-go="reports">Back to reports</button><div class="panel">${reportHTML(r)}<div class="actions"><span class="row"><button class="btn ghost" data-act="print">Print report</button><button class="btn ghost" data-act="copyrep" data-id="${r.id}">Copy summary</button><button class="btn ghost" data-act="mentor" data-id="${r.id}">${r.mentor ? 'Edit mentor review' : 'Add mentor review'}</button>${sb && r.dbId ? `<button class="btn ghost" data-act="share" data-id="${r.id}">${r.is_public ? 'Stop sharing' : 'Share link'}</button>` : ''}</span></div></div>`;
}

function profView() {
  const u = S.user, js = u.role === 'Job seeker';
  return `<h1>Profile</h1><div class="panel" id="profForm">
    <label for="pn">Full name</label><input type="text" id="pn" value="${esc(u.name)}" required>
    <label for="pe">Email</label><input type="email" id="pe" value="${esc(u.email)}" disabled>
    <label for="pr">I am a</label><select id="pr"><option ${js ? '' : 'selected'}>College student</option><option ${js ? 'selected' : ''}>Job seeker</option></select>
    <div class="actions"><button class="btn" type="button" data-act="saveprof">Save profile</button></div></div>
    <div class="panel"><h3>AI feedback</h3>${sb && cfg.API_URL ? `<p class="muted">Claude gives interview feedback, looks at your design and scores your report. Your answers are sent to the SkillProof server, which asks Claude.</p><label class="chk"><input type="checkbox" id="aiToggle" ${S.ai !== false ? 'checked' : ''}> Use Claude AI</label>` : '<p class="muted">AI is not set up yet (see config.js). Built-in feedback is used.</p>'}</div>
    <div class="panel"><h3>Your data</h3><p class="muted">Everything is stored only in this browser.</p>
    <button class="btn ghost" data-act="wipe">Delete my reports and progress</button></div>`;
}

function workView() {
  const w = S.work, s = w.step;
  const bar = `<ol class="stepper">${STEPS.map((n, i) => `<li class="${i < s ? 'done' : i === s ? 'now' : ''}" ${i === s ? 'aria-current="step"' : ''}>${i + 1}. ${n}</li>`).join('')}</ol>`;
  const body = [stepProblem, stepIdeas, stepDesign, stepInterview, stepImprove, stepReport][s]();
  const nav = s === 5 ? '' : `<div class="actions">
    <button class="btn ghost" data-act="back" ${s === 0 ? 'disabled' : ''}>Back</button>
    <button class="btn" data-act="next">${s === 4 ? 'Generate my report' : 'Save and continue'}</button></div>`;
  return `<p class="muted">${esc(curChal().title)}</p>` + bar + `<div class="panel">${body}${nav}</div>`;
}

function stepProblem() {
  const p = S.work.problem;
  return `<h2>Understand the problem</h2><p class="muted">${esc(curChal().prompt)}</p>
    <label for="aud">Who is the target audience?</label>
    <textarea id="aud" data-bind="problem.audience" placeholder="Example: First-year engineering students who juggle 5 subjects">${esc(p.audience)}</textarea>
    <label for="pain">Pain points <span class="hint">(add at least one)</span></label>
    <div class="row"><input type="text" id="pain" placeholder="Example: Forgets deadlines posted in different WhatsApp groups"><button class="btn ghost" data-act="addpain">Add</button></div>
    <div class="chips">${p.pains.map((x, i) => `<span class="chip">${esc(x)}<button data-del="${i}" aria-label="Remove pain point">×</button></span>`).join('')}</div>
    <label for="needs">What do these users need?</label>
    <textarea id="needs" data-bind="problem.needs">${esc(p.needs)}</textarea>`;
}

function stepIdeas() {
  const w = S.work;
  return `<h2>Explore ideas</h2><p class="muted">Add at least two solutions, then choose one and explain why.</p>
    <div class="ideas">${w.ideas.map((x, i) => `<div class="idea ${w.pick === i ? 'picked' : ''}">
      <label for="it${i}">Idea ${i + 1} title</label><input type="text" id="it${i}" data-bind="ideas.${i}.t" value="${esc(x.t)}">
      <label for="id${i}">Short description</label><textarea id="id${i}" data-bind="ideas.${i}.d">${esc(x.d)}</textarea>
      <label><input type="radio" name="pick" data-pick="${i}" ${w.pick === i ? 'checked' : ''}> I choose this one</label></div>`).join('')}</div>
    <label for="why">Why did you choose this idea?</label>
    <textarea id="why" data-bind="why">${esc(w.why)}</textarea>`;
}

function stepDesign() {
  const w = S.work;
  return `<h2>Upload your design</h2>
    <div class="drop"><label for="f1">Wireframe or screenshot (PNG or JPG)</label><input type="file" id="f1" accept="image/*" data-shot="before">
    ${shots.before ? `<p class="muted" style="margin:10px 0 0">Click on your design to add a pin and explain a decision (up to 6).</p><div class="pinwrap"><img src="${shots.before}" alt="Your uploaded design. Click to add a pin.">${w.pins.map((p, i) => `<span class="pin" style="left:${p.x}%;top:${p.y}%">${i + 1}</span>`).join('')}</div>` : ''}</div>
    ${w.pins.length ? `<ol class="pinlist">${w.pins.map((p, i) => `<li><span class="n">${i + 1}</span><textarea id="pin${i}" data-bind="pins.${i}.note" placeholder="Why did you put this here?">${esc(p.note)}</textarea><button class="btn ghost sm" data-delpin="${i}">Remove</button></li>`).join('')}</ol>` : ''}
    ${designAIPanel()}
    <label for="fg">Figma link <span class="hint">(optional)</span></label>
    <input type="url" id="fg" data-bind="figma" value="${esc(w.figma)}" placeholder="https://www.figma.com/...">
    <label for="nt">Design notes <span class="hint">(optional)</span></label>
    <textarea id="nt" data-bind="notes">${esc(w.notes)}</textarea>`;
}

function questions() {
  const idea = S.work.ideas[S.work.pick]?.t || 'your chosen idea';
  const p = S.work.pins[0];
  return [p ? `You marked pin 1${p.note ? ' (“' + snip(p.note, 60) + '”)' : ''}. Why did you place this element there, and what option did you reject?` : 'Why did you place the main button where you did?',
    'How does your design improve accessibility for students with different needs?',
    `Why did you choose “${idea}” over your other ideas?`,
    ASK[S.work.cid] || ASK.deadlines];
}

function getAIReaction(a, i) { // swap this with a real AI API call later
  const words = a.trim().split(/\s+/), quote = `You said “${words.slice(0, 6).join(' ')}…”. `;
  if (words.length < 8) return 'This is a bit short. Mention a real user and what they would do.';
  if (i === 1 && !/contrast|font|screen reader|alt|keyboard|label|size|colou?r/i.test(a)) return quote + 'Name one specific accessibility feature, like text size, contrast or keyboard use.';
  if (i === 3 && !/tap|click|open|press|scroll|search|filter|first|then|step/i.test(a)) return quote + 'Walk through the steps a user takes, for example: open the app, tap the calendar, see the date.';
  if (!/because|so that|since|therefore/i.test(a)) return quote + 'Good start. Now add the reason: why is this better for the user?';
  return quote + 'Good. You gave a reason, not just a description. Think about how you would test this with a real user.';
}

function stepInterview() {
  const done = S.work.interview, i = done.length, busy = AI.busy;
  const chat = done.map(x => `<div class="bubble ai">${esc(x.q)}</div><div class="bubble you">${esc(x.a)}</div>${x.r ? `<div class="bubble react">${esc(x.r)}</div>` : '<div class="bubble react typing" aria-label="Claude is typing"><i></i><i></i><i></i></div>'}`).join('');
  return `<h2>AI design interview</h2><p class="muted">Answer like you would in a viva. Question ${Math.min(i + 1, 4)} of 4. <span class="aitag">${aiOn() ? 'Claude AI is your interviewer' : 'Built-in feedback'}</span></p>
    <div class="chat">${chat}${i < 4 && !busy ? `<div class="bubble ai">${esc(curQ(i))}</div>` : ''}${i >= 4 && !busy ? '<div class="bubble react">Interview complete. Continue to testing.</div>' : ''}</div>
    ${i < 4 && !busy ? `<label for="ans">Your answer</label><textarea id="ans"></textarea>
    <div class="actions"><span></span><button class="btn" data-act="answer">Send answer</button></div>` : ''}`;
}

function stepImprove() {
  const im = S.work.improve;
  return `<h2>Test and improve</h2><p class="muted">Test your design with real students. Task: "Find your next assignment deadline without help."</p>
    <label for="ts">How many people tested it?</label><input type="number" id="ts" min="1" max="50" data-bind="improve.testers" value="${im.testers}">
    <label for="ps">How many finished the task without help?</label><input type="number" id="ps" min="0" max="50" data-bind="improve.passed" value="${im.passed}">
    <label for="fb">What feedback did they give?</label><textarea id="fb" data-bind="improve.feedback">${esc(im.feedback)}</textarea>
    <label for="ch">What did you change after the feedback?</label><textarea id="ch" data-bind="improve.changes">${esc(im.changes)}</textarea>
    <div class="drop" style="margin-top:14px"><label for="f2">Revised design (optional)</label><input type="file" id="f2" accept="image/*" data-shot="after">
    ${shots.after ? `<img class="shot" src="${shots.after}" alt="Your revised design">` : ''}</div>`;
}

// ---------- report ----------
function buildReport() { // every score has a reason and evidence
  const w = S.work, p = w.problem, im = w.improve;
  const clamp = n => Math.max(1, Math.min(5, Math.round(n)));
  const n = w.ideas.filter(x => x.t.trim()).length, pn = w.pins.filter(p => p.note.trim().length >= 15).length;
  const ans = w.interview.map(x => x.a).join(' ');
  const hits = [...new Set((ans.match(/contrast|font|screen reader|alt text|keyboard|label|text size|colou?r/gi) || []).map(x => x.toLowerCase()))];
  const rate = im.testers ? Math.min(im.passed / im.testers, 1) : 0;
  const rows = [
    { name: 'Problem understanding', score: clamp(1 + (p.audience.length >= 30) + (p.pains.length >= 2) + (p.pains.length >= 3) + (p.needs.length >= 40)),
      reason: `You listed ${p.pains.length} pain point(s) and described the audience in ${p.audience.trim().split(/\s+/).length} words.`, ev: p.pains[0] || p.audience,
      tip: 'Add one pain point you saw in a real student, not only one you imagined.' },
    { name: 'Creative thinking', score: clamp(1 + (n >= 2) + (n >= 3) + (w.why.length >= 60) + (w.why.length >= 120 || pn >= 2)),
      reason: `You explored ${n} idea(s) and explained your choice in ${w.why.trim().split(/\s+/).length} words.${pn ? ` You explained ${pn} design decision(s) on your design.` : ''}`, ev: w.why,
      tip: 'Compare your ideas on one clear point, like speed or effort for the student.' },
    { name: 'Usability', score: clamp(1 + rate * 4),
      reason: `${im.passed} of ${im.testers} testers finished the task without help.`, ev: im.feedback,
      tip: 'Test the deadline task again with 3 new users and time how long it takes.' },
    { name: 'Accessibility', score: clamp(1 + hits.length),
      reason: hits.length ? `Your answers mention: ${hits.join(', ')}.` : 'Your answers did not name a specific accessibility feature.', ev: w.interview[1]?.a || '',
      tip: 'Check text size, colour contrast and keyboard use in your design.' },
    { name: 'Improvement after feedback', score: clamp(1 + (im.changes.length >= 20) + (im.changes.length >= 60) + !!shots.after + (im.changes.length >= 120)),
      reason: `You described your changes in ${im.changes.trim().split(/\s+/).length} words and ${shots.after ? 'uploaded' : 'did not upload'} a revised design.`, ev: im.changes,
      tip: 'Upload the revised design so the before and after can be compared.' }
  ];
  const avg = +(rows.reduce((a, r) => a + r.score, 0) / rows.length).toFixed(1);
  return { rows, avg, low: rows.slice().sort((a, b) => a.score - b.score)[0] };
}

function radar(rows) {
  const cx = 170, cy = 128, R = 90, n = rows.length, short = ['Problem', 'Creative', 'Usability', 'Access.', 'Improve'];
  const pt = (i, v) => { const a = -Math.PI / 2 + i * 2 * Math.PI / n; return [cx + R * v / 5 * Math.cos(a), cy + R * v / 5 * Math.sin(a)]; };
  const ring = v => rows.map((_, i) => pt(i, v).map(c => c.toFixed(1)).join(',')).join(' ');
  return `<svg class="radar" viewBox="0 0 340 260" role="img" aria-label="Skill chart">
    ${[1, 2, 3, 4, 5].map(v => `<polygon points="${ring(v)}" fill="none" stroke="#e2def7"/>`).join('')}
    ${rows.map((_, i) => { const p = pt(i, 5); return `<line x1="${cx}" y1="${cy}" x2="${p[0].toFixed(1)}" y2="${p[1].toFixed(1)}" stroke="#e2def7"/>`; }).join('')}
    <polygon points="${rows.map((x, i) => pt(i, x.score).map(c => c.toFixed(1)).join(',')).join(' ')}" fill="rgba(108,76,241,.25)" stroke="#6c4cf1" stroke-width="2"/>
    ${rows.map((x, i) => { const p = pt(i, 5.6), an = p[0] < cx - 6 ? 'end' : p[0] > cx + 6 ? 'start' : 'middle'; return `<text x="${p[0].toFixed(1)}" y="${(p[1] + 4).toFixed(1)}" text-anchor="${an}" font-size="12" fill="#1c1650">${short[i] || ''} ${x.score}</text>`; }).join('')}</svg>`;
}

function dl(n) {
  if (n == null) return '';
  return n > 0 ? `<span class="delta up">+${n} vs last attempt</span>` : n < 0 ? `<span class="delta down">${n} vs last attempt</span>` : '<span class="delta same">same as last attempt</span>';
}

function reportText(r) {
  return `SkillProof AI report: ${r.title}\nAverage score: ${r.avg}/5 (${r.date})\n\n` +
    r.rows.map(x => `${x.name}: ${x.score}/5\n  Reason: ${x.reason}` + (x.ev ? `\n  Evidence: “${x.ev}”` : '')).join('\n') + (r.honesty ? `\n\nAuthenticity check: ${r.honesty.level === 'ok' ? 'looks original' : 'review suggested'}` : '') + `\n\nNext step: ${r.low.tip}`;
}

function copyText(t) {
  const done = () => toast('Summary copied. You can paste it anywhere.', true);
  if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(t).then(done, () => toast('Could not copy on this browser.'));
  const a = document.createElement('textarea'); a.value = t; document.body.appendChild(a); a.select();
  try { document.execCommand('copy'); done(); } catch (e) { toast('Could not copy on this browser.'); }
  a.remove();
}

function honesty(w) {
  const f = w.flags, other = f.paste - f.pasteAns, s = [];
  if (f.pasteAns) s.push(`Pasted text in ${f.pasteAns} interview answer(s)`);
  if (other > 0) s.push(`Pasted text in ${other} other field(s)`);
  if (f.fast) s.push(`${f.fast} long answer(s) written unusually fast`);
  return { level: s.length ? 'review' : 'ok', signals: s };
}

function honestyHTML(r) {
  const h = r.honesty; if (!h) return '';
  return `<div class="honest ${h.level}"><strong>Authenticity check: ${h.level === 'ok' ? 'looks original' : 'review suggested'}</strong>
    ${h.signals.map(x => `<p>${esc(x)}</p>`).join('')}<p class="muted">This is a signal, not proof. A mentor can confirm it in a short live viva.</p></div>`;
}

function designHTML(r, withShots) {
  const d = r.decisions || [], w = S.work;
  const img = withShots && shots.before && w && w.pins.length ? `<div class="pinwrap" style="cursor:default"><img src="${shots.before}" alt="Your design with pins">${w.pins.map((p, i) => `<span class="pin" style="left:${p.x}%;top:${p.y}%">${i + 1}</span>`).join('')}</div>` : '';
  return d.length ? `<h3>Your design decisions</h3>${img}<ol>${d.map(x => `<li>${esc(x)}</li>`).join('')}</ol>` : '';
}

function agreement() {
  let t = 0, c = 0;
  S.reports.forEach(r => { if (r.mentor) r.rows.forEach((x, i) => { t++; if (Math.abs(x.score - r.mentor.scores[i]) <= 1) c++; }); });
  return t ? Math.round(c / t * 100) + '%' : null;
}

function mentorHTML(r) {
  const m = r.mentor, close = r.rows.filter((x, i) => Math.abs(x.score - m.scores[i]) <= 1).length;
  const df = n => n === 0 ? 'same' : (n > 0 ? '+' : '') + n;
  return `<h3>Mentor review by ${esc(m.name)}</h3>
    ${r.rows.map((x, i) => `<div class="mrow"><span>${x.name}</span><span>AI ${x.score}</span><span>Mentor ${m.scores[i]}</span><strong>${df(m.scores[i] - x.score)}</strong></div>`).join('')}
    <p><strong>Agreement:</strong> ${close} of ${r.rows.length} skills are within 1 point.</p>${m.comment ? `<p><strong>Comment:</strong> ${esc(m.comment)}</p>` : ''}`;
}

function mentorForm(id) {
  const r = S.reports.find(x => x.id === id); if (!r) return;
  const m = r.mentor;
  openModal(`<h2 id="mt">Mentor review</h2><p>Score each skill from 1 to 5, then compare with the AI.</p>
    <label for="mnm">Mentor name</label><input type="text" id="mnm" value="${esc(m ? m.name : '')}">
    ${r.rows.map((x, i) => `<label for="ms${i}">${x.name}</label><select id="ms${i}">${[1, 2, 3, 4, 5].map(n => `<option ${n === (m ? m.scores[i] : 3) ? 'selected' : ''}>${n}</option>`).join('')}</select>`).join('')}
    <label for="mcm">Comment</label><textarea id="mcm">${esc(m ? m.comment : '')}</textarea>
    <div class="actions"><button class="btn ghost" data-close>Cancel</button><button class="btn" data-act="savement" data-id="${id}">Save review</button></div>`);
}

function reportHTML(r, withShots) {
  return `<div class="rhead"><div class="ringscore" style="--p:${r.avg / 5 * 100}"><b>${r.avg}</b><small>out of 5</small></div><div><h2>${esc(r.title)}</h2><p class="muted" style="margin:0">SkillProof report, ${esc(r.date)} ${r.prevAvg != null ? dl(+(r.avg - r.prevAvg).toFixed(1)) : ''}</p></div></div>
    ${r.summary ? `<p class="summary">${esc(r.summary)}</p>` : ''}${r.ai === undefined ? '' : `<p><span class="aitag">${r.ai ? 'Scored by Claude AI. Evidence is checked against your own words.' : 'Scored with built-in rules. AI was not available.'}</span></p>`}
    <div class="radarbox">${radar(r.rows)}</div>
    ${designHTML(r, withShots)}
    ${r.rows.map(x => `<div class="score"><div><h3>${x.name}</h3><div class="bars ${x.score <= 2 ? 'lo' : x.score === 3 ? 'mid' : 'hi'}" aria-label="${x.score} out of 5">${[1, 2, 3, 4, 5].map(i => `<i class="${i <= x.score ? 'on' : ''}"></i>`).join('')}</div><strong>${x.score}/5</strong> ${dl(x.delta)}</div>
      <div><p><strong>Reason:</strong> ${esc(x.reason)}</p>${x.ev.trim() ? `<p><strong>Evidence:</strong> <mark>${esc(x.ev)}</mark></p>` : ''}</div></div>`).join('')}
    ${withShots && shots.before && shots.after ? `<h3>Before and after</h3><div class="compare"><img class="shot" src="${shots.before}" alt="First design"><img class="shot" src="${shots.after}" alt="Revised design"></div>` : ''}
    ${honestyHTML(r)}${r.mentor ? mentorHTML(r) : ''}
    <div class="panel accent" style="margin-top:20px"><h3>Next step</h3><p>Your lowest score is ${r.low.name.toLowerCase()} (${r.low.score}/5). ${r.low.tip}</p></div>`;
}

const aiOn = () => !!(sb && cfg.API_URL && S.user && S.user.id) && !AI.off && S.ai !== false;
const norm = t => String(t).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const curQ = i => (S.work.qs && S.work.qs[i]) || questions()[i];
const keep = () => { const y = window.scrollY; render(); window.scrollTo(0, y); };

let authBusy = false, shared = null;
const strip = r => { const { dbId, is_public, ...rest } = r; return rest; };
const rowToReport = row => ({ ...row.data, dbId: row.id, is_public: !!row.is_public });

async function callAI(path, body, signal) {
  const { data } = await sb.auth.getSession(), tok = data.session && data.session.access_token;
  if (!tok) throw { code: 'not_granted' };
  let r;
  try { r = await fetch(cfg.API_URL + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: JSON.stringify(body), signal }); }
  catch (e) { throw { code: e && e.name === 'AbortError' ? 'cancelled' : 'network' }; }
  if (r.status === 401) throw { code: 'not_granted' };
  if (r.status === 429) throw { code: 'rate_limited' };
  if (!r.ok) throw { code: 'error' };
  return r.json();
}

async function startSession() {
  const { data } = await sb.auth.getSession(), u = data.session && data.session.user;
  if (!u) return false;
  const m = u.user_metadata || {};
  S.user = { id: u.id, name: m.name || u.email.split('@')[0], email: u.email, role: m.role || 'College student' };
  const r = await sb.from('reports').select('id,data,is_public,created_at').order('created_at');
  S.reports = (r.data || []).map(rowToReport); save();
  return true;
}

function cloudSaveReport(rep) {
  sb.from('reports').insert({ user_id: S.user.id, challenge_id: rep.cid, title: rep.title, avg: rep.avg, data: strip(rep) }).select('id').single()
    .then(({ data, error }) => { if (error) return toast('Could not save the report to the cloud: ' + error.message); rep.dbId = data.id; save(); });
}

function cloudUpdateReport(rep) {
  if (!sb || !S.user || !rep.dbId) return;
  sb.from('reports').update({ data: strip(rep) }).eq('id', rep.dbId).then(({ error }) => { if (error) toast('Could not update the cloud copy: ' + error.message); });
}

async function shareReport(id) {
  const r = S.reports.find(x => x.id === id);
  if (!r || !r.dbId) return toast('The report is still saving. Try again in a moment.');
  const on = !r.is_public;
  const { error } = await sb.from('reports').update({ is_public: on }).eq('id', r.dbId);
  if (error) return toast('Could not change sharing: ' + error.message);
  r.is_public = on; save(); keep();
  if (!on) return toast('Sharing stopped.', true);
  const link = location.origin + location.pathname + '?r=' + r.dbId;
  if (navigator.clipboard) navigator.clipboard.writeText(link).catch(() => { });
  openModal(`<h2 id="mt">Your report is public</h2><p>Anyone with this link can view it:</p><p><strong style="word-break:break-all">${esc(link)}</strong></p><p class="muted">The link was copied. You can stop sharing any time.</p><div class="actions"><button class="btn" data-ok>Done</button></div>`);
}

function sharedView() {
  if (!shared || shared.state === 'loading') return '<div class="thinking"><div class="spin"></div><h2>Loading report…</h2></div>';
  if (shared.state === 'none') return '<div class="panel"><h2>Report not found</h2><p>This report is private or does not exist.</p><button class="btn" data-go="home">Go to SkillProof AI</button></div>';
  return `<div class="panel">${reportHTML(shared.r)}</div><div class="cta"><h2>Prove your own skills</h2><button class="btn" data-go="auth" data-tab="register">Get started</button></div>`;
}

function authMsg(m) {
  m = String(m || '');
  if (/not authorized/i.test(m)) return 'This email cannot receive mail yet: Supabase default email only sends to project team members. See README, custom SMTP.';
  if (/rate limit|too many|seconds/i.test(m)) return 'Too many emails were sent. Please wait a few minutes and try again.';
  if (/invalid login/i.test(m)) return 'Wrong email or password.';
  return m || 'Something went wrong. Please try again.';
}

function checkEmailModal(em, again) {
  $('#msg').hidden = true;
  openModal(`<div class="ring">@</div><h2 id="mt">${again ? 'Confirm your email first' : 'Check your email'}</h2>
    <p>We sent a confirmation link to <strong>${esc(em)}</strong>. Click it, then come back and log in.</p>
    <p class="muted">Not there? Look in spam, or send it again.</p>
    <div class="actions"><button class="btn ghost" data-act="resend" data-email="${esc(em)}">Resend email</button><button class="btn" data-ok>Got it</button></div>`);
}

async function resendEmail(em) {
  const { error } = await sb.auth.resend({ type: 'signup', email: em, options: { emailRedirectTo: location.origin + location.pathname } });
  toast(error ? authMsg(error.message) : 'Confirmation email sent again.', !error);
}

async function doAuth() {
  const reg = tab === 'register', nm = reg ? $('#nm').value.trim() : '', em = $('#em').value.trim().toLowerCase(), pw = $('#pw').value;
  const bad = (id, m) => { $(id).focus(); toast(m); };
  if (reg && !nm) return bad('#nm', 'Enter your full name.');
  if (!/^\S+@\S+\.\S+$/.test(em)) return bad('#em', 'Enter a valid email address, like name@example.com.');
  if (pw.length < 6) return bad('#pw', 'Password must be at least 6 characters.');
  if (!sb) { // demo mode: no Supabase configured, everything stays in this browser
    S.user = reg ? { name: nm, email: em, role: $('#rl').value }
      : (S.known && S.known.email === em ? S.known : { name: em.split('@')[0], email: em, role: 'College student' });
    save(); view = 'dashboard'; render(); if (reg) welcome(); return;
  }
  if (authBusy) return; authBusy = true; toast('Please wait…', true);
  try {
    if (reg) {
      const { data, error } = await sb.auth.signUp({ email: em, password: pw, options: { emailRedirectTo: location.origin + location.pathname, data: { name: nm, role: $('#rl').value } } });
      if (error) throw error;
      if (!data.session) { tab = 'login'; render(); return checkEmailModal(em); }
    } else {
      const { error } = await sb.auth.signInWithPassword({ email: em, password: pw });
      if (error) throw error;
    }
    await startSession(); $('#msg').hidden = true; view = 'dashboard'; render(); if (reg) welcome();
  } catch (e) { if (/not confirmed/i.test((e && e.message) || '')) return checkEmailModal(em, true); toast(authMsg(e && e.message)); }
  finally { authBusy = false; }
}

async function saveProfile() {
  const n = $('#pn').value.trim(); if (!n) { $('#pn').focus(); return toast('Name cannot be empty.'); }
  S.user.name = n; S.user.role = $('#pr').value; save();
  if (sb && S.user.id) {
    await sb.auth.updateUser({ data: { name: n, role: S.user.role } });
    await sb.from('profiles').update({ name: n, role: S.user.role }).eq('id', S.user.id);
  }
  render(); toast('Profile saved.', true);
}

function aiFail(e) {
  const c = e && e.code;
  if (c === 'not_granted' || c === 'images_unavailable') { AI.off = true; toast('AI feedback is turned off. Using built-in feedback instead.'); }
  else if (c === 'rate_limited') toast('AI is busy right now. Using built-in feedback for this step.');
  else toast('AI feedback did not work. Using built-in feedback for this step.');
}

function shrink(url, max = 1280) {
  return new Promise((ok, no) => {
    const im = new Image(); setTimeout(() => no({ code: 'bad_request' }), 8000);
    im.onload = () => { const k = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); ok(c.toDataURL('image/jpeg', 0.85).split(',')[1]); };
    im.onerror = () => no({ code: 'bad_request' }); im.src = url;
  });
}

function designAIPanel() {
  const w = S.work;
  if (!aiOn() || !AI.vision || !shots.before) return '';
  const v = w.designReview;
  return `<div class="panel aipanel"><h3>AI design feedback</h3>${v ? `<ul class="rv">${v.works.map(x => `<li class="ok">${esc(x)}</li>`).join('')}${v.issues.map(x => `<li class="bad">${esc(x)}</li>`).join('')}</ul>` : '<p class="muted">Let Claude look at your screenshot and point out what works and what to fix. Your image is sent to Claude.</p>'}
    <button class="btn ghost" data-act="aidesign" ${AI.busy ? 'disabled' : ''}>${AI.busy ? 'Claude is looking…' : v ? 'Review again' : 'Get AI feedback'}</button></div>`;
}

async function aiDesign() {
  const w = S.work; AI.busy = true; keep();
  try {
    const b64 = await shrink(shots.before);
    const out = await callAI('/api/design/review', { challenge: curChal().prompt, image_b64: b64 });
    w.designReview = { works: (out.works || []).slice(0, 2).map(String), issues: (out.issues || []).slice(0, 3).map(String) }; save();
  } catch (e) { aiFail(e); }
  AI.busy = false; if (S.work === w && view === 'work') keep();
}

async function aiReact(i) {
  const w = S.work, last = i === 3;
  const data = { challenge: curChal().prompt, audience: w.problem.audience, chosen_idea: w.ideas[w.pick].t, why_chosen: w.why, design_decisions: w.pins.map(p => p.note), ai_design_review: w.designReview, interview: w.interview.map(x => ({ question: x.q, answer: x.a })) };
  const out = await callAI('/api/interview/react', { ...data, last });
  return { r: String(out.reaction || '').trim().slice(0, 450), next: last ? '' : String(out.next_question || '').trim().slice(0, 300) };
}

async function aiScore(rule) {
  const w = S.work, im = w.improve;
  const data = { challenge: curChal().prompt, problem: w.problem, ideas: w.ideas.filter(x => x.t.trim()), chosen_idea: w.ideas[w.pick].t, why_chosen: w.why, design_decisions: w.pins.map(p => p.note), design_notes: w.notes, interview: w.interview.map(x => ({ question: x.q, answer: x.a })), tests: { testers: im.testers, finished_without_help: im.passed, feedback: im.feedback }, changes_after_feedback: im.changes, revised_design_uploaded: !!shots.after };
  AI.ctl = new AbortController();
  const out = await callAI('/api/report/score', data, AI.ctl.signal);
  const hay = norm(JSON.stringify(data));
  const rows = rule.rows.map((base, i) => {
    const s = (out.skills || []).find(x => String(x.name || '').toLowerCase() === base.name.toLowerCase());
    if (!s) return base;
    let score = Math.round(+s.score); if (!(score >= 1 && score <= 5)) return base;
    if (i === 2) score = Math.max(base.score - 1, Math.min(base.score + 1, score)); // usability stays close to the real test numbers
    const ev = String(s.evidence || '').trim();
    return { name: base.name, score, reason: String(s.reason || base.reason).slice(0, 260), ev: ev && hay.includes(norm(ev)) ? ev : base.ev, tip: String(s.tip || base.tip).slice(0, 200) };
  });
  return { rows, summary: String(out.summary || '').slice(0, 320) };
}

function saveReport(w, rows, ai, summary) {
  if (w.saved || S.work !== w) return;
  const c = curChal(), prev = S.reports.slice().reverse().find(x => x.cid === c.id);
  const avg = +(rows.reduce((a, r) => a + r.score, 0) / rows.length).toFixed(1), low = rows.slice().sort((a, b) => a.score - b.score)[0];
  w.rid = Date.now(); w.saved = true;
  S.reports.push({ id: w.rid, date: new Date().toLocaleDateString(), cid: c.id, title: c.title, avg, ai, summary,
    prevAvg: prev ? prev.avg : null, decisions: w.pins.map(p => p.note.trim() || 'No explanation added'), honesty: honesty(w),
    rows: rows.map(x => { const o = prev && prev.rows.find(p => p.name === x.name); return { name: x.name, score: x.score, reason: x.reason, ev: snip(x.ev, 160), tip: x.tip, delta: o ? x.score - o.score : null }; }),
    low: { name: low.name, score: low.score, tip: low.tip } });
  save();
  if (sb && S.user) cloudSaveReport(S.reports[S.reports.length - 1]);
}

function stepReport() {
  const w = S.work;
  if (!w.saved && !aiOn()) saveReport(w, buildReport().rows, false, '');
  if (!w.saved) {
    if (!AI.scoring) {
      AI.scoring = true;
      aiScore(buildReport()).then(o => saveReport(w, o.rows, true, o.summary),
        e => { if (!(e && e.code === 'cancelled')) aiFail(e); saveReport(w, buildReport().rows, false, ''); })
        .then(() => { AI.scoring = false; if (S.work === w && view === 'work') { render(); reportPopup(); } });
    }
    return `<div class="thinking"><div class="spin"></div><h2>Claude is reading your work…</h2><p class="muted">Scoring each skill and finding evidence in your own words. This can take up to a minute.</p>
      <button class="btn ghost" data-act="skipai">Skip AI and use built-in scoring</button></div>`;
  }
  return reportHTML(S.reports.find(x => x.id === w.rid), true) +
    `<div class="actions"><span class="row"><button class="btn ghost" data-act="print">Print report</button><button class="btn ghost" data-act="copyrep" data-id="${w.rid}">Copy summary</button></span><button class="btn" data-act="finish">Back to dashboard</button></div>`;
}

// ---------- validation + events ----------
function check() {
  const w = S.work, s = w.step;
  if (s === 0 && (w.problem.audience.trim().length < 10 || !w.problem.pains.length || w.problem.needs.trim().length < 10)) return 'Describe the audience, add one pain point, and write what users need.';
  if (s === 1 && (w.ideas.filter(x => x.t.trim()).length < 2 || !w.ideas[w.pick].t.trim() || w.why.trim().length < 15)) return 'Add at least two ideas, choose one that has a title, and explain why.';
  if (s === 2 && !shots.before && !w.figma.trim()) return 'Upload a screenshot or add a Figma link.';
  if (s === 3 && (w.interview.length < 4 || AI.busy)) return AI.busy ? 'Wait for the AI reply first.' : 'Answer all 4 interview questions.';
  if (s === 4 && (w.improve.feedback.trim().length < 10 || w.improve.changes.trim().length < 10)) return 'Write the feedback you got and what you changed.';
  return '';
}

let ansStart = 0;
document.addEventListener('paste', e => {
  const t = e.target; if (!S.work || view !== 'work' || t.tagName !== 'TEXTAREA' || t.closest('#modal')) return;
  S.work.flags.paste++; if (t.id === 'ans') S.work.flags.pasteAns++; save();
  toast('Pasted text noted. Please write in your own words. This will show in your report.');
});
document.addEventListener('input', e => { if (e.target.id === 'ans' && !ansStart) ansStart = Date.now(); const b = e.target.dataset.bind; if (b) { setp(S.work, b, e.target.type === 'number' ? +e.target.value : e.target.value); save(); } });

document.addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'aiToggle') { S.ai = t.checked; save(); }
  if (t.dataset.pick !== undefined) { S.work.pick = +t.dataset.pick; save(); render(); }
  if (t.dataset.shot && t.files[0]) {
    const f = t.files[0]; if (f.size > 4e6) return toast('Image is too large. Use one under 4 MB.');
    const rd = new FileReader(); rd.onload = () => { shots[t.dataset.shot] = rd.result; render(); }; rd.readAsDataURL(f);
  }
});

document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.closest('#authForm')) { e.preventDefault(); doAuth(); }
});

document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#modal').hidden) closeModal(); });

document.addEventListener('click', e => {
  if (e.target.id === 'modal' || e.target.closest('[data-close]')) return closeModal();
  const pimg = e.target.closest('.pinwrap img');
  if (pimg && S.work && view === 'work') {
    if (S.work.pins.length >= 6) return toast('You can add up to 6 pins.');
    const b = pimg.getBoundingClientRect();
    S.work.pins.push({ x: +((e.clientX - b.left) / (b.width || 1) * 100).toFixed(1), y: +((e.clientY - b.top) / (b.height || 1) * 100).toFixed(1), note: '' });
    save(); const y = window.scrollY; render(); window.scrollTo(0, y);
    const el = $('#pin' + (S.work.pins.length - 1)); if (el) el.focus({ preventScroll: true }); return;
  }
  const t = e.target.closest('button, a'); if (!t) return;
  const w = S.work, d = t.dataset;
  if (d.ok !== undefined) { const f = modalOk; closeModal(); if (f) f(); return; }
  if (t.id === 'burger') { const o = $('#top').classList.toggle('open'); t.setAttribute('aria-expanded', String(o)); return; }
  if (d.scroll) { closeModal(); view = 'home'; render(); document.getElementById(d.scroll)?.scrollIntoView?.({ behavior: 'smooth' }); return; }
  if (d.go) { closeModal(); e.preventDefault(); if (d.tab) tab = d.tab; view = d.go; return render(); }
  if (d.tab) { tab = d.tab; return render(); }
  if (t.id === 'logout') { if (sb) { sb.auth.signOut(); S.known = null; S.reports = []; S.work = null; } else S.known = S.user; S.user = null; save(); view = 'home'; return render(); }
  if (d.del !== undefined) { w.problem.pains.splice(+d.del, 1); save(); return render(); }
  if (d.act === 'auth') return doAuth();
  if (d.act === 'saveprof') return saveProfile();
  if (d.delpin !== undefined) { w.pins.splice(+d.delpin, 1); save(); const y = window.scrollY; render(); window.scrollTo(0, y); return; }
  if (d.act === 'mentor') return mentorForm(+d.id);
  if (d.act === 'share') return shareReport(+d.id);
  if (d.act === 'resend') return resendEmail(d.email);
  if (d.act === 'savement') {
    const r = S.reports.find(x => x.id === +d.id); if (!r) return;
    r.mentor = { name: $('#mnm').value.trim() || 'Mentor', scores: r.rows.map((_, i) => +$('#ms' + i).value), comment: $('#mcm').value.trim(), date: new Date().toLocaleDateString() };
    save(); cloudUpdateReport(r); closeModal(); render(); return toast('Mentor review saved.', true);
  }
  if (d.act === 'top') return window.scrollTo({ top: 0, behavior: 'smooth' });
  if (d.act === 'print') return window.print();
  if (d.act === 'aidesign') { if (!AI.busy) aiDesign(); return; }
  if (d.act === 'skipai') { if (AI.ctl) AI.ctl.abort(); return; }
  if (d.act === 'copyrep') { const r = S.reports.find(x => x.id === +d.id); return r && copyText(reportText(r)); }
  if (d.act === 'details') {
    const c = CHALLENGES.find(x => x.id === d.cid);
    return openModal(`<span class="tag lv-${c.level}">${c.level}</span><h2 id="mt">${esc(c.title)}</h2><p>${esc(c.prompt)}</p>
      <ul><li>Describe the users and their pain points</li><li>Explore at least two ideas</li><li>Upload your design</li><li>Answer 4 interview questions</li><li>Test it with real people and improve</li></ul>
      <div class="actions"><button class="btn ghost" data-close>Close</button><button class="btn" data-act="start" data-cid="${c.id}">Start challenge</button></div>`);
  }
  if (d.act === 'start') {
    closeModal();
    const begin = () => { S.work = blank(d.cid); shots.before = shots.after = null; save(); view = 'work'; render(); };
    if (w && w.step < 5 && w.cid === d.cid) { view = 'work'; return render(); }
    if (w && w.step < 5) return confirmBox('Switch challenge?', 'Another challenge is in progress. Starting this one will discard that progress.', 'Start new challenge', begin);
    return begin();
  }
  if (d.act === 'viewrep') { openReport = +d.id; view = 'report'; return render(); }
  if (d.act === 'wipe') return confirmBox('Delete your data?', 'All reports and progress in this browser will be deleted. This cannot be undone.', 'Delete', () => { if (sb && S.user) sb.from('reports').delete().eq('user_id', S.user.id).then(() => { }); S.reports = []; S.work = null; save(); render(); toast('Data deleted.', true); });
  if (d.act === 'addpain') { const v = $('#pain').value.trim(); if (v) { w.problem.pains.push(v); save(); render(); } return; }
  if (d.act === 'answer') {
    if (AI.busy) return;
    const a = $('#ans').value.trim(); if (!a) return toast('Write your answer first.');
    if (a.length >= 80 && (Date.now() - (ansStart || Date.now())) / 1000 < a.length / 12) w.flags.fast++;
    ansStart = 0;
    const i = w.interview.length, entry = { q: curQ(i), a, r: '' };
    w.interview.push(entry);
    if (!aiOn()) { entry.r = getAIReaction(a, i); save(); return render(); }
    AI.busy = true; save(); keep();
    aiReact(i).then(res => { entry.r = res.r || getAIReaction(a, i); if (res.next) w.qs[i + 1] = res.next; },
      e => { entry.r = getAIReaction(a, i); aiFail(e); })
      .then(() => { AI.busy = false; save(); if (S.work === w && view === 'work') keep(); });
    return;
  }
  if (d.act === 'back') { w.step--; save(); return render(); }
  if (d.act === 'next') {
    const err = check(); if (err) return toast(err);
    w.step++; save(); render();
    if (w.step === 5) { if (w.saved) reportPopup(); } else toast(STEPS[w.step - 1] + ' saved', true);
    return;
  }
  if (d.act === 'finish') { view = 'dashboard'; render(); }
});

(async () => {
  if (!sb) return;
  sb.auth.onAuthStateChange(ev => { if (ev === 'SIGNED_OUT' && S.user) { S.user = null; S.reports = []; S.work = null; save(); render(); } });
  const q = new URLSearchParams(location.search).get('r');
  let ok = false;
  try { ok = await startSession(); if (ok && (view === 'home' || view === 'auth')) view = 'dashboard'; } catch (e) { }
  if (q) {
    view = 'shared'; shared = { state: 'loading' }; render();
    try {
      const { data } = await sb.from('reports').select('id,data,is_public').eq('id', +q).eq('is_public', true).maybeSingle();
      shared = data ? { state: 'ok', r: rowToReport(data) } : { state: 'none' };
    } catch (e) { shared = { state: 'none' }; }
  }
  render();
  const hs = new URLSearchParams(HASH0.replace(/^#/, ''));
  if (HASH0) history.replaceState(null, '', location.pathname + location.search);
  if (ok && hs.get('type') === 'signup') { toast('Email confirmed. You are logged in.', true); welcome(); }
  else if (hs.get('error_description')) toast(hs.get('error_description') + '. Log in to get a new confirmation email.');
})();

render();
