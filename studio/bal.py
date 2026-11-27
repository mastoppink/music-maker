import mido,soundfile as sf,numpy as np,sys
mf=mido.MidiFile("midi/sedih02.mid");t=0;tempo=500000;ev=[]
for m in mido.merge_tracks(mf.tracks):
  t+=mido.tick2second(m.time,mf.ticks_per_beat,tempo)
  if m.type=="set_tempo": tempo=m.tempo
  if m.type=="note_on" and m.velocity>0 and t<18.3 and m.channel==0: ev.append((t,m.note))
x,sr=sf.read(sys.argv[1]);m=x.mean(1) if x.ndim>1 else x
L=[20*np.log10(np.sqrt((m[int(t*sr):int((t+.25)*sr)]**2).mean())+1e-9) for t,n in ev]
print("intro note levels",[round(l,1) for l in L]);print("spread dB",round(max(L)-min(L),1),"std",round(float(np.std(L)),1))
