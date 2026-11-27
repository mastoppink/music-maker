import mido,subprocess,soundfile as sf,numpy as np,json
SF="sf/SalamanderGrandPiano-SF2-V3+20200602/SalamanderGrandPiano-V3+20200602.sf2"
notes=list(range(36,91));vels=list(range(20,81,2))
mf=mido.MidiFile(ticks_per_beat=480);tr=mido.MidiTrack();mf.tracks.append(tr)
tr.append(mido.MetaMessage('set_tempo',tempo=500000))  # 120bpm: 1 beat=.5s
seq=[]
for n in notes:
  for v in vels:
    seq.append((n,v));tr.append(mido.Message('note_on',note=n,velocity=v,time=0));tr.append(mido.Message('note_off',note=n,velocity=0,time=480))
    tr.append(mido.Message('note_off',note=0,velocity=0,time=240))
mf.save('/tmp/cal.mid')
subprocess.run(["fluidsynth","-ni","-g","0.6","-r","44100","-F","/tmp/cal.wav",SF,"/tmp/cal.mid"],capture_output=True)
x,sr=sf.read('/tmp/cal.wav');m=x.mean(1)
T={}
for i,(n,v) in enumerate(seq):
  s=m[int(i*.75*sr):int((i*.75+.3)*sr)];T.setdefault(n,{})[v]=round(float(20*np.log10(np.sqrt((s**2).mean())+1e-9)),2)
json.dump(T,open('piano_cal_salamander.json','w'))
for n in [38,45,50,57,62,65,69,74,81,86]: print(n,[T[n][v] for v in (24,30,36,40,46,52,60)])
