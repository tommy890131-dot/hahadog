"""Generate original procedural placeholder SFX for the V3.4 integration demo.
Not licensed or copied game audio. Replace WAV files with authored/recorded assets later.
"""
from pathlib import Path
import wave
import numpy as np

ROOT=Path(__file__).resolve().parents[1]/'apps/client/public/assets/audio'
SR=22050
R=np.random.default_rng(6724)

def save(path,y):
    path.parent.mkdir(parents=True,exist_ok=True)
    y=np.asarray(y,dtype=np.float64)
    y-=float(np.mean(y))
    peak=float(np.max(np.abs(y))) if len(y) else 1
    if peak>0: y=0.84*y/max(1,peak)
    samples=np.asarray(np.clip(y,-1,1)*32767,dtype='<i2')
    with wave.open(str(path),'wb') as f:
        f.setframerate(SR);f.setnchannels(1);f.setsampwidth(2);f.writeframes(samples.tobytes())

def gun(name,duration,low,brightness):
    n=int(duration*SR); t=np.arange(n)/SR
    wn=R.standard_normal(n)
    sm=np.convolve(wn,np.ones(20)/20,mode='same')
    crack=(wn*(np.exp(-t*44)*(0.25+brightness*.35)))
    thump=(np.sin(2*np.pi*(low*t+120*t*t))*np.exp(-t*20)*.53)
    crack+=sm*np.exp(-t*11)*.35
    tail=R.standard_normal(n)*np.exp(-t*13)*.06
    ramp=np.minimum(1,t*500)
    save(ROOT/'weapons'/f'{name}.wav',(crack+thump+tail)*ramp)

gun('pistol',.25,70,.65)
gun('smg',.20,65,.85)
gun('rifle',.36,50,1.2)
gun('lmg',.40,44,1.45)

def infected(name,duration,special=False):
    n=int(duration*SR);t=np.arange(n)/SR
    phase=2*np.pi*(70*t+12*np.sin(2*np.pi*3.2*t))
    bass=np.sin(phase)*.42+np.sin(phase*.5)*.36
    grumble=R.standard_normal(n)
    grumble=np.convolve(grumble,np.ones(85)/85,mode='same')*.7
    trem=1+.24*np.sin(2*np.pi*(10 if special else 6)*t)
    env=np.minimum(1,t*10)*np.minimum(1,(duration-t)*4)
    if special:
        shriek=np.sin(2*np.pi*(210*t+160*t*t/duration))*np.exp(-t*.75)*.32
    else: shriek=np.sin(2*np.pi*137*t)*.09
    save(ROOT/'infected'/f'{name}.wav',(bass+grumble+shriek)*trem*env)

infected('zombie-roar',1.0)
infected('special-spawn',1.5,True)

def ding(path,freqs,duration):
    t=np.arange(int(duration*SR))/SR
    y=np.zeros_like(t)
    for i,(frequency,amp) in enumerate(freqs):
        y+=amp*np.sin(2*np.pi*frequency*t)*np.exp(-t*(17-i*3))
    y*=np.minimum(1,t*850)
    save(ROOT/'ui'/path,y)

ding('hitmarker.wav',[(750,.65),(1070,.25)],.12)
ding('headshot.wav',[(1175,.40),(1700,.36),(2350,.23)],.37)

n=SR;t=np.arange(n)/SR
# 1-second loop: two low heartbeat pulses, gentle crossfade at loop ends.
y=np.zeros(n)
for base,amp in ((.12,1),(.34,.7)):
    dt=t-base
    pulse=np.sin(2*np.pi*55*np.maximum(dt,0))*np.exp(-np.maximum(dt,0)*37)
    y+=amp*pulse*(dt>=0)
y+=R.standard_normal(n)*.006
save(ROOT/'ui'/'heartbeat.wav',y)
print('Generated',len(list(ROOT.rglob('*.wav'))),'original placeholder WAV files')
