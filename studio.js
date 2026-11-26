const el = id => document.getElementById(id);
const instruments = ['Piano','Gitar','Bass','Drum'];
let ctx, song, timer, start, position = 0, next = 0;
const pick = items => items[Math.floor(Math.random()*items.length)];
for (const name of instruments) {
  const label = document.createElement('label');
  label.innerHTML = '<input type="checkbox" checked value="'+name+'"> '+name;
  el('choices').append(label);
}

// Measured offsets from concert pitch for the bundled nylon guitar recordings.
const guitarCents = {"HighE:75:3": -23, "G:72:2": 1, "B:72:2": -24, "B:69:3": -22, "HighE:69:2": -14, "G:72:3": 9, "G:63:3": -6, "G:66:2": 3, "HighE:78:1": -26, "HighE:72:3": -15, "HighE:69:3": -14, "B:72:1": -27, "G:63:1": -9, "B:63:2": -10, "HighE:66:1": -7, "B:60:3": -1, "HighE:75:2": -24, "HighE:72:2": -16, "G:57:3": 7, "HighE:81:1": -31, "B:63:3": -1, "B:66:2": -19, "B:75:3": -19, "HighE:75:1": -25, "B:72:3": -22, "G:69:2": -3, "B:69:1": -32, "B:60:1": -7, "HighE:69:1": -15, "G:60:1": -6, "G:72:1": -4, "G:69:1": -2, "HighE:66:3": -7, "G:60:2": -5, "HighE:78:2": -24, "G:57:2": -1, "G:63:2": -7, "B:66:1": -22, "B:75:2": -25, "HighE:66:2": -7, "G:69:3": -2, "G:66:1": -1, "G:66:3": 13, "B:75:1": -24, "HighE:81:2": -22, "HighE:78:3": -19, "HighE:81:3": -20, "B:63:1": -9, "B:69:2": -26, "B:60:2": -5, "HighE:72:1": -16, "B:66:3": -14, "G:60:3": -5, "G:57:1": 1, "LowE:40:1": -7, "LowE:43:1": 6, "LowE:46:1": 0, "LowE:49:1": -5, "LowE:40:2": -7, "LowE:43:2": 4, "LowE:46:2": -4, "LowE:49:2": -6, "A:45:1": 3, "A:48:1": -2, "A:51:1": -7, "A:54:1": -5, "A:45:2": 3, "A:48:2": -1, "A:51:2": -4, "A:54:2": -4, "D:50:1": 0, "D:53:1": -9, "D:56:1": 1, "D:59:1": -5, "D:50:2": 0, "D:53:2": -5, "D:56:2": 1, "D:59:2": -7};
const bank = {};
async function loadBank(name) {
  if (bank[name]) return;
  bank[name]=await Promise.all(Object.entries(sampleData[name]).map(async ([key,data])=>{
    // Keys: Gitar "string:midi:layer", Piano "P:midi:layer", Bass "B:midi:layer:take",
    // Drum "name:layer:take" (or just "kick").
    const parts = key.split(':');
    const drum = name==='Drum';
    const bytes=Uint8Array.from(atob(data),c=>c.charCodeAt(0));
    return {string:parts[0],layer:Number(drum?parts[1]:parts[2])||1,key:drum?parts[0]:key,
      midi:drum?null:Number(parts[1]),buffer:await ctx.decodeAudioData(bytes.buffer)};
  }));
  // Remember each recording's peak so a firm pluck is not also louder than a soft one.
  for (const s of bank[name]) {
    let peak=0;
    for (let c=0;c<s.buffer.numberOfChannels;c++) for (const v of s.buffer.getChannelData(c)) peak=Math.max(peak,Math.abs(v));
    s.peak=peak||1;
  }
}
const tuning = { LowE:40, A:45, D:50, G:55, B:59, HighE:64 };
const grips = {
  0:{A:3,D:2,G:0,B:1,HighE:0},
  3:{LowE:1,A:3,D:3,G:2,B:1,HighE:1},
  4:{LowE:3,A:2,D:0,G:0,B:0,HighE:3},
  5:{A:0,D:2,G:2,B:1,HighE:0}
};
// ---- Akustik · Tenang: compose one song first, then hand roles to instruments ----
// Seeded random source so the same seed always gives the same song.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashName(text) {
  let h = 2166136261;
  for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}
let rand = Math.random;
const scaleSteps = [0, 2, 4, 5, 7, 9, 11];
const pitch = degree => song.key + scaleSteps[((degree % 7) + 7) % 7] + 12 * Math.floor(degree / 7);

// Hand-written four-bar kits for Akustik · Tenang. Chords are scale-degree roots
// (0 = I, 3 = IV, 4 = V, 5 = vi). Melody notes are [bar, onset, length, degree] in
// eighth notes, where degree 0 is the tonic and 7 the tonic an octave up.
// "a" kits carry the main tune; "b" kits are the contrasting middle.
const kits = [
  { name:'Pagi', kind:'a', chords:[0,4,5,3], melody:[
    [0,0,3,7],[0,3,1,6],[0,4,2,4],[0,6,2,5],
    [1,0,4,6],[1,4,2,4],[1,6,2,1],
    [2,0,3,2],[2,3,1,4],[2,4,4,5],
    [3,0,2,5],[3,2,2,4],[3,4,4,3]] },
  { name:'Jalan', kind:'a', chords:[0,5,3,4], melody:[
    [0,0,2,2],[0,2,2,4],[0,4,3,7],[0,7,1,6],
    [1,0,4,5],[1,4,2,7],[1,6,2,4],
    [2,0,2,3],[2,2,2,5],[2,4,3,7],[2,7,1,6],
    [3,0,6,6],[3,6,2,4]] },
  { name:'Teduh', kind:'a', chords:[0,3,0,4], melody:[
    [0,0,4,4],[0,4,2,2],[0,6,2,4],
    [1,0,4,5],[1,4,4,3],
    [2,0,2,2],[2,2,2,4],[2,4,2,7],[2,6,2,6],
    [3,0,6,4],[3,6,2,6]] },
  { name:'Sore', kind:'a', chords:[3,0,4,5], melody:[
    [0,0,2,7],[0,2,2,5],[0,4,4,3],
    [1,0,2,4],[1,2,2,2],[1,4,4,0],
    [2,0,2,1],[2,2,2,4],[2,4,4,6],
    [3,0,6,5],[3,6,2,4]] },
  { name:'Rindu', kind:'b', chords:[5,3,0,4], melody:[
    [0,0,2,5],[0,2,2,7],[0,4,4,9],
    [1,0,3,7],[1,3,1,6],[1,4,4,5],
    [2,0,2,4],[2,2,2,5],[2,4,4,7],
    [3,0,4,4],[3,4,4,1]] },
  { name:'Langit', kind:'b', chords:[5,4,3,4], melody:[
    [0,0,3,9],[0,3,1,8],[0,4,4,7],
    [1,0,3,8],[1,3,1,6],[1,4,4,4],
    [2,0,2,5],[2,2,2,7],[2,4,4,10],
    [3,0,4,8],[3,4,4,6]] },
  { name:'Embun', kind:'a', chords:[0,3,5,4], melody:[
    [0,0,2,4],[0,2,2,2],[0,4,4,7],
    [1,0,3,5],[1,3,1,4],[1,4,2,3],[1,6,2,5],
    [2,0,2,7],[2,2,2,6],[2,4,4,5],
    [3,0,3,4],[3,3,1,5],[3,4,4,6]] },
  { name:'Kabut', kind:'a', chords:[0,4,3,4], melody:[
    [0,0,4,9],[0,4,2,7],[0,6,2,4],
    [1,0,2,8],[1,2,2,6],[1,4,4,4],
    [2,0,2,5],[2,2,2,7],[2,4,3,10],[2,7,1,9],
    [3,0,6,8],[3,6,2,6]] },
  { name:'Senja', kind:'a', chords:[0,5,3,4], melody:[
    [0,0,3,2],[0,3,1,4],[0,4,3,7],[0,7,1,6],
    [1,0,3,5],[1,3,1,7],[1,4,4,9],
    [2,0,3,7],[2,3,1,5],[2,4,3,3],[2,7,1,5],
    [3,0,4,4],[3,4,4,6]] },
  { name:'Pelangi', kind:'a', chords:[0,0,3,4], melody:[
    [0,0,2,0],[0,2,2,2],[0,4,2,4],[0,6,2,2],
    [1,0,4,4],[1,4,2,7],[1,6,2,4],
    [2,0,2,5],[2,2,2,3],[2,4,2,0],[2,6,2,3],
    [3,0,6,1],[3,6,2,4]] },
  { name:'Hujan', kind:'b', chords:[3,0,5,4], melody:[
    [0,0,4,10],[0,4,2,7],[0,6,2,8],
    [1,0,3,9],[1,3,1,8],[1,4,4,7],
    [2,0,2,9],[2,2,2,7],[2,4,2,5],[2,6,2,7],
    [3,0,4,8],[3,4,4,6]] },
  { name:'Angin', kind:'b', chords:[5,0,3,4], melody:[
    [0,0,3,9],[0,3,1,7],[0,4,4,5],
    [1,0,2,4],[1,2,2,7],[1,4,4,9],
    [2,0,3,10],[2,3,1,9],[2,4,4,7],
    [3,0,2,8],[3,2,2,6],[3,4,4,4]] }
];

// Song characters. Each seed picks one, so two songs differ in far more than the
// tune: melody rhythm, guitar and piano accompaniment, drums and tempo.
//   feel: 'asli' as written, 'panjang' only the strong-beat notes held long,
//         'rapat' long notes split with a step to the next note.
// weight: how often a style is picked. The listener liked Santai most and found
// Jalan pagi least fitting for a calm song, so the fast styles moved to Ceria.
const styles = [
  { name:'Santai',     mood:'Tenang', weight:3, feel:'panjang', bpm:[62,68], guitar:'petik',    piano:'blok',  drum:'tipis' },
  { name:'Mengalir',   mood:'Tenang', weight:1, feel:'rapat',   bpm:[74,80], guitar:'petik',    piano:'pecah', drum:'lembut' },
  { name:'Teduh',      mood:'Tenang', weight:1, feel:'panjang', bpm:[70,76], guitar:'genjreng', piano:'blok',  drum:'lembut' },
  { name:'Sederhana',  mood:'Tenang', weight:1, feel:'asli',    bpm:[74,82], guitar:'petik',    piano:'blok',  drum:'lembut' },
  { name:'Jalan pagi', mood:'Ceria',  weight:1, feel:'asli',    bpm:[90,98], guitar:'genjreng', piano:'pecah', drum:'jalan' },
  { name:'Ringan',     mood:'Ceria',  weight:1, feel:'rapat',   bpm:[84,90], guitar:'genjreng', piano:'blok',  drum:'jalan' }
];
function pickStyle(mood, r) {
  const pool = styles.filter(s => s.mood === mood);
  let x = r() * pool.reduce((sum, s) => sum + s.weight, 0);
  return pool.find(s => (x -= s.weight) < 0) ?? pool[0];
}
function applyFeel(notes, feel) {
  if (feel === 'panjang') {
    // Strong-beat notes are always chord tones, so keeping only them stays in tune.
    const kept = notes.filter(n => n[0] % 4 === 0);
    return kept.map((n, i) => [n[0], (kept[i + 1]?.[0] ?? 8) - n[0], n[2]]);
  }
  if (feel === 'rapat') {
    const out = [];
    notes.forEach(([onset, len, degree], i) => {
      const next = notes[i + 1]?.[2] ?? degree;
      // Step toward the next note on the weak beat; same note next means step up and back.
      const step = next > degree ? 1 : next < degree ? -1 : 1;
      if (len === 4 || len === 6) {
        out.push([onset, 2, degree], [onset + 2, 2, degree + step]);
        if (len === 6) out.push([onset + 4, 2, degree]);
      } else out.push([onset, len, degree]);
    });
    return out;
  }
  return notes;
}

// Song form: every phrase (four bars) gets a section.
//   intro  chords only                 A, Av  main tune (Av: melody rhythm varied)
//   B, B2  contrasting middle, fuller  C, Cv  a second main tune, for long songs
//   pause  thin: tune and chords only  outro  main tune with the ending
// Short songs come out as A Av B Av ... like before; long songs walk further
// through the cycle so the music keeps changing.
const formCycle = ['A','Av','B','Av','C','Cv','B2','A','pause','Av','B','A'];
function songForm(phrases) {
  const form = phrases >= 6 ? ['intro'] : [];
  const fill = phrases - form.length - 1;
  for (let i = 0; i < fill; i++) form.push(formCycle[i % formCycle.length]);
  form.push('outro');
  return form;
}
const otherFeel = { panjang:'asli', asli:'rapat', rapat:'asli' };

// Song plan shared by every instrument: chord per bar and one melody line.
// Built from the kits above; depends only on the seed, never on the instruments.
function planSong(bars) {
  const r = rng(song.seed);
  const choose = list => list[Math.floor(r() * list.length)];
  // song.onlyKit (a kit name) plays that single kit throughout, for auditioning kits.
  const solo = kits.find(k => k.name === song.onlyKit);
  const main = solo ?? choose(kits.filter(k => k.kind === 'a'));
  const middle = solo ?? choose(kits.filter(k => k.kind === 'b'));
  // Second tunes for long songs (picked after the first two so short songs stay the same).
  const main2 = solo ?? choose(kits.filter(k => k.kind === 'a' && k !== main));
  const middle2 = solo ?? choose(kits.filter(k => k.kind === 'b' && k !== middle));
  const kitFor = { intro:main, A:main, Av:main, outro:main, pause:main, B:middle, B2:middle2, C:main2, Cv:main2 };
  const phrases = bars / 4;
  const form = songForm(phrases);
  const harmony = [], melody = [], used = [];
  let turn = -1, firstTune = true;
  for (let bar = 0; bar < bars; bar++) {
    const phrase = Math.floor(bar / 4), pos = bar % 4, last = phrase === phrases - 1;
    const section = form[phrase], kit = kitFor[section];
    if (pos === 0 && !used.includes(kit.name)) used.push(kit.name);
    // energy 0: no bass or drums; 1: normal; 2: fuller.
    let energy = section === 'B' || section === 'B2' || section === 'Cv' ? 2 : 1;
    if (section === 'intro' || section === 'pause') energy = 0;
    if (section !== 'intro' && pos === 0) {
      turn++;
      // The tune is heard once on its own before bass and drums come in.
      if (firstTune) { energy = 0; firstTune = false; }
    } else if (section !== 'intro' && harmony.length) energy = harmony[harmony.length - 1].energy;
    let root = kit.chords[pos];
    let notes = section === 'intro' ? [] : kit.melody.filter(n => n[0] === pos).map(([, onset, len, degree]) => [onset, len, degree]);
    if (last && pos === 2 && song.ending === 'kadens') {
      // Final cadence: V for one bar, then home on I.
      root = 4;
      notes = [[0,2,4],[2,2,6],[4,4,8]];
    }
    if (last && pos === 3) {
      // 'kit' ending keeps the kit's own third bar and lands on the nearest tonic.
      const before = melody[bar - 1]?.at(-1)?.[2] ?? 7;
      root = 0;
      notes = [[0,8,song.ending === 'kit' && before < 4 ? 0 : 7]];
    }
    const feel = section === 'Av' || section === 'Cv' ? otherFeel[song.style.feel] : song.style.feel;
    if (!(last && pos >= 2)) notes = applyFeel(notes, feel);
    harmony.push({ root, phrase, pos, section, energy, turn: Math.max(0, turn),
      lift: energy === 2 || kit.kind === 'b', cadence: last && pos === 2, final: bar === bars - 1 });
    melody.push(notes);
  }
  return { harmony, melody, kitNames: used };
}

// ---- Klasik: a Bach chorale arranged for the chosen instruments ----
// Voices: 0 soprano (tune), 1 alto, 2 tenor (inner parts), 3 bass.
function arrangeChorale(name) {
  const has = n => song.tracks.some(t => t.name === n);
  const voicesFor = {
    Piano: has('Gitar') ? [0, ...(has('Bass') ? [] : [3])] : [0,1,2, ...(has('Bass') ? [] : [3])],
    Gitar: has('Piano') ? [1,2] : [0,1,2, ...(has('Bass') ? [] : [3])],
    Bass: [3],
    Drum: []
  }[name];
  const events = [];
  let offset = 0;
  for (let pass = 0; pass < song.passes.length; pass++) {
    const piece = song.passes[pass];
    if (pass) offset += song.passes[pass - 1].len / 2;
    const lastPass = pass === song.passes.length - 1;
    for (const v of voicesFor) {
      for (const [start, len, midi] of piece.voices[v]) {
        const ending = lastPass && start + len >= piece.len;
        const level = name === 'Gitar' ? (v === 0 ? .66 : .5) : name === 'Bass' ? .3 : v === 0 ? .42 : .24;
        events.push({ step: offset + start / 2, note: name === 'Bass' ? midi - 12 : midi,
          len: ending ? len / 2 + 3 : len / 2, level: level * (.94 + .06 * rand()),
          delay: (v === 0 ? .02 : .008) + rand() * .008 });
      }
    }
    if (name === 'Drum' && pass > 0) {
      for (let s = 0; s < piece.len / 2; s += 8) {
        events.push({ step: offset + s, note: 'kick', len: .6, level: .3, delay: 0 });
        events.push({ step: offset + s + 4, note: 'hat', len: .2, level: .12, delay: .01 });
      }
    }
  }
  return events;
}

// Who plays what in a bar, given the active instruments.
function roles(bar) {
  const has = name => song.tracks.some(t => t.name === name);
  const { turn, energy } = song.harmony[bar];
  const both = has('Piano') && has('Gitar');
  // song.pianoMelody keeps the tune on piano and the guitar accompanying throughout.
  const melody = both ? (song.pianoMelody || turn % 2 === 0 ? 'Piano' : 'Gitar') : has('Piano') ? 'Piano' : has('Gitar') ? 'Gitar' : null;
  const chords = both ? (melody === 'Piano' ? 'Gitar' : 'Piano') : melody;
  // Bass and drums play only in sections with energy (not in the intro, the first
  // statement of the tune, or the thin pause).
  const ensemble = energy >= 1 || !melody;
  return { melody, chords, bass: has('Bass') && ensemble, drums: has('Drum') && ensemble };
}

// Pattern choices per instrument, shown in each track row. "Buat ulang" steps
// through the variations of the chosen pattern (variant number).
const partOptions = {
  Gitar: { petik:'Petik', genjreng:'Genjreng' },
  Piano: { blok:'Akor', pecah:'Akor dipecah' },
  Bass:  { tahan:'Panjang', dua:'Dua nada' },
  Drum:  { lembut:'Lembut', tipis:'Tipis', jalan:'Berjalan' }
};
const variationCount = { Gitar:{ petik:3, genjreng:2 }, Piano:{ blok:3, pecah:3 }, Bass:{ tahan:2, dua:2 }, Drum:{ lembut:2, tipis:2, jalan:2 } };

function fingerpick(events, bar, root, final, lift, quiet, turn, noBass, v = 0) {
  const grip = grips[root];
  const strings = Object.keys(grip);
  const capo = song.key - 60;
  function pluck(step, string, level, delay = 0) {
    events.push({ step: bar * 8 + step, string, note: tuning[string] + grip[string] + capo,
      level: level * (.96 + .08 * rand()), delay: delay + .004 * rand(), len: 3 });
  }
  // Keep the low string when the bass comes in, only softer, so the guitar does not thin out.
  pluck(0, strings[0], noBass ? .48 : .60);
  if (final) {
    ['D','G','B','HighE'].forEach((string, i) => pluck(0, string, .47 - i * .02, .045 * (i + 1)));
    return;
  }
  const soft = quiet ? .9 : 1;
  if (v === 1) {
    // Rolling up and back down across the treble strings.
    [[1,'G',.43],[2,'B',.5],[3,'HighE',.55],[4,'D',.52],[5,'HighE',.5],[6,'B',.47],[7,'G',.42]]
      .forEach(([step, string, level]) => pluck(step, string, level * soft, .015));
    return;
  }
  if (v === 2) {
    // Steady thumb on the low strings, fingers answering in between.
    pluck(0, 'HighE', .5 * soft, .02);
    pluck(2, 'D', .5); pluck(4, strings[0], noBass ? .44 : .52); pluck(6, 'D', .48);
    [[1,'G',.42],[3,'B',.48],[5,'HighE',.5],[7,'B',.44]].forEach(([step, string, level]) => pluck(step, string, level * soft, .015));
    return;
  }
  const summit = bar % 4 === 2 ? 'HighE' : 'B';
  pluck(1, 'G', .43, .018);
  pluck(2, summit, quiet ? .50 : .64, .024);
  if (lift || turn === 1) pluck(3, 'G', .41, .013);
  pluck(4, 'D', .55);
  if (bar % 4 === 3) {
    pluck(5, 'HighE', quiet ? .5 : .61, .021);
    pluck(6, 'B', .51, .025);
  } else {
    pluck(turn === 0 ? 5 : 6, quiet ? 'G' : 'HighE', quiet ? .43 : .60, .022);
    if (!quiet) pluck(7, 'B', .46, .012);
  }
}

// Soft strummed guitar: whole chord, down strokes low to high, light up strokes on top.
function strum(events, bar, root, final, noBass, v = 0) {
  const grip = grips[root];
  const capo = song.key - 60;
  let strings = Object.keys(grip);
  const hit = (step, up, level) => {
    const set = up ? strings.slice(-3).reverse() : strings;
    set.forEach((string, i) => events.push({ step: bar * 8 + step, string,
      note: tuning[string] + grip[string] + capo, level: level * (.95 + .08 * rand()),
      delay: i * (up ? .011 : .016) + .004 * rand(), len: 3 }));
  };
  if (final) { hit(0, false, strumLevel * 1.05); return; }
  const rhythm = v === 1
    ? [[0,false,1.05],[2,false,.8],[4,false,1],[5,true,.7],[6,false,.85],[7,true,.7]]
    : [[0,false,1.05],[3,true,.8],[4,false,1],[6,false,.9],[7,true,.75]];
  for (const [step, up, level] of rhythm) hit(step, up, strumLevel * level);
}

// Mix balance measured per bar (RMS): the tune must stay loudest, drums sit lowest.
// Without these the drums buried the guitar melody once they came in.
const trackTrim = { Bass:6, Drum:.45 };
const gitarMelodyBoost = 4.5;
const guitarPeak = .13;
const strumLevel = .3;
const arpLevel = .17;
function arrange(name, variant = 0) {
  rand = rng(song.seed ^ hashName(name) ^ Math.imul(variant + 1, 2654435761));
  const bars = song.harmony.length;
  const events = [];
  const turn = rand() < .5 ? 0 : 1;
  const part = song.parts?.[name];
  const v = part ? variant % variationCount[name][part] : 0;
  const alone = song.tracks.length === 1;
  for (let bar = 0; bar < bars; bar++) {
    const { root, lift, cadence, final } = song.harmony[bar];
    const role = roles(bar);
    // boost scales loudness only, without changing which recorded layer is used.
    const add = (beat, note, len, level, delay = 0, boost = 1) => events.push({
      step: bar * 8 + beat, note, len, level: level * (.94 + .06 * rand()), delay: delay + rand() * .008, boost });
    const playMelody = (octave, base, boost = 1) => {
      for (const [onset, len, degree] of song.melody[bar]) {
        const strong = onset % 4 === 0;
        add(onset, pitch(degree) + octave, final ? 7.6 : len, base + (strong ? .06 : 0), strong ? .03 : .015, boost);
      }
    };
    if (name === 'Piano') {
      if (role.melody === 'Piano') playMelody(0, .40);
      if (role.chords === 'Piano' && part === 'pecah') {
        // Broken chord in eighths; the pedal keeps it ringing as one wash.
        // Every shape uses only root, fifth, octave and the third above (chord tones).
        const shapes = [[0,4,7,9,7,4,7,4],[0,4,7,4,9,4,7,4],[0,7,4,9,4,7,4,9]];
        const shape = final ? [0,4,7,9] : shapes[v];
        const soft = role.melody === 'Piano' ? .75 : 1;
        shape.forEach((x, i) => add(i, pitch(root + x) - 12, final ? 7.5 : 1, arpLevel * soft * (i % 4 === 0 ? 1.15 : 1), .01));
      } else if (role.chords === 'Piano' && v > 0 && !final) {
        // Repeated chords: on beats one and three, or gently pushed off the beat.
        const soft = role.melody === 'Piano' ? 1 : .85;
        const notes = role.bass ? [root + 2, root + 4, root + 7] : [root, root + 4, root + 7];
        const hits = v === 1 ? [[0,4,1],[4,4,.85]] : [[0,3,1],[3,3,.8],[6,2,.75]];
        for (const [step, len, level] of hits)
          notes.forEach((x, i) => add(step, pitch(x) - 12, len, (i ? .17 : .22) * soft * level, .01 + i * .012));
      } else if (role.chords === 'Piano') {
        const soft = role.melody === 'Piano' ? 1 : .85;
        if (!role.bass) {
          // No bass yet: the left hand carries the root itself.
          add(0, pitch(root) - 12, final ? 7.5 : 7, .30 * soft);
          add(2, pitch(root + 4) - 12, final ? 5.5 : 5, .20 * soft, .02);
        } else {
          // Bass owns the root, so the left hand moves up to the third and fifth.
          add(0, pitch(root + 2) - 12, final ? 7.5 : 6.5, .21 * soft, .02);
          add(0, pitch(root + 4) - 12, final ? 7.5 : 6.5, .19 * soft, .05);
        }
        if (role.melody !== 'Piano' && !final) add(4, pitch(root + 7) - 12, 3.5, .17, .02);
      }
    } else if (name === 'Gitar') {
      if (role.melody === 'Gitar') {
        playMelody(0, .5, gitarMelodyBoost);
        if (role.chords !== 'Gitar') {
          // Thumb notes under the tune, as a fingerstyle player would, so the guitar
          // does not turn into a bare single-note instrument.
          const capo = song.key - 60, grip = grips[root];
          const thumb = (beat, string, level) => events.push({ step: bar * 8 + beat, string,
            note: tuning[string] + grip[string] + capo, level: level * (.95 + .08 * rand()), delay: .004 * rand(), len: 3 });
          thumb(0, 'D', .46);
          if (!final) thumb(4, 'G', .4);
        }
      }
      if (role.chords === 'Gitar') {
        const quiet = role.melody !== 'Gitar' || alone;
        if (part === 'genjreng') strum(events, bar, root, final, role.bass, v);
        else fingerpick(events, bar, root, final, lift, quiet, turn, role.bass, v);
      }
    } else if (name === 'Bass' && role.bass) {
      const two = part === 'dua' && !final;
      add(0, pitch(root) - 24, final ? 7.5 : two ? 3.8 : v === 1 ? 5.8 : 7.6, final ? .30 : .32, .01);
      if (two) add(4, pitch(root + 4) - 24, v === 1 ? 1.8 : 3.6, .29, .01);
      // Variation: a short octave note leading into the next bar.
      if (v === 1 && !final) add(6, pitch(root) - 12, 1.6, .26, .01);
    } else if (name === 'Drum' && role.drums && part === 'tipis') {
      add(0, 'kick', .65, final ? .26 : .3);
      if (!final && !cadence) add(4, v === 1 ? 'rim' : 'hat', .22, v === 1 ? .09 : .1);
    } else if (name === 'Drum' && role.drums && part === 'jalan') {
      add(0, 'kick', .65, final ? .30 : .36);
      if (final) continue;
      for (let s = 1; s < 8; s++) if (v === 0 || s % 2 === 0) add(s, 'hat', .2, s % 2 ? .06 : .08);
      add(4, 'kick', .5, .22);
      if (!cadence) { if (v === 0) add(2, 'rim', .3, .12); add(6, 'rim', .3, .11); }
    } else if (name === 'Drum' && role.drums) {
      add(0, 'kick', .65, final ? .30 : .36);
      if (final) continue;
      add(2, 'hat', .22, .13);
      if (v === 1) add(5, 'kick', .4, .2);
      if (!cadence) {
        if (lift) add(4, 'snare', .34, .18);
        add(6, 'hat', .22, .11);
      }
    }
  }
  return events;
}
function compose(name) {
  if (song.chorale) {
    rand = rng(song.seed ^ hashName(name) ^ Math.imul((song.variants[name] ?? 0) + 1, 2654435761));
    return arrangeChorale(name);
  }
  if (song.harmony) return arrange(name, song.variants?.[name] ?? 0);
  const {genre, minor, chords, key} = song;
  const events = [];
  const scale = minor ? [0,2,3,5,7,8,10] : [0,2,4,5,7,9,11];
  const pitch = degree => key+scale[degree%7]+12*Math.floor(degree/7);
  const rhythm = pick([[0,3,4,6],[0,2,5,7],[0,2,4,7]]);
  const bars=Math.ceil(song.duration/(song.step*8));
  const motif=pick([[0,2,4,2,7,4,2,4],[4,2,0,2,4,7,4,2],[0,4,2,7,4,2,4,0]]);
  for(let bar=0; bar<bars; bar++) {
    const ending=bar===bars-1;
    const root = ending?0:chords[bar%4];
    for(let step=0; step<8; step++) {
      if(ending && step>0) continue;
      if(bar===0 && step%2 && genre!=='Pop') continue;
      const add = (note,len,level=1) => events.push({step:bar*8+step,note,len:ending?6:len,level:level*(.83+Math.random()*.17)*(bar===0?.8:1),delay:Math.random()*.012});
      if(name==='Piano' && (step===0 || step===pick([4,6]))) {
        for(const interval of [0,2,4]) add(pitch(root+interval),2.6,.45);
      }
      if(name==='Gitar' && (genre==='Akustik' || rhythm.includes(step))) add(pitch(root+motif[(step+(bar%4===3?2:0))%8]),1.25,.75);
      if(name==='Bass' && (step===0 || rhythm.slice(1).includes(step) && Math.random()<.65)) add(pitch(root+(step===7?4:0))-24,1.7);
      if(name==='Drum') {
        if(step===0 || step===4 || step===7 && Math.random()<.3) add('kick',1);
        if(step===2 || step===6) add('snare',.65);
        if(step%2===0 || Math.random()<(genre==='Pop'?.85:.45)) add('hat',.35,.35);
      }
    }
  }
  return events;
}

function articulateGuitar(events) {
  const samples = bank.Gitar;

  const ringing = new Map();
  const previous = new Map();
  const bars = Math.round(song.duration/(song.step*8));
  function chord(bar) {
    if (bar === bars-1) return 0;
    if (song.harmony) return song.harmony[bar].root;
    return song.chords[bar%4];
  }
  for (const event of events.slice().sort((a,b)=>onset(a)-onset(b))) {
    const at = onset(event);
    // Firm plucks only: the softest recordings sounded like a weak fretting hand.
    // Melody notes use the same recordings as the accompaniment so the guitar keeps one voice.
    const layer = event.boost > 1 || event.level < .55 ? 2 : 3;
    const playable = samples.filter(s => tuning[s.string]<=event.note && (!event.string || s.string===event.string));
    // Low strings were only recorded soft and medium, so take the firmest they have.
    const firmest = Math.min(layer, ...playable.map(s=>s.layer).filter((v,i,a)=>a.indexOf(v)===i).sort().slice(-1));
    const choices = playable.filter(s => s.layer===firmest);
    // A melody note (no fixed string) is played low on the neck, as a guitarist would,
    // instead of high up on a middle string.
    const fret = s => event.note - tuning[s.string] - (song.key - 60);
    const score = s => Math.abs(s.midi-event.note)
      + (event.string ? 0 : Math.max(0, fret(s) - 5))
      + (previous.get(event.note)===s.string ? 2 : 0)
      + (at-(ringing.get(s.string)?.at ?? -10)<.10 ? 12 : 0);
    const sample = choices.reduce((a,b)=>score(a)<=score(b)?a:b);
    const last = ringing.get(sample.string);
    if (last && at-last.at < last.event.ring) {
      // Same string plucked again: the new note takes over quickly but not with a click.
      last.event.ring = Math.max(.009,at-last.at);
      last.event.release = .07;
    }
    let boundary = Math.floor(event.step/8)+1;
    while(boundary<bars) {
      const sameChord = chord(boundary)===chord(boundary-1);
      const heldFret = event.string && grips[chord(boundary)][event.string] === event.note-tuning[event.string]-(song.key-60);
      if (!sameChord && !heldFret) break;
      boundary++;
    }
    event.ring = Math.max(.03,Math.min(total(),onset({step:boundary*8,delay:0}))-at);
    // Let a chord's notes die away gently when the hand moves to the next chord.
    event.release = .3;
    event.sample = sample;
    previous.set(event.note,sample.string);
    ringing.set(sample.string,{event,at});
  }
  return events;
}
function pattern(name) {
  const events = compose(name);
  if (name === 'Piano' && song.harmony) {
    // Sustain pedal: each note keeps sounding until the chord changes at the bar line.
    for (const e of events) e.len = Math.max(e.len, Math.floor(e.step / 8) * 8 + 8 - e.step);
  }
  return name === 'Gitar' ? articulateGuitar(events) : events;
}
// Choose the recorded dynamic layer from how hard the note is played, then the
// nearest pitch, then rotate between alternate takes so repeats never sound identical.
const layerSteps = { Piano:[.2,.3,.42], Bass:[.31], Drum:[.15,.25] };
function pickSample(name,samples,event) {
  const pool = name==='Drum' ? samples.filter(s=>s.key===event.note) : samples;
  const maxLayer = Math.max(...pool.map(s=>s.layer));
  const wanted = Math.min(maxLayer,1+(layerSteps[name]??[]).filter(t=>event.level>=t).length);
  const layered = pool.filter(s=>s.layer===wanted);
  const choices = layered.length ? layered : pool;
  let best = choices;
  if (name!=='Drum') {
    const gap = s=>Math.abs(s.midi-event.note);
    const nearest = Math.min(...choices.map(gap));
    best = choices.filter(s=>gap(s)===nearest);
  }
  const turn = Math.floor(event.step*3+(typeof event.note==='number'?event.note:0)) % best.length;
  return best[turn];
}
function voice(track,event,when,audio=ctx,remaining=total()-(when-start)) {
  const drum = track.name==='Drum';
  const samples = bank[track.name];
  const sample = event.sample ?? pickSample(track.name,samples,event);
  const source = audio.createBufferSource();
  source.buffer = sample.buffer;
  const rate = drum ? 1 : 2 ** ((event.note - sample.midi) / 12);
  source.playbackRate.value = rate;
  if (track.name === 'Gitar') source.detune.value = -(guitarCents[sample.key] ?? 0);
  const release = event.release ?? ({ Piano:.58, Gitar:.07, Bass:.16, Drum:.03 })[track.name];
  const length = Math.min(remaining, sample.buffer.duration/rate,
    event.ring != null ? event.ring + release : drum ? sample.buffer.duration : event.len * song.step + release);
  if (length < .01) return;
  const gain = audio.createGain();
  const tone = audio.createBiquadFilter();
  tone.type = 'lowpass';
  tone.Q.value = .35;
  tone.frequency.value = Math.min(audio.sampleRate*.45, 1900 + 13500 * Math.min(1,event.level));
  if (track.name === 'Piano') source.connect(gain);
  else source.connect(tone).connect(gain);
  gain.connect(track.bus);
  // Recorded layers already carry most of the loudness change, so scale gain gently.
  // Guitar loudness follows the played level, not the recording's own volume.
  const shaped = track.name==='Gitar' ? event.level * guitarPeak / sample.peak : Math.sqrt(event.level*.4);
  const peak = ({ Piano:.55, Gitar:.59, Bass:.68, Drum:.62 })[track.name] * shaped
    * (trackTrim[track.name] ?? 1) * (event.boost ?? 1);
  gain.gain.setValueAtTime(peak,when);
  gain.gain.setValueAtTime(peak,when+Math.max(.002,length-release));
  if (track.name === 'Piano') gain.gain.linearRampToValueAtTime(0,when+length);
  else gain.gain.exponentialRampToValueAtTime(.0001,when+length);
  if (audio === ctx && track.sources) track.sources.push(source);
  source.start(when);
  source.stop(when+length);
  // Let finished notes drop out of the audio graph so long songs stay light.
  source.onended = () => gain.disconnect();
}

function clock(t) {return Math.floor(t/60)+':'+String(Math.floor(t%60)).padStart(2,'0')}
// Extra seconds after the last beat so the final chord can fade out naturally.
const tail = 3;
const total = () => song.duration + tail + (song.ritard ? song.step * 3 : 0);
function display(t) {el('time').textContent=clock(t)+' / '+clock(total())}
function halt(offset=0) {
  clearInterval(timer);
  timer=null;
  position=offset;
  for(const track of song.tracks) {track.bus?.disconnect();for(const src of track.sources || []) src.stop();track.sources=[];track.bus=null}
  song.master?.disconnect();
  display(position);
  el('play').textContent=position?'Lanjutkan':'Putar';
}
function onset(event) {
  const beat = event.step;
  let feel = 0;
  if (song.genre === 'Lo-fi' && beat % 2) feel = song.step * .12;
  if (song.genre === 'Akustik' && song.mood === 'Tenang') {
    const phase = beat % 32 / 32;
    feel = song.step * (.09 * Math.sin(2*Math.PI*phase) + (beat % 2 ? .045 : 0));
  }
  // Optional slowing down over the last two bars (ritardando).
  const slow = song.ritard ? Math.max(0, beat - (song.bars - 2) * 8) : 0;
  return beat * song.step + feel + event.delay + song.step * .35 * slow * slow / 32;
}

// Notes are handed to the audio engine a few seconds ahead of time, not all at once:
// every waiting note costs processing time until it has played.
const lookahead = 4;
function scheduleTrack(track, offset) {
  track.sources = [];
  track.bus = trackBus(ctx, track, song.master);
  track.queue = track.events.map(e => [onset(e), e]).filter(([at]) => at >= offset).sort((a, b) => a[0] - b[0]);
  track.next = 0;
  pump(track);
}
function pump(track) {
  const horizon = ctx.currentTime - start + lookahead;
  while (track.next < track.queue.length && track.queue[track.next][0] < horizon) {
    const [at, event] = track.queue[track.next++];
    voice(track, event, start + at, ctx, total() - at);
  }
}

function play() {
  song.master=masterBus(ctx);
  start = ctx.currentTime + .06 - position;
  for (const track of song.tracks) scheduleTrack(track,position);
  el('play').textContent = 'Jeda';
  timer = setInterval(() => {
    const elapsed = ctx.currentTime - start;
    if (elapsed >= total()) halt();
    else {
      display(Math.max(0,elapsed));
      for (const track of song.tracks) if (track.bus) pump(track);
    }
  },100);
}
// Build the song for the chosen settings. Akustik · Tenang is fully seeded:
// the same seed gives the same chords and melody for any set of instruments.
function newSong({genre,mood,duration,names,seed,source='kit',onlyKit=null,pianoMelody=false,force={}}) {
  const bpm=({Tenang:78,Ceria:112,Melankolis:68})[mood]+({'Lo-fi':-6,Akustik:0,Pop:10})[genre];
  const r=rng(seed), choose=list=>list[Math.floor(r()*list.length)];
  song={genre,mood,seed,duration,source,onlyKit,pianoMelody,step:30/bpm,minor:mood==='Melankolis',
    key:choose([60,62,65,67]),chords:choose([[0,3,5,4],[0,5,3,4],[0,4,5,3]]),
    tracks:names.map(name=>({name,events:[],volume:.7,muted:false})),harmony:null,variants:{}};
  if (source==='klasik') {
    // Calm chorale tempo; repeat the piece to fill the chosen length, stretching slightly.
    song.chorale=choose(chorales);
    const steps=song.chorale.len/2;
    const repeats=Math.max(1,Math.round(duration/(steps*.42)));
    // Short songs repeat one chorale; long ones play several, each twice, so it keeps moving.
    song.passes=Array(repeats).fill(song.chorale);
    if (repeats > 3) {
      song.passes=[];
      let total=0, piece=song.chorale;
      const left=chorales.filter(c=>c!==piece);
      const target=duration/.42;
      while (total < target) {
        // Stop instead of overshooting badly with one more long chorale.
        if (total > target*.85 && total+piece.len > target*1.1) break;
        song.passes.push(piece,piece); total+=piece.len;
        const remaining=target-total;
        // Near the end, take the chorale whose length fits what is left best.
        const pickAt=remaining < Math.max(...left.map(c=>c.len)) && left.length
          ? left.reduce((best,c,i)=>Math.abs(c.len-remaining)<Math.abs(left[best].len-remaining)?i:best,0)
          : Math.floor(r()*left.length);
        piece=left.splice(pickAt,1)[0] ?? song.chorale;
      }
      // Keep a calm chorale tempo; the length moves a little instead.
      song.step=.42;
      song.duration=(total+3)*song.step;
    } else song.step=duration/(song.passes.reduce((sum,p)=>sum+p.len/2,0)+3);
    for (const track of song.tracks) track.events=pattern(track.name);
    return song;
  }
  // Kit songs cover Akustik in the moods that have styles (Tenang, Ceria).
  const acoustic=genre==='Akustik' && styles.some(s=>s.mood===mood);
  if (acoustic) {
    // Character of this song; separate random stream so kits and key stay as before.
    const r2=rng(seed^0x51ed), pick2=list=>list[Math.floor(r2()*list.length)];
    song.style=styles.find(s=>s.name===force.style) ?? pickStyle(mood,r2);
    const [lo,hi]=song.style.bpm;
    song.step=30/(lo+r2()*(hi-lo));
    song.ending=force.ending ?? pick2(['kadens','kit']);
    // Each instrument starts with the style's pattern; the listener can change any of them.
    song.parts={Gitar:song.style.guitar, Piano:song.style.piano, Drum:song.style.drum, Bass:'tahan', ...force.parts};
    song.ritard=force.ritard ?? r2()<.5;
    if (force.key) song.key=force.key;
  }
  const raw=song.duration/(8*song.step);
  const bars=acoustic ? Math.max(4,Math.round(raw/4)*4) : Math.max(2,Math.round(raw));
  // Kit songs keep the style's tempo and let the length move a few seconds instead.
  if (acoustic) song.duration=8*bars*song.step;
  else song.step=song.duration/(8*bars);
  song.bars=bars;
  if (acoustic) {
    Object.assign(song,planSong(bars));
    song.variants={};
  }
  for (const track of song.tracks) track.events=pattern(track.name);
  return song;
}
let versions=[];
function describe(s) {
  const what = s.chorale ? 'Korale Bach #'+[...new Set(s.passes.map(p=>p.id))].join(', #') : s.kitNames ? 'Gaya '+s.style.name+' · Kit '+s.kitNames.join(' + ') : s.genre+' · '+s.mood;
  return what+' · '+Math.round(30/s.step)+' BPM · seed '+s.seed;
}
function showVersion(i) {
  if (!versions[i]) return;
  if (song && timer) halt();
  position=0;
  song=versions[i];
  ['versionA','versionB'].forEach((id,j)=>el(id).classList.toggle('primary',j===i));
  render();play();
  el('message').textContent='Versi '+'AB'[i]+': '+describe(song);
}
el('versionA').onclick=()=>showVersion(0);
el('versionB').onclick=()=>showVersion(1);
// Rebuild one instrument and swap it in while playing; the other tracks are untouched.
function refresh(track) {
  track.events=pattern(track.name);
  if (!timer) return;
  const old=track.bus;
  for (const src of track.sources) src.stop(ctx.currentTime+.35);
  old.gain.setTargetAtTime(0,ctx.currentTime,.05);
  setTimeout(()=>old.disconnect(),350);
  scheduleTrack(track,Math.max(0,ctx.currentTime-start));
}
function partLabel(name) {
  const part=song.parts?.[name];
  if (!part) return '';
  const count=variationCount[name][part], v=(song.variants[name]??0)%count;
  return partOptions[name][part]+(count>1?' · variasi '+(v+1)+' dari '+count:'');
}
function render() {
  el('tracks').replaceChildren();
  for(const track of song.tracks) {
    const name=track.name;
    const row=document.createElement('div');
    row.className='track';
    row.innerHTML='<strong>'+name+'</strong><label>Volume <input type="range" min="0" max="100"></label><label><input type="checkbox"> Bisukan</label><button>Buat ulang</button>';
    const [volume,mute]=row.querySelectorAll('input');
    volume.value=Math.round(track.volume*100); mute.checked=track.muted;
    const mix=()=>{track.volume=volume.value/100;track.muted=mute.checked;if(track.bus) track.bus.gain.setTargetAtTime(track.muted?0:track.volume,ctx.currentTime,.01)};
    volume.oninput=mix; mute.onchange=mix;
    // Pattern choice for this instrument (kit songs only).
    if (song.parts?.[name]) {
      const label=document.createElement('label');
      label.textContent='Pola ';
      const select=document.createElement('select');
      for (const [value,text] of Object.entries(partOptions[name])) select.add(new Option(text,value,false,value===song.parts[name]));
      // Piano patterns only apply while the piano accompanies.
      const used=name!=='Piano' || song.harmony.some((_,bar)=>roles(bar).chords==='Piano');
      select.disabled=!used;
      if (!used) label.title='Piano sedang membawa melodi sepanjang lagu, jadi pola iringan tidak dipakai.';
      label.append(select);
      row.querySelector('strong').after(label);
      select.onchange=()=>{song.parts[name]=select.value;song.variants[name]=0;refresh(track);el('message').textContent=name+': '+partLabel(name)+'.'};
    }
    row.querySelector('button').onclick=()=>{
      song.variants[name]=(song.variants[name]??0)+1;
      refresh(track);
      el('message').textContent=song.parts?.[name] ? name+': '+partLabel(name)+'.' : 'Pola '+name.toLowerCase()+' diperbarui.';
    };
    el('tracks').append(row);
  }
  el('studio').hidden=false;
}
el('settings').onsubmit=async e=>{
  e.preventDefault();
  const names=[...el('choices').querySelectorAll(':checked')].map(n=>n.value);
  if(!names.length){el('message').textContent='Pilih minimal satu instrumen.';return}
  try {
    ctx ??= new AudioContext();
    el('settings').querySelector('button').disabled=true;
    el('studio').inert=true;
    await ctx.resume();
    await Promise.all(names.map(loadBank));
    if(song) halt();
    const genre=el('genre').value, mood=el('mood').value, source=el('source').value;
    // Both melody styles were liked for different reasons, so the listener picks per song.
    const pianoMelody=el('melody').value==='piano';
    const seed=Math.floor(Math.random()*1e9);
    el('message').textContent='Menyiapkan versi A dan B…'+(Number(el('duration').value)>=180?' Lagu panjang butuh sekitar setengah menit.':'');
    // Two versions with neighbouring seeds; the listener simply keeps the one they like.
    versions=[];
    for (const s of [seed,seed+1]) {
      newSong({genre,mood,duration:Number(el('duration').value),names,seed:s,source,pianoMelody});
      song.masterGain=mixGain(await renderMix(false));
      versions.push(song);
    }
    showVersion(0);
  } catch {el('message').textContent='Audio gagal dimulai. Coba lagi di browser yang mendukung Web Audio.'} finally {el('studio').inert=false;el('settings').querySelector('button').disabled=false}
};
el('play').onclick=async()=>{if(timer) halt(Math.max(0,ctx.currentTime-start));else {await ctx.resume();play()}};



const ceilingCurve = Float32Array.from({length:8193},(_,i)=>{
  const x = (i-4096)/4096;
  const magnitude = Math.abs(x);
  return magnitude <= .78 ? x : Math.sign(x)*(.78+.11*Math.tanh((magnitude-.78)/.11));
});
// ---- Mix: room echo, left/right placement and final loudness ----
// pan: -1 left .. 1 right. room: how much of the instrument is sent into the room echo.
const placement = { Piano:{pan:-.22, room:.24}, Gitar:{pan:.26, room:.2}, Bass:{pan:0, room:.04}, Drum:{pan:.04, room:.12} };
const roomLevel = .8;
// YouTube plays music at about -14 LUFS; quieter songs are not turned up, so aim there.
const targetLoudness = -14;
// A small room: soft noise that fades over about two seconds and darkens as it fades.
// Seeded, so the same song always renders the same way.
function roomImpulse(audio) {
  const rate = audio.sampleRate, length = Math.floor(rate * 2.4), pre = Math.floor(rate * .018);
  const buffer = audio.createBuffer(2, length, rate);
  for (let c = 0; c < 2; c++) {
    const r = rng(1234 + c), data = buffer.getChannelData(c);
    let low = 0;
    for (let i = pre; i < length; i++) {
      const t = (i - pre) / rate, k = Math.min(.9, .25 + t * .5);
      low = low * k + (r() * 2 - 1) * (1 - k);
      data[i] = low * Math.exp(-t * 3.2) * Math.min(1, t / .004);
    }
  }
  return buffer;
}
// raw: unity gain and no ceiling, used to measure the mix before setting its level.
function masterBus(audio, raw = false) {
  const input = audio.createGain();
  input.gain.value = raw ? 1 : song.masterGain;
  const room = audio.createConvolver();
  room.buffer = roomImpulse(audio);
  const wet = audio.createGain();
  wet.gain.value = roomLevel;
  room.connect(wet).connect(input);
  input.room = room;
  if (raw) input.connect(audio.destination);
  else {
    const ceiling = audio.createWaveShaper();
    ceiling.curve = ceilingCurve;
    input.connect(ceiling).connect(audio.destination);
  }
  return input;
}
function trackBus(audio, track, master) {
  const bus = audio.createGain();
  bus.gain.value = track.muted ? 0 : track.volume;
  const spot = placement[track.name] ?? { pan:0, room:.15 };
  const pan = audio.createStereoPanner();
  pan.pan.value = spot.pan;
  const send = audio.createGain();
  send.gain.value = spot.room;
  bus.connect(pan).connect(master);
  bus.connect(send).connect(master.room);
  return bus;
}
// Integrated loudness in LUFS (ITU-R BS.1770: K-weighting, 400 ms blocks, gating).
function loudness(buffer) {
  const fs = buffer.sampleRate;
  const biquad = (b, a) => x => {
    const y = new Float32Array(x.length);
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < x.length; i++) {
      const v = (b[0] * x[i] + b[1] * x1 + b[2] * x2 - a[1] * y1 - a[2] * y2) / a[0];
      x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
    }
    return y;
  };
  let w = 2 * Math.PI * 1681.974450955533 / fs, A = 10 ** (3.999843853973347 / 40);
  let al = Math.sin(w) / (2 * .7071752369554196), c = Math.cos(w), sq = 2 * Math.sqrt(A) * al;
  const shelf = biquad([A * ((A + 1) + (A - 1) * c + sq), -2 * A * ((A - 1) + (A + 1) * c), A * ((A + 1) + (A - 1) * c - sq)],
    [(A + 1) - (A - 1) * c + sq, 2 * ((A - 1) - (A + 1) * c), (A + 1) - (A - 1) * c - sq]);
  w = 2 * Math.PI * 38.13547087602444 / fs; al = Math.sin(w) / (2 * .5003270373238773); c = Math.cos(w);
  const high = biquad([(1 + c) / 2, -(1 + c), (1 + c) / 2], [1 + al, -2 * c, 1 - al]);
  const channels = [];
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) channels.push(high(shelf(buffer.getChannelData(ch))));
  const size = Math.floor(.4 * fs), hop = Math.floor(.1 * fs), blocks = [];
  for (let at = 0; at + size <= buffer.length; at += hop) {
    let sum = 0;
    for (const y of channels) { let e = 0; for (let i = at; i < at + size; i++) e += y[i] * y[i]; sum += e / size; }
    blocks.push(sum);
  }
  const lufs = z => -.691 + 10 * Math.log10(z);
  const mean = list => list.reduce((a, b) => a + b, 0) / list.length;
  const loud = blocks.filter(z => lufs(z) > -70);
  if (!loud.length) return -70;
  const relative = lufs(mean(loud)) - 10;
  const gated = loud.filter(z => lufs(z) > relative);
  return lufs(mean(gated));
}
// Look-ahead peak limiter for the exported file: turns brief peaks down smoothly so the
// whole song can reach YouTube loudness. Peaks never pass `ceilingDb`.
const ceilingDb = -1.5;
function limit(buffer, gain) {
  const n = buffer.length, data = [...Array(buffer.numberOfChannels)].map((_, c) => buffer.getChannelData(c));
  const thr = 10 ** (ceilingDb / 20), look = Math.floor(buffer.sampleRate * .005), win = 2 * look;
  const release = 1 - Math.exp(-1 / (buffer.sampleRate * .15));
  const need = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let peak = 0;
    for (const d of data) peak = Math.max(peak, Math.abs(d[i] * gain));
    need[i] = peak > thr ? thr / peak : 1;
  }
  // Lowest gain needed anywhere in the next `win` samples (sliding minimum).
  const ahead = new Float32Array(n), queue = [];
  for (let i = n - 1; i >= 0; i--) {
    while (queue.length && need[queue[queue.length - 1]] >= need[i]) queue.pop();
    queue.push(i);
    while (queue[0] > i + win - 1) queue.shift();
    ahead[i] = need[queue[0]];
  }
  // Drop at once (the look-ahead gives time), recover slowly, then smooth the curve.
  const env = new Float32Array(n);
  let g = 1;
  for (let i = 0; i < n; i++) { g = Math.min(ahead[i], g + (1 - g) * release); env[i] = g; }
  let sum = look * env[0], deepest = 1;
  const out = new AudioBuffer({ length: n, numberOfChannels: data.length, sampleRate: buffer.sampleRate });
  const outData = data.map((_, c) => out.getChannelData(c));
  for (let i = 0; i < n; i++) {
    sum += env[i] - (i >= look ? env[i - look] : env[0]);
    const smooth = sum / look;
    deepest = Math.min(deepest, smooth);
    for (let c = 0; c < data.length; c++) outData[c][i] = data[c][i] * gain * smooth;
  }
  out.deepestDb = 20 * Math.log10(deepest);
  return out;
}
// Final file: reach the target loudness, but never squash peaks by more than `maxSquashDb`.
const maxSquashDb = 6;
function master(raw) {
  let gain = 10 ** ((targetLoudness - loudness(raw)) / 20), out;
  for (let pass = 0; pass < 3; pass++) {
    out = limit(raw, gain);
    // Move toward the target loudness, but back off if peaks would be squashed too hard.
    gain *= Math.min(10 ** ((targetLoudness - loudness(out)) / 20), 10 ** ((out.deepestDb + maxSquashDb) / 20));
  }
  out = limit(raw, gain);
  out.loudness = loudness(out);
  return out;
}
// Gain for listening in the app: as loud as the target allows without touching the ceiling.
function mixGain(buffer) {
  let peak = 0;
  for (let c = 0; c < buffer.numberOfChannels; c++) for (const v of buffer.getChannelData(c)) peak = Math.max(peak, Math.abs(v));
  if (peak < .00001) return 1;
  return Math.min(10 ** ((targetLoudness - loudness(buffer)) / 20), 1 / peak);
}
async function renderMix(normalized) {
    const audio=new OfflineAudioContext(2,Math.ceil(total()*44100),44100);
    const output=masterBus(audio,!normalized);
    const items=[];
    for(const track of song.tracks){
      if(track.muted) continue;
      const lane={...track,bus:trackBus(audio,track,output)};
      for(const event of track.events) items.push([onset(event),lane,event]);
    }
    items.sort((a,b)=>a[0]-b[0]);
    // Feed notes in slices while rendering, a step ahead, instead of all up front.
    let next=0;
    const feed=until=>{
      while(next<items.length && items[next][0]<until){
        const [when,lane,event]=items[next++];
        voice(lane,event,when,audio,total()-when);
      }
    };
    feed(lookahead*2);
    for(let t=lookahead;t<total()-.1;t+=lookahead) audio.suspend(t).then(()=>{feed(t+lookahead*2);audio.resume()});
    return audio.startRendering();
}
function wav(buffer) {
  const channels=buffer.numberOfChannels, size=buffer.length*channels*2;
  const bytes=new ArrayBuffer(44+size), view=new DataView(bytes);
  const tag=(offset,str)=>[...str].forEach((c,i)=>view.setUint8(offset+i,c.charCodeAt(0)));
  tag(0,'RIFF');view.setUint32(4,36+size,true);tag(8,'WAVE');tag(12,'fmt ');
  view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,channels,true);
  view.setUint32(24,buffer.sampleRate,true);view.setUint32(28,buffer.sampleRate*channels*2,true);
  view.setUint16(32,channels*2,true);view.setUint16(34,16,true);tag(36,'data');view.setUint32(40,size,true);
  for(let ch=0;ch<channels;ch++){
    const data=buffer.getChannelData(ch);
    for(let i=0;i<data.length;i++) view.setInt16(44+2*(i*channels+ch),Math.round(Math.max(-1,Math.min(1,data[i]))*32767),true);
  }
  return new Blob([bytes],{type:'audio/wav'});
}
el('export').onclick=async()=>{
  const button=el('export');
  button.disabled=true;
  try {
    const url=URL.createObjectURL(wav(master(await renderMix(false))));
    const link=document.createElement('a');link.href=url;link.download='music-maker.wav';link.click();
    setTimeout(()=>URL.revokeObjectURL(url),60000);
  } catch {el('message').textContent='Ekspor gagal. Coba ulangi atau pilih durasi lebih pendek.'}
  finally {button.disabled=false}
};






















