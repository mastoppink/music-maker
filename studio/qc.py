import sys, subprocess, numpy as np, soundfile as sf, re
SR = 44100
def load(p):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', p, '-ac', '2', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).astype(np.float64)
def ebu(p):
    o = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', p, '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True).stderr
    s = o[o.rfind('Summary'):]
    g = lambda k: float(re.search(k + r':\s+(-?[\d.]+)', s).group(1))
    return dict(I=g('I'), LRA=g('LRA'), TP=g('Peak'))
for p in sys.argv[1:]:
    x = load(p); m = x.mean(1)
    seg = m[:SR * 170]
    X = np.abs(np.fft.rfft(seg)) ** 2; fr = np.fft.rfftfreq(len(seg), 1 / SR); t = X.sum()
    bands = {f'{a}-{c}': round(10 * np.log10(X[(fr >= a) & (fr < c)].sum() / t), 1) for a, c in [(30, 60), (60, 150), (150, 400), (400, 2000), (2000, 6000), (6000, 16000)]}
    r = np.array([20 * np.log10(np.sqrt(np.mean(m[i:i + SR] ** 2)) + 1e-9) for i in range(5 * SR, min(len(m), 175 * SR), SR)])
    # clicks: second difference far above its local median (high-passed spikes)
    hp = np.diff(m, 2); a = np.abs(hp)
    loc = np.convolve(a, np.ones(2205) / 2205, 'same') + 1e-7
    spikes = int(np.sum((a / loc > 25) & (a > 0.02)))
    # stereo correlation
    corr = float(np.corrcoef(x[:, 0], x[:, 1])[0, 1])
    print(p.split('/')[-1], ebu(p), bands, 'rms p10-p90', round(np.percentile(r, 90) - np.percentile(r, 10), 1), 'spikes', spikes, 'LRcorr', round(corr, 2), 'dur', round(len(m) / SR, 1))
