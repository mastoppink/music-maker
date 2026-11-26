const el = id => document.getElementById(id);
const instruments = ['Piano','Gitar','Bass','Drum'];
let ctx, song, timer, start, position = 0, next = 0;
const pick = items => items[Math.floor(Math.random()*items.length)];
for (const name of instruments) {
  const label = document.createElement('label');
  label.innerHTML = '<input type="checkbox" '+(name==='Piano'?'':'checked')+' value="'+name+'"> '+name;
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

// Song plan shared by every instrument: chord per bar and one melody line.
// Built from the kits above; depends only on the seed, never on the instruments.
function planSong(bars) {
  const r = rng(song.seed);
  const choose = list => list[Math.floor(r() * list.length)];
  // song.onlyKit (a kit name) plays that single kit throughout, for auditioning kits.
  const solo = kits.find(k => k.name === song.onlyKit);
  const main = solo ?? choose(kits.filter(k => k.kind === 'a'));
  const middle = solo ?? choose(kits.filter(k => k.kind === 'b'));
  const phrases = bars / 4;
  // Main tune first, contrast in the middle, main tune again at the end.
  const order = [];
  for (let p = 0; p < phrases; p++) {
    const contrast = phrases >= 4 && p % 4 === 2;
    order.push(contrast ? middle : main);
  }
  const harmony = [], melody = [];
  for (let bar = 0; bar < bars; bar++) {
    const phrase = Math.floor(bar / 4), pos = bar % 4, last = phrase === phrases - 1;
    const kit = order[phrase];
    let root = kit.chords[pos];
    let notes = kit.melody.filter(n => n[0] === pos).map(([, onset, len, degree]) => [onset, len, degree]);
    if (last && pos === 2) {
      // Final cadence: V for one bar, then home on I.
      root = 4;
      notes = [[0,2,4],[2,2,6],[4,4,8]];
    }
    if (last && pos === 3) {
      root = 0;
      notes = [[0,8,7]];
    }
    harmony.push({ root, phrase, pos, lift: kit.kind === 'b' || phrase % 2 === 1,
      cadence: last && pos === 2, final: bar === bars - 1 });
    melody.push(notes);
  }
  return { harmony, melody, kitNames: [main.name, middle.name] };
}

// ---- Klasik: a Bach chorale arranged for the chosen instruments ----
// Voices: 0 soprano (tune), 1 alto, 2 tenor (inner parts), 3 bass.
function arrangeChorale(name) {
  const piece = song.chorale;
  const has = n => song.tracks.some(t => t.name === n);
  const voicesFor = {
    Piano: has('Gitar') ? [0, ...(has('Bass') ? [] : [3])] : [0,1,2, ...(has('Bass') ? [] : [3])],
    Gitar: has('Piano') ? [1,2] : [0,1,2, ...(has('Bass') ? [] : [3])],
    Bass: [3],
    Drum: []
  }[name];
  const events = [];
  for (let pass = 0; pass < song.repeats; pass++) {
    const offset = pass * piece.len / 2;
    const lastPass = pass === song.repeats - 1;
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
  const { phrase } = song.harmony[bar];
  const both = has('Piano') && has('Gitar');
  const melody = both ? (phrase % 2 === 0 ? 'Piano' : 'Gitar') : has('Piano') ? 'Piano' : has('Gitar') ? 'Gitar' : null;
  const chords = both ? (melody === 'Piano' ? 'Gitar' : 'Piano') : melody;
  // Bass and drums join after the first phrase so the tune is heard alone first.
  const ensemble = bar >= 4 || !melody;
  return { melody, chords, bass: has('Bass') && ensemble, drums: has('Drum') && ensemble };
}

function fingerpick(events, bar, root, final, lift, quiet, turn, noBass) {
  const grip = grips[root];
  const strings = Object.keys(grip);
  const capo = song.key - 60;
  function pluck(step, string, level, delay = 0) {
    events.push({ step: bar * 8 + step, string, note: tuning[string] + grip[string] + capo,
      level: level * (.96 + .08 * rand()), delay: delay + .004 * rand(), len: 3 });
  }
  // With a bass player present the guitar leaves its lowest string to the bass.
  if (!noBass) pluck(0, strings[0], .60);
  if (final) {
    ['D','G','B','HighE'].forEach((string, i) => pluck(0, string, .47 - i * .02, .045 * (i + 1)));
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

function arrange(name, variant = 0) {
  rand = rng(song.seed ^ hashName(name) ^ Math.imul(variant + 1, 2654435761));
  const bars = song.harmony.length;
  const events = [];
  const turn = rand() < .5 ? 0 : 1;
  const alone = song.tracks.length === 1;
  for (let bar = 0; bar < bars; bar++) {
    const { root, lift, cadence, final } = song.harmony[bar];
    const role = roles(bar);
    const add = (beat, note, len, level, delay = 0) => events.push({
      step: bar * 8 + beat, note, len, level: level * (.94 + .06 * rand()), delay: delay + rand() * .008 });
    const playMelody = (octave, base) => {
      for (const [onset, len, degree] of song.melody[bar]) {
        const strong = onset % 4 === 0;
        add(onset, pitch(degree) + octave, final ? 7.6 : len, base + (strong ? .06 : 0), strong ? .03 : .015);
      }
    };
    if (name === 'Piano') {
      if (role.melody === 'Piano') playMelody(0, .40);
      if (role.chords === 'Piano') {
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
      if (role.melody === 'Gitar') playMelody(0, .63);
      if (role.chords === 'Gitar') {
        const quiet = role.melody !== 'Gitar' || alone;
        fingerpick(events, bar, root, final, lift, quiet, turn, role.bass);
      }
    } else if (name === 'Bass' && role.bass) {
      add(0, pitch(root) - 24, final ? 7.5 : 5.5, final ? .30 : .32, .01);
    } else if (name === 'Drum' && role.drums) {
      add(0, 'kick', .65, final ? .30 : .36);
      if (final) continue;
      add(2, 'hat', .22, .13);
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
    const layer = event.level < .56 ? 1 : event.level < .69 ? 2 : 3;
    const choices = samples.filter(s => s.layer===layer && tuning[s.string]<=event.note && (!event.string || s.string===event.string));
    const score = s => Math.abs(s.midi-event.note)
      + (previous.get(event.note)===s.string ? 2 : 0)
      + (at-(ringing.get(s.string)?.at ?? -10)<.10 ? 12 : 0);
    const sample = choices.reduce((a,b)=>score(a)<=score(b)?a:b);
    const last = ringing.get(sample.string);
    if (last) last.event.ring = Math.min(last.event.ring,Math.max(.009,at-last.at));
    let boundary = Math.floor(event.step/8)+1;
    while(boundary<bars) {
      const sameChord = chord(boundary)===chord(boundary-1);
      const heldFret = event.string && grips[chord(boundary)][event.string] === event.note-tuning[event.string]-(song.key-60);
      if (!sameChord && !heldFret) break;
      boundary++;
    }
    event.ring = Math.max(.03,Math.min(song.duration,onset({step:boundary*8,delay:0}))-at);
    event.sample = sample;
    previous.set(event.note,sample.string);
    ringing.set(sample.string,{event,at});
  }
  return events;
}
function pattern(name) {
  const events = compose(name);
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
function voice(track,event,when,audio=ctx,remaining=song.duration-(when-start)) {
  const drum = track.name==='Drum';
  const samples = bank[track.name];
  const sample = event.sample ?? pickSample(track.name,samples,event);
  const source = audio.createBufferSource();
  source.buffer = sample.buffer;
  const rate = drum ? 1 : 2 ** ((event.note - sample.midi) / 12);
  source.playbackRate.value = rate;
  if (track.name === 'Gitar') source.detune.value = -(guitarCents[sample.key] ?? 0);
  const release = ({ Piano:.58, Gitar:.045, Bass:.10, Drum:.03 })[track.name];
  const length = Math.min(remaining, sample.buffer.duration/rate,
    event.ring ?? (drum ? sample.buffer.duration : event.len * song.step + release));
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
  const shaped = track.name==='Gitar' ? event.level : Math.sqrt(event.level*.4);
  const peak = ({ Piano:.55, Gitar:.59, Bass:.68, Drum:.62 })[track.name] * shaped;
  gain.gain.setValueAtTime(peak,when);
  gain.gain.setValueAtTime(peak,when+Math.max(.002,length-release));
  if (track.name === 'Piano') gain.gain.linearRampToValueAtTime(0,when+length);
  else gain.gain.exponentialRampToValueAtTime(.0001,when+length);
  if (audio === ctx && track.sources) track.sources.push(source);
  source.start(when);
  source.stop(when+length);
}

function clock(t) {return Math.floor(t/60)+':'+String(Math.floor(t%60)).padStart(2,'0')}
function display(t) {el('time').textContent=clock(t)+' / '+clock(song.duration)}
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
  return beat * song.step + feel + event.delay;
}

function scheduleTrack(track, offset) {
  track.sources = [];
  track.bus = ctx.createGain();
  track.bus.gain.value = track.muted ? 0 : track.volume;
  track.bus.connect(song.master);
  for (const event of track.events) {
    const at = onset(event);
    if (at >= offset) voice(track,event,start+at,ctx,song.duration-at);
  }
}

function play() {
  song.master=masterBus(ctx);
  start = ctx.currentTime + .06 - position;
  for (const track of song.tracks) scheduleTrack(track,position);
  el('play').textContent = 'Jeda';
  timer = setInterval(() => {
    const elapsed = ctx.currentTime - start;
    if (elapsed >= song.duration) halt();
    else display(Math.max(0,elapsed));
  },100);
}
// Build the song for the chosen settings. Akustik · Tenang is fully seeded:
// the same seed gives the same chords and melody for any set of instruments.
function newSong({genre,mood,duration,names,seed,source='kit',onlyKit=null}) {
  const bpm=({Tenang:78,Ceria:112,Melankolis:68})[mood]+({'Lo-fi':-6,Akustik:0,Pop:10})[genre];
  const r=rng(seed), choose=list=>list[Math.floor(r()*list.length)];
  song={genre,mood,seed,duration,source,onlyKit,step:30/bpm,minor:mood==='Melankolis',
    key:choose([60,62,65,67]),chords:choose([[0,3,5,4],[0,5,3,4],[0,4,5,3]]),
    tracks:names.map(name=>({name,events:[],volume:.7,muted:false})),harmony:null,variants:{}};
  if (source==='klasik') {
    // Calm chorale tempo; repeat the piece to fill the chosen length, stretching slightly.
    song.chorale=choose(chorales);
    const steps=song.chorale.len/2;
    song.repeats=Math.max(1,Math.round(duration/(steps*.42)));
    song.step=duration/(song.repeats*steps+3);
    for (const track of song.tracks) track.events=pattern(track.name);
    return song;
  }
  const acoustic=genre==='Akustik' && mood==='Tenang';
  const raw=song.duration/(8*song.step);
  const bars=acoustic ? Math.max(4,Math.round(raw/4)*4) : Math.max(2,Math.round(raw));
  song.step=song.duration/(8*bars);
  if (acoustic) {
    Object.assign(song,planSong(bars));
    song.variants={};
  }
  for (const track of song.tracks) track.events=pattern(track.name);
  return song;
}
let versions=[];
function describe(s) {
  const what = s.chorale ? 'Korale Bach #'+s.chorale.id : s.kitNames ? 'Kit '+s.kitNames.join(' + ') : s.genre+' · '+s.mood;
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
function render() {
  el('tracks').replaceChildren();
  for(const track of song.tracks) {
    const row=document.createElement('div');
    row.className='track';
    row.innerHTML='<strong>'+track.name+'</strong><label>Volume <input type="range" min="0" max="100" value="70"></label><label><input type="checkbox"> Bisukan</label><button>Buat ulang</button>';
    const [volume,mute]=row.querySelectorAll('input');
    const mix=()=>{track.volume=volume.value/100;track.muted=mute.checked;if(track.bus) track.bus.gain.setTargetAtTime(track.muted?0:track.volume,ctx.currentTime,.01)};
    volume.oninput=mix; mute.onchange=mix;
    row.querySelector('button').onclick=()=>{if(song.variants) song.variants[track.name]=(song.variants[track.name]??0)+1;track.events=pattern(track.name);if(timer){const old=track.bus;for(const src of track.sources) src.stop(ctx.currentTime+.35);old.gain.setTargetAtTime(0,ctx.currentTime,.05);setTimeout(()=>old.disconnect(),350);scheduleTrack(track,Math.max(0,ctx.currentTime-start))}el('message').textContent='Pola '+track.name.toLowerCase()+' diperbarui.'};
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
    const seed=Math.floor(Math.random()*1e9);
    el('message').textContent='Menyiapkan versi A dan B…';
    // Two versions with neighbouring seeds; the listener simply keeps the one they like.
    versions=[];
    for (const s of [seed,seed+1]) {
      newSong({genre,mood,duration:Number(el('duration').value),names,seed:s,source});
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
function masterBus(audio) {
  const input = audio.createGain();
  input.gain.value = song.masterGain;
  const ceiling = audio.createWaveShaper();
  ceiling.curve = ceilingCurve;
  input.connect(ceiling).connect(audio.destination);
  return input;
}
function mixGain(buffer) {
  let energy=0, peak=0;
  for (let c=0;c<buffer.numberOfChannels;c++) {
    const samples=buffer.getChannelData(c);
    for (const value of samples) {
      energy+=value*value;
      peak=Math.max(peak,Math.abs(value));
    }
  }
  if (peak<.00001) return 1;
  const rms=Math.sqrt(energy/(buffer.length*buffer.numberOfChannels));
  return Math.min(.08/rms,.84/peak);
}
async function renderMix(normalized) {
    const audio=new OfflineAudioContext(2,song.duration*44100,44100);
    const output=normalized ? masterBus(audio) : audio.destination;
    for(const track of song.tracks){
      if(track.muted) continue;
      const bus=audio.createGain();
      bus.gain.value=track.volume;bus.connect(output);
      for(const event of track.events){
        const when=onset(event);
        voice({...track,bus},event,when,audio,song.duration-when);
      }
    }
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
    const url=URL.createObjectURL(wav(await renderMix(true)));
    const link=document.createElement('a');link.href=url;link.download='music-maker.wav';link.click();
    setTimeout(()=>URL.revokeObjectURL(url),60000);
  } catch {el('message').textContent='Ekspor gagal. Coba ulangi atau pilih durasi lebih pendek.'}
  finally {button.disabled=false}
};






















