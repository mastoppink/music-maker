#!/bin/bash
cd /home/ubuntu/studio
P=/home/ubuntu/afh/venv/bin/python
OUTD=${OUTD:-out-sedih02-v4}
for i in $(seq 1 480); do av=$(free -m | awk '/Mem:/{print $7}'); [ "$av" -gt 2800 ] && break; sleep 60; done
echo "start $(date) avail=$av ride=${RIDE:-0.45}"
$P studio_render_legato_v4.py midi/sedih02-v4.mid $OUTD 2>&1 | grep -vE "^stem|Warning" | tail -6
ffmpeg -v error -y -i $OUTD/studio-master.wav -b:a 256k $OUTD/sedih02-v4.mp3
$P qc.py $OUTD/sedih02-v4.mp3 2>&1 | tail -1
$P v4tools.py st $OUTD/studio-master.wav
$P v4tools.py bal midi/sedih02-v4.mid $OUTD/studio-master.wav | tail -1
$P v4tools.py drops $OUTD/stem-piano.wav
$P v4tools.py midi midi/sedih02-v4.mid
echo SEDIH02V4DONE
