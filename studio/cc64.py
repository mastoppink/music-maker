import mido, subprocess, soundfile as sf, numpy as np
SF="sf/SalamanderGrandPiano-SF2-V3+20200602/SalamanderGrandPiano-V3+20200602.sf2"
for tag,ped in [('on',True),('off',False)]:
    mf=mido.MidiFile(ticks_per_beat=480); tr=mido.MidiTrack(); mf.tracks.append(tr)
    tr.append(mido.MetaMessage('set_tempo',tempo=1000000))
    if ped: tr.append(mido.Message('control_change',control=64,value=127,time=0))
    tr.append(mido.Message('note_on',note=69,velocity=60,time=0)); tr.append(mido.Message('note_off',note=69,velocity=0,time=120))
    tr.append(mido.Message('control_change',control=64,value=0,time=480*3)); tr.append(mido.Message('note_off',note=0,velocity=0,time=960))
    mf.save(f'/tmp/cc-{tag}.mid')
    subprocess.run(['fluidsynth','-ni','-q','-R','0','-C','0','-g','0.5','-r','44100','-F',f'/tmp/cc-{tag}.wav',SF,f'/tmp/cc-{tag}.mid'],check=True,capture_output=True)
    x,sr=sf.read(f'/tmp/cc-{tag}.wav'); m=x.mean(1)
    print(tag,[round(20*np.log10(np.sqrt(np.mean(m[int(t*sr):int((t+.1)*sr)]**2))+1e-9),1) for t in (0.05,0.5,1.0,2.0,3.0,3.5)])
