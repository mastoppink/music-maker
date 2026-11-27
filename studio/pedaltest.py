import subprocess, numpy as np, soundfile as sf, mido, sys
SF="sf/SalamanderGrandPiano-SF2-V3+20200602/SalamanderGrandPiano-V3+20200602.sf2"
def piano_only(src, dst):
    mf=mido.MidiFile(src); pm=mido.MidiFile(ticks_per_beat=mf.ticks_per_beat,type=1)
    for tr in mf.tracks:
        if tr.name=='Piano' or not any(m.type=='note_on' for m in tr): pm.tracks.append(tr)
    pm.save(dst)
from scipy import signal
res={}
for tag,src in [('pedal','midi/sedih02-v4.mid'),('nopedal','midi/sedih02-v4-nopedal.mid')]:
    piano_only(src,f'/tmp/pt-{tag}.mid')
    subprocess.run(['fluidsynth','-ni','-q','-R','0','-C','0','-g','0.5','-r','44100','-o','synth.polyphony=256','-F',f'/tmp/pt-{tag}.wav',SF,f'/tmp/pt-{tag}.mid'],check=True)
    x,sr=sf.read(f'/tmp/pt-{tag}.wav'); m=x.mean(1); res[tag]=m
# compare: overall rms, and level in the last 0.4 s before each bar line (where pedal should keep notes ringing)
mf=mido.MidiFile('midi/sedih02-v4.mid')
# bar start times from tempo map
tempo=[];t=0
for msg in mf.tracks[0]:
    t+=msg.time
    if msg.type=='set_tempo': tempo.append((t,msg.tempo))
def t2s(tick):
    s,lt,lp=0,0,tempo[0][1]
    for tk,tp in tempo:
        if tk>tick: break
        s+=(tk-lt)*lp/480/1e6; lt,lp=tk,tp
    return s+(tick-lt)*lp/480/1e6
bars=[t2s(b*1920) for b in range(41)]
sr=44100
def db(a): return 20*np.log10(np.sqrt(np.mean(a**2))+1e-9)
for tag,m in res.items():
    pre=[db(m[int((b-.45)*sr):int((b-.1)*sr)]) for b in bars[1:40]]
    lo=signal.sosfilt(signal.butter(4,250,'low',fs=sr,output='sos'),m)
    hi=signal.sosfilt(signal.butter(4,250,'high',fs=sr,output='sos'),m)
    print(tag,'total',round(db(m[:int(190*sr)]),1),'pre-barline mean',round(np.mean(pre),1),'low<250',round(db(lo[:int(190*sr)]),1),'high>250',round(db(hi[:int(190*sr)]),1))
# intra-bar: does the pedal blur low register? energy <250 Hz in 2nd half of bars vs first half
for tag,m in res.items():
    lo=signal.sosfilt(signal.butter(4,250,'low',fs=sr,output='sos'),m)
    r=[db(lo[int((bars[i]+(bars[i+1]-bars[i])*.6)*sr):int((bars[i+1]-.1)*sr)])-db(lo[int(bars[i]*sr):int((bars[i]+(bars[i+1]-bars[i])*.4)*sr)]) for i in range(39)]
    print(tag,'low-band late-vs-early in bar dB (mean)',round(np.mean(r),1))
