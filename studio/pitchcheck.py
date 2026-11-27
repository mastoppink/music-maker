import soundfile as sf, numpy as np, glob, re, os
B="/home/ubuntu/studio/vsco/Strings/"
NOTES={'C':0,'C#':1,'D':2,'D#':3,'E':4,'F':5,'F#':6,'G':7,'G#':8,'A':9,'A#':10,'B':11}
def f0(x,sr):
    x=x[int(sr*1.5):int(sr*3.5)]; x=x-x.mean()
    X=np.abs(np.fft.rfft(x*np.hanning(len(x)),8*len(x)));fr=np.fft.rfftfreq(8*len(x),1/sr)
    # harmonic product spectrum
    h=X.copy()
    for k in (2,3): h[:len(X)//k]*=X[::k][:len(X)//k]
    m=(fr>25)&(fr<2000); return fr[m][np.argmax(h[m])]
for d in ["Violin Section/susVib","Viola Section/susvib","Cello Section/susvib","Solo Contrabass/SusVib"]:
    offs=[]
    for f in sorted(glob.glob(B+d+"/*.wav"))[:12]:
        n=re.search(r"_([A-G]#?)(-?\d)_",os.path.basename(f)); midi_name=12*(int(n.group(2))+1)+NOTES[n.group(1)]
        x,sr=sf.read(f);x=x.mean(1) if x.ndim>1 else x
        m=69+12*np.log2(f0(x,sr)/440); offs.append(round(m-midi_name))
    print(d,offs)
