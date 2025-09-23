(function(){
  const $ = sel => document.querySelector(sel);
  const file = $('#file');
  const canvSrc = $('#canvasSrc');
  const canvOut = $('#canvasOut');
  const ctxSrc = canvSrc.getContext('2d');
  const ctxOut = canvOut.getContext('2d');
  const srcPane = canvSrc.parentElement;
  const outPane = canvOut.parentElement;

  const sImg = $('#sImg'), sPal = $('#sPal'), sStatus = $('#sStatus'), sSweep = $('#sSweep'), sMoves = $('#sMoves'), sEnergy = $('#sEnergy');
  const logEl = $('#log');

  const scaleIn = $('#scale');
  const sigmaIn = $('#sigma');
  const radiusIn = $('#radius');
  const kCandIn = $('#kCand');
  const maxSweepsIn = $('#maxSweeps');
  const startBtn = $('#start');
  const stopBtn = $('#stop');
  const saveBtn = $('#save');
  const scaleModeIn = document.getElementById('scaleMode');
  const palFree = $('#palFree');
  const palFull = $('#palFull');
  const palettePreview = $('#palettePreview');
  const wYIn = $('#wY');
  const wCIn = $('#wC');
  const wFidIn = $('#wFid');
  const doSwapsIn = $('#doSwaps');
  const domainLin = document.getElementById('domainLin');
  const domainSRGB = document.getElementById('domainSRGB');
  const dropZone = document.getElementById('dropZone');
  const scaleValEl = document.getElementById('scaleVal');
  const scaleDimsEl = document.getElementById('scaleDims');
  const ntCountEl = document.getElementById('ntCount');
  const viewScaleIn = document.getElementById('viewScale');
  const viewScaleValEl = document.getElementById('viewScaleVal');
  domainLin.addEventListener('change', selectDomain);
  domainSRGB.addEventListener('change', selectDomain);

  function log(msg){ logEl.textContent += msg + "\n"; logEl.scrollTop = logEl.scrollHeight; }
  function setStatus(t){ sStatus.textContent = t; }

  let _syncingScroll = false;
  function syncScroll(from, to){ if(_syncingScroll) return; _syncingScroll=true; try{ to.scrollLeft=from.scrollLeft; to.scrollTop=from.scrollTop; } finally { _syncingScroll=false; } }
  if (srcPane && outPane){ srcPane.addEventListener('scroll', ()=> syncScroll(srcPane, outPane)); outPane.addEventListener('scroll', ()=> syncScroll(outPane, srcPane)); }

  const MASTER_PALETTE = [
    [0,0,0],[60,60,60],[120,120,120],[210,210,210],[255,255,255],
    [96,0,24],[237,28,36],[255,127,39],[246,170,9],[249,221,59],[255,250,188],
    [14,185,104],[19,230,123],[135,255,94],[12,129,110],[16,174,166],[19,225,190],
    [96,247,242],[40,80,158],[64,147,228],[107,80,246],[153,177,251],
    [120,12,153],[170,56,185],[224,159,249],[203,0,122],[236,31,128],[243,141,169],
    [104,70,52],[149,104,42],[248,178,119],
    [170,170,170],[165,14,30],[250,128,114],[228,92,26],[156,132,49],[197,173,49],
    [232,212,95],[74,107,58],[90,148,74],[132,197,115],[15,121,159],[187,250,242],
    [125,199,255],[77,49,184],[74,66,132],[122,113,196],[181,174,241],
    [155,82,73],[209,128,120],[250,182,164],[219,164,99],[123,99,82],
    [156,132,107],[214,181,148],[209,128,81],[255,197,165],[109,100,63],
    [148,140,107],[205,197,158],[51,57,65],[109,117,141],[179,185,209]
  ];
  const FREE_COUNT = 31;
  const FULL_COUNT = MASTER_PALETTE.length;

  let paletteRGB = [];
  let paletteLin = [];
  let paletteYCG = [];
  let paletteYCG_lin = [];
  let paletteYCG_srgb = [];

  function srgb8_to_linear(v8){ const v = v8/255; return v<=0.04045? v/12.92 : Math.pow((v+0.055)/1.055,2.4); }
  function linear_to_srgb8(v){ const c=Math.max(0,Math.min(1,v)); const s=c<=0.0031308?12.92*c:1.055*Math.pow(c,1/2.4)-0.055; return Math.max(0,Math.min(255,Math.round(s*255))); }
  function srgb8_to_gamma01(v8){ return Math.max(0, Math.min(1, v8/255)); }
  function rgb_to_ycocg(r,g,b){ const Y=0.25*r+0.5*g+0.25*b; const Co=r-b; const Cg=-0.5*r+g-0.5*b; return [Y,Co,Cg]; }
  function rgb_to_y709_cocg(r,g,b){ const Y=0.2126*r+0.7152*g+0.0722*b; const Co=r-b; const Cg=-0.5*r+g-0.5*b; return [Y,Co,Cg]; }

  const domainLinEl = document.getElementById('domainLin');
  const domainSRGBEl = document.getElementById('domainSRGB');
  function selectDomain(){ if(domainLinEl&&domainLinEl.checked){ paletteYCG=paletteYCG_lin; TYCG=TYCG_lin; } else { paletteYCG=paletteYCG_srgb; TYCG=TYCG_srgb; } }

  function setPalette(count){
    const rgbList = MASTER_PALETTE.slice(0, count);
    paletteRGB = rgbList.slice();
    paletteLin = rgbList.map(([r,g,b]) => [srgb8_to_linear(r), srgb8_to_linear(g), srgb8_to_linear(b)]);
    paletteYCG_lin = paletteLin.map(([R,G,B]) => rgb_to_ycocg(R,G,B));
    const palSRGB01 = rgbList.map(([r,g,b]) => [srgb8_to_gamma01(r), srgb8_to_gamma01(g), srgb8_to_gamma01(b)]);
    paletteYCG_srgb = palSRGB01.map(([R,G,B]) => rgb_to_y709_cocg(R,G,B));
    selectDomain();
    sPal.textContent = `${paletteRGB.length} colors`;
    palettePreview.innerHTML = '';
    for(const [r,g,b] of rgbList){ const d=document.createElement('div'); d.className='chip'; d.style.background=`rgb(${r},${g},${b})`; palettePreview.appendChild(d); }
  }
  palFree.addEventListener('change', ()=>{ if(palFree.checked) setPalette(FREE_COUNT); });
  palFull.addEventListener('change', ()=>{ if(palFull.checked) setPalette(FULL_COUNT); });

  let W=0,H=0; // working dims
  let SRC_IMG=null; let SRC_W0=0, SRC_H0=0; let SRC_NAME=''; // original
  let Tlin=null; // Float32Array N*3
  let TYCG_lin=null; // Float32Array N*3
  let TYCG_srgb=null; // Float32Array N*3
  let TYCG=null; // active domain pointer
  let A8=null; // Uint8Array N alpha

  function updateScaleUI(){
    const raw = Number(scaleIn && scaleIn.value);
    const sval = Number.isFinite(raw) ? raw : 1.0;
    const s = Math.max(0.01, Math.min(10, sval));
    if(scaleValEl) scaleValEl.textContent = s.toFixed(2)+'×';
    if(scaleDimsEl){
      if (SRC_W0 && SRC_H0){
        const w = Math.max(1, Math.round(SRC_W0*s));
        const h = Math.max(1, Math.round(SRC_H0*s));
        scaleDimsEl.textContent = `${SRC_W0}×${SRC_H0} → ${w}×${h}`;
        
      } else { scaleDimsEl.textContent = '–'; }
    }
    if (typeof A8 !== 'undefined' && A8 && ntCountEl){
      let nt=0; for(let i=0;i<A8.length;i++){ if(A8[i]>0) nt++; }
      ntCountEl.textContent = nt ? nt.toLocaleString() : '0';
    } else if (ntCountEl){
      ntCountEl.textContent = '–';
    }
    if (viewScaleIn && viewScaleValEl){
      const vr = Number(viewScaleIn.value);
      const vs = Number.isFinite(vr) ? vr : 1.0;
      viewScaleValEl.textContent = vs.toFixed(2)+'×';
    }
  }

  function applyViewScale(){
    if (!viewScaleIn) return;
    const raw = Number(viewScaleIn.value);
    const vs = Math.max(0.25, Math.min(6, Number.isFinite(raw)?raw:1.0));
    if (W && H){
      canvSrc.style.width = (W*vs)+'px';
      canvSrc.style.height = (H*vs)+'px';
      canvOut.style.width = (W*vs)+'px';
      canvOut.style.height = (H*vs)+'px';
    }
    if (viewScaleValEl) viewScaleValEl.textContent = vs.toFixed(2)+'×';
  }

  async function rebuildFromImage(img){
    if(!img) return;
    const raw = Number(scaleIn && scaleIn.value);
    const sval = Number.isFinite(raw) ? raw : 1.0;
    const s = Math.max(0.01, Math.min(10, sval));
    W=Math.max(1, Math.round(img.naturalWidth*s)); H=Math.max(1, Math.round(img.naturalHeight*s));

    canvSrc.width=W; canvSrc.height=H;
    const modeVal = (scaleModeIn && scaleModeIn.value) || 'nearest';
    try { Scaler.drawScaledImage(img, canvSrc, modeVal); }
    catch(e){
      if (modeVal !== 'nearest') { try { log('Resample "'+modeVal+'" unavailable (WebGL). Falling back to nearest.'); } catch(_){} }
      ctxSrc.imageSmoothingEnabled = false;
      if ('imageSmoothingQuality' in ctxSrc) ctxSrc.imageSmoothingQuality = 'low';
      ctxSrc.drawImage(img,0,0,W,H);
    }
    canvOut.width=W; canvOut.height=H; ctxOut.imageSmoothingEnabled=false;

    const srcData = ctxSrc.getImageData(0,0,W,H).data;
    const N=W*H; Tlin=new Float32Array(N*3); TYCG_lin=new Float32Array(N*3); TYCG_srgb=new Float32Array(N*3); A8=new Uint8Array(N);
    for(let i=0,p=0;i<N;i++,p+=4){
      const r8=srcData[p], g8=srcData[p+1], b8=srcData[p+2];
      A8[i]=srcData[p+3]>>>0;
      const j=i*3; const R=srgb8_to_linear(r8), G=srgb8_to_linear(g8), B=srgb8_to_linear(b8);
      Tlin[j]=R; Tlin[j+1]=G; Tlin[j+2]=B;
      const [Yl,Col,Cgl]=rgb_to_ycocg(R,G,B);
      TYCG_lin[j]=Yl; TYCG_lin[j+1]=Col; TYCG_lin[j+2]=Cgl;
      const Rg=srgb8_to_gamma01(r8), Gg=srgb8_to_gamma01(g8), Bg=srgb8_to_gamma01(b8);
      const [Yg,Cog,Cgg]=rgb_to_y709_cocg(Rg,Gg,Bg);
      TYCG_srgb[j]=Yg; TYCG_srgb[j+1]=Cog; TYCG_srgb[j+2]=Cgg;
    }

    sImg.textContent = `${W}×${H}`;
    if (ntCountEl){ let nt=0; for(let i=0;i<N;i++){ if(A8[i]>0) nt++; } ntCountEl.textContent = nt.toLocaleString(); }
    drawOutFromQ(null);
    if (saveBtn) saveBtn.disabled = true;
    selectDomain();
    updateScaleUI();
    applyViewScale();
  }

  async function loadFromFile(f){
    if(!f) return;
    const url=URL.createObjectURL(f);
    const img=new Image(); img.src=url; await img.decode();
    SRC_IMG = img; SRC_W0 = img.naturalWidth; SRC_H0 = img.naturalHeight; SRC_NAME = typeof f.name === 'string' ? f.name : '';
    await rebuildFromImage(SRC_IMG);
    log('Image loaded.');
    URL.revokeObjectURL(url);
  }

  file.addEventListener('change', async (e)=>{ const f=e.target.files&&e.target.files[0]; await loadFromFile(f); });
  if (dropZone){
    dropZone.addEventListener('dragover', (e)=>{ e.preventDefault(); dropZone.style.borderColor = '#7aa2f7'; });
    dropZone.addEventListener('dragleave', ()=>{ dropZone.style.borderColor = '#2a3246'; });
    dropZone.addEventListener('drop', async (e)=>{ e.preventDefault(); dropZone.style.borderColor = '#2a3246'; const files = e.dataTransfer && e.dataTransfer.files; if(!files||!files.length) return; await loadFromFile(files[0]); });
  }
  document.addEventListener('dragover', (e)=>{ e.preventDefault(); });
  document.addEventListener('drop', (e)=>{ if(e.target!==dropZone) e.preventDefault(); });
  scaleIn.addEventListener('input', ()=>{ updateScaleUI(); if(SRC_IMG) rebuildFromImage(SRC_IMG); });
  if (scaleModeIn){ scaleModeIn.addEventListener('change', ()=>{ if(SRC_IMG) rebuildFromImage(SRC_IMG); }); }
  if (viewScaleIn){ viewScaleIn.addEventListener('input', ()=>{ applyViewScale(); updateScaleUI(); }); }
  updateScaleUI();

  function drawOutFromQ(Qidx){
    ctxOut.clearRect(0,0,canvOut.width, canvOut.height);
    if(!Qidx || !paletteLin.length){ if(saveBtn) saveBtn.disabled=true; return; }
    const N=W*H; const imgData=ctxOut.createImageData(W,H); const d=imgData.data;
    for(let i=0;i<N;i++){
      const idx = Qidx[i]>>>0; const q = paletteLin[idx]||[0,0,0];
      const p=i*4; d[p]=linear_to_srgb8(q[0]); d[p+1]=linear_to_srgb8(q[1]); d[p+2]=linear_to_srgb8(q[2]); d[p+3]=255;
    }
    if (A8){
      const alphaBinIn = document.getElementById('alphaBin');
      const alphaThreshIn = document.getElementById('alphaThresh');
      const doBin = !!(alphaBinIn && alphaBinIn.checked);
      if (doBin){
        const raw = alphaThreshIn ? Number(alphaThreshIn.value) : NaN;
        const thr = Number.isFinite(raw) ? Math.max(0, Math.min(100, raw)) : 80;
        const aThr = Math.floor(255 * (thr/100));
        for(let i=0;i<N;i++){ d[i*4+3] = (A8[i] > aThr) ? 255 : 0; }
      } else {
        for(let i=0;i<N;i++){ d[i*4+3] = A8[i]; }
      }
    }
    ctxOut.putImageData(imgData,0,0);
    if (saveBtn) saveBtn.disabled=false;
  }

  function buildGaussian2D(sigma, radius=0){
    const r = radius>0 ? radius : Math.max(1, Math.ceil(3*sigma));
    const size = 2*r+1, K = new Float32Array(size*size);
    const s2 = 2*sigma*sigma; let sum=0, t=0;
    for (let y=-r; y<=r; y++){
      for (let x=-r; x<=r; x++, t++){
        const w = Math.exp(-(x*x+y*y)/s2); K[t]=w; sum+=w;
      }
    }
    for (let i=0;i<K.length;i++) K[i]/=sum;
    let C=0; for (let i=0;i<K.length;i++) C+=K[i]*K[i];

    const r2 = 2*r; const sizeA = 2*r2+1;
    const A = new Float32Array(sizeA*sizeA);
    for (let y1=0; y1<size; y1++){
      for (let x1=0; x1<size; x1++){
        const w1 = K[y1*size+x1];
        for (let y2=0; y2<size; y2++){
          for (let x2=0; x2<size; x2++){
            const dy = (y1 - y2) + r2;
            const dx = (x1 - x2) + r2;
            A[dy*sizeA + dx] += w1 * K[y2*size + x2];
          }
        }
      }
    }
    return {K, r, C, A, r2};
  }

  function convolve2D3(input, output, W, H, K, r){
    let t=0;
    for(let y=0;y<H;y++){
      for(let x=0;x<W;x++){
        let c0=0,c1=0,c2=0; t=0;
        for(let ky=-r; ky<=r; ky++){
          const yy = Math.max(0, Math.min(H-1, y+ky));
          for(let kx=-r; kx<=r; kx++, t++){
            const xx = Math.max(0, Math.min(W-1, x+kx));
            const w = K[t], j=(yy*W+xx)*3;
            c0 += w*input[j]; c1 += w*input[j+1]; c2 += w*input[j+2];
          }
        }
        const o=(y*W+x)*3; output[o]=c0; output[o+1]=c1; output[o+2]=c2;
      }
    }
  }

  function makeTopKSelector(k, TYCG, paletteYCG, wY, wC){
    const M = paletteYCG.length;
    const useAll = !(k && k>0 && k<M);
    return function topK(i){
      if (useAll){ const a=new Uint8Array(M); for(let c=0;c<M;c++) a[c]=c; return a; }
      const j=i*3; const tY=TYCG[j], tCo=TYCG[j+1], tCg=TYCG[j+2];
      const Karr = new Uint8Array(k); const Darr = new Float32Array(k);
      let filled=0; let worstIdx=0; let worstVal=-1;
      for(let c=0;c<M;c++){
        const q=paletteYCG[c]; const dY=tY-q[0], dCo=tCo-q[1], dCg=tCg-q[2];
        const dist = wY*dY*dY + wC*dCo*dCo + wC*dCg*dCg;
        if (filled < k){ Karr[filled]=c; Darr[filled]=dist; if(dist>worstVal){ worstVal=dist; worstIdx=filled; } filled++; }
        else if (dist < worstVal){ Karr[worstIdx]=c; Darr[worstIdx]=dist; worstIdx=0; worstVal=Darr[0]; for(let t=1;t<k;t++){ if(Darr[t]>worstVal){ worstVal=Darr[t]; worstIdx=t; } } }
      }
      return Karr;
    };
  }

  let abortFlag=false;
  async function runDBS({W,H, TYCG, A8, paletteRGB, paletteLin, paletteYCG, sigma=1.0, radius=0, kCand=null, maxSweeps=8, wY=1.0, wC=0.35, lambdaF=0.0, seedQidx=null, trySwaps=true, onProgress}){
    const M=paletteRGB.length;
    const {K, r, C, A, r2} = buildGaussian2D(sigma, radius);
    const pad = 2*r; // expand by 2*r on each side
    const Wcore = W, Hcore = H;

    const Wexp = Wcore + 2*pad;
    const Hexp = Hcore + 2*pad;
    const Nexp = Wexp*Hexp;

    function reflectIndex(p, L){ const period = 2*L; let q = p % period; if(q<0) q += period; return q < L ? q : (2*L - 1 - q); }

    const TYCGexp = new Float32Array(Nexp*3);
    const A8exp = A8 ? new Uint8Array(Nexp) : null;
    for(let ye=0; ye<Hexp; ye++){
      const yb = ye - pad; const ys = reflectIndex(yb, Hcore);
      for(let xe=0; xe<Wexp; xe++){
        const xb = xe - pad; const xs = reflectIndex(xb, Wcore);
        const src = (ys*Wcore + xs)*3;
        const dst = (ye*Wexp + xe)*3;
        TYCGexp[dst] = TYCG[src];
        TYCGexp[dst+1] = TYCG[src+1];
        TYCGexp[dst+2] = TYCG[src+2];
        if(A8exp){ A8exp[ye*Wexp + xe] = A8[ys*Wcore + xs]; }
      }
    }
    TYCG = TYCGexp; A8 = A8exp; W = Wexp; H = Hexp; const N = W*H;

    const eps = 1e-12;
    const Qidx = new Uint8Array(N);
    if (seedQidx && seedQidx.length===N){ Qidx.set(seedQidx); }
    else {
      for(let i=0;i<N;i++){
        if (A8 && A8[i]===0){ Qidx[i]=0; continue; }
        const j=i*3, tY=TYCG[j], tCo=TYCG[j+1], tCg=TYCG[j+2];
        let best=0, bestD=Infinity;
        for(let c=0;c<M;c++){
          const q=paletteYCG[c]; const dY=tY-q[0], dCo=tCo-q[1], dCg=tCg-q[2];
          const D=wY*dY*dY + wC*dCo*dCo + wC*dCg*dCg; if(D<bestD){bestD=D; best=c;}
        }
        Qidx[i]=best;
      }
    }

    const D = new Float32Array(N*3);
    for(let i=0;i<N;i++){
      const j=i*3;
      if (A8 && A8[i]===0){ D[j]=0; D[j+1]=0; D[j+2]=0; continue; }
      const q=paletteYCG[Qidx[i]]; D[j]=q[0]-TYCG[j]; D[j+1]=q[1]-TYCG[j+1]; D[j+2]=q[2]-TYCG[j+2];
    }
    const R = new Float32Array(N*3); convolve2D3(D,R,W,H,K,r);
    const S = new Float32Array(N*3); convolve2D3(R,S,W,H,K,r);

    function energyFromR(){ let E=0; for(let i=0;i<N;i++){ if (A8 && A8[i]===0) continue; const j=i*3; const r0=R[j], r1=R[j+1], r2c=R[j+2]; E += wY*r0*r0 + wC*r1*r1 + wC*r2c*r2c; } return E; }
    function energyFidelity(){ if(lambdaF<=0) return 0; let Ef=0; for(let i=0;i<N;i++){ if (A8 && A8[i]===0) continue; const j=i*3; const q=paletteYCG[Qidx[i]]; const dY=q[0]-TYCG[j]; const dCo=q[1]-TYCG[j+1]; const dCg=q[2]-TYCG[j+2]; Ef += wY*dY*dY + wC*dCo*dCo + wC*dCg*dCg; } return lambdaF*Ef; }
    let E = energyFromR() + energyFidelity();

    const Kcand = (kCand && kCand>0 && kCand<M) ? kCand : M;
    const topK = makeTopKSelector(Kcand, TYCG, paletteYCG, wY, wC);

    const order = new Uint32Array(N);
    const shuffle = () => { for(let i=0;i<N;i++) order[i]=i; for(let i=N-1;i>0;i--){ const j=(Math.random()*(i+1))|0; const t=order[i]; order[i]=order[j]; order[j]=t; } };
    const yieldEvery = Math.max(1000, Math.floor(N/8));
    const NBR4 = [[1,0],[-1,0],[0,1],[0,-1]];

    function cropCore(Qw){ const out = new Uint8Array(Wcore*Hcore); for(let y=0;y<Hcore;y++){ const sy = y + pad; const srcRow = sy*W + pad; const dstRow = y*Wcore; for(let x=0;x<Wcore;x++) out[dstRow + x] = Qw[srcRow + x]; } return out; }

    for(let sweep=1; sweep<=maxSweeps; sweep++){
      shuffle();
      let moves=0, processed=0;

      for(let idx=0; idx<N; idx++){
        if (abortFlag) throw new Error('abort');
        const i = order[idx], x = i%W, y = (i/W)|0;
        if (A8 && A8[i]===0) continue;
        const curr = Qidx[i];
        const j = i*3; const s0=S[j], s1=S[j+1], s2=S[j+2];

        let best=curr, bestDelta=0;
        const cands = topK(i);
        const qCurr = paletteYCG[curr];
        const tY = TYCG[j], tCo = TYCG[j+1], tCg = TYCG[j+2];
        const dYold = qCurr[0]-tY, dCoOld = qCurr[1]-tCo, dCgOld = qCurr[2]-tCg;
        for(let u=0; u<cands.length; u++){
          const c=cands[u]; if(c===curr) continue;
          const q=paletteYCG[c];
          const d0=q[0]-qCurr[0], d1=q[1]-qCurr[1], d2=q[2]-qCurr[2];
          const dq2Y = d0*d0, dq2C = d1*d1 + d2*d2;
          const dEfilter = 2*(wY*d0*s0 + wC*(d1*s1 + d2*s2)) + C*(wY*dq2Y + wC*dq2C);
          let dEfid = 0;
          if(lambdaF>0){ const dYnew = dYold + d0, dCoNew = dCoOld + d1, dCgNew = dCgOld + d2; dEfid = lambdaF*(wY*(dYnew*dYnew - dYold*dYold) + wC*(dCoNew*dCoNew - dCoOld*dCoOld) + wC*(dCgNew*dCgNew - dCgOld*dCgOld)); }
          const dE = dEfilter + dEfid;
          if(dE < bestDelta){ bestDelta=dE; best=c; }
        }

        let bestSwapPeer=-1, bestSwapDelta=0, bestSwapD=[0,0,0];
        if(trySwaps){
          for(const [dx,dy] of NBR4){
            const nx = x+dx, ny = y+dy;
            if(nx<0||nx>=W||ny<0||ny>=H) continue;
            const jidx = ny*W + nx; if (A8 && A8[jidx]===0) continue; const cj = Qidx[jidx];
            if(cj===curr) continue;
            const qj = paletteYCG[cj];
            const d0 = qj[0]-qCurr[0], d1 = qj[1]-qCurr[1], d2 = qj[2]-qCurr[2];
            const normW = wY*d0*d0 + wC*(d1*d1 + d2*d2);
            const jj = jidx*3; const s0j=S[jj], s1j=S[jj+1], s2j=S[jj+2];
            const dot = wY*d0*(s0 - s0j) + wC*(d1*(s1 - s1j) + d2*(s2 - s2j));
            const Aoff = A[(dy + r2)*((2*r2)+1) + (dx + r2)];
            let dE = 2*dot + 2*(C - Aoff)*normW;
            if(lambdaF>0){
              const tYi = TYCG[j], tCoi = TYCG[j+1], tCgi = TYCG[j+2];
              const dYold_i = qCurr[0]-tYi, dCoOld_i = qCurr[1]-tCoi, dCgOld_i = qCurr[2]-tCgi;
              const dYnew_i = qj[0]-tYi, dCoNew_i = qj[1]-tCoi, dCgNew_i = qj[2]-tCgi;
              const tYj = TYCG[jj], tCoj = TYCG[jj+1], tCgj = TYCG[jj+2];
              const dYold_j = qj[0]-tYj, dCoOld_j = qj[1]-tCoj, dCgOld_j = qj[2]-tCgj;
              const dYnew_j = qCurr[0]-tYj, dCoNew_j = qCurr[1]-tCoj, dCgNew_j = qCurr[2]-tCgj;
              const dEfid = lambdaF*(
                wY*((dYnew_i*dYnew_i - dYold_i*dYold_i) + (dYnew_j*dYnew_j - dYold_j*dYold_j)) +
                wC*((dCoNew_i*dCoNew_i - dCoOld_i*dCoOld_i) + (dCoNew_j*dCoNew_j - dCoOld_j*dCoOld_j)) +
                wC*((dCgNew_i*dCgNew_i - dCgOld_i*dCgOld_i) + (dCgNew_j*dCgNew_j - dCgOld_j*dCgOld_j))
              );
              dE += dEfid;
            }
            if(dE < bestSwapDelta){ bestSwapDelta=dE; bestSwapPeer=jidx; bestSwapD=[d0,d1,d2]; }
          }
        }

        if(bestSwapPeer>=0 && bestSwapDelta < -eps && bestSwapDelta < bestDelta - eps){
          const jidx = bestSwapPeer; const d0 = bestSwapD[0], d1 = bestSwapD[1], d2 = bestSwapD[2];
          let t=0;
          for(let ky=-r; ky<=r; ky++){
            const yy=Math.max(0,Math.min(H-1,y+ky));
            for(let kx=-r; kx<=r; kx++, t++){
              const xx=Math.max(0,Math.min(W-1,x+kx));
              const w=K[t], jj2=(yy*W+xx)*3;
              R[jj2]+=w*d0; R[jj2+1]+=w*d1; R[jj2+2]+=w*d2;
            }
          }
          t=0; const y2=(jidx/W)|0, x2=jidx%W;
          for(let ky=-r; ky<=r; ky++){
            const yy=Math.max(0,Math.min(H-1,y2+ky));
            for(let kx=-r; kx<=r; kx++, t++){
              const xx=Math.max(0,Math.min(W-1,x2+kx));
              const w=K[t], jj2=(yy*W+xx)*3;
              R[jj2]-=w*d0; R[jj2+1]-=w*d1; R[jj2+2]-=w*d2;
            }
          }
          let tt=0;
          for(let ky=-2*r; ky<=2*r; ky++){
            const yy=Math.max(0,Math.min(H-1,y+ky));
            for(let kx=-2*r; kx<=2*r; kx++, tt++){
              const xx=Math.max(0,Math.min(W-1,x+kx));
              const w=A[tt], jj2=(yy*W+xx)*3;
              S[jj2]+=w*d0; S[jj2+1]+=w*d1; S[jj2+2]+=w*d2;
            }
          }
          tt=0;
          for(let ky=-2*r; ky<=2*r; ky++){
            const yy=Math.max(0,Math.min(H-1,((jidx/W)|0)+ky));
            for(let kx=-2*r; kx<=2*r; kx++, tt++){
              const xx=Math.max(0,Math.min(W-1,(jidx%W)+kx));
              const w=A[tt], jj2=(yy*W+xx)*3;
              S[jj2]-=w*d0; S[jj2+1]-=w*d1; S[jj2+2]-=w*d2;
            }
          }
          const cj = Qidx[jidx]; Qidx[i]=cj; Qidx[jidx]=curr; E+=bestSwapDelta; moves++;
        } else if(best!==curr && bestDelta < -eps){
          const qNew=paletteYCG[best]; const qOld=qCurr;
          const d0=qNew[0]-qOld[0], d1=qNew[1]-qOld[1], d2=qNew[2]-qOld[2];
          let t=0;
          for(let ky=-r; ky<=r; ky++){
            const yy=Math.max(0,Math.min(H-1,y+ky));
            for(let kx=-r; kx<=r; kx++, t++){
              const xx=Math.max(0,Math.min(W-1,x+kx));
              const w=K[t], jj2=(yy*W+xx)*3;
              R[jj2]+=w*d0; R[jj2+1]+=w*d1; R[jj2+2]+=w*d2;
            }
          }
          let tt=0;
          for(let ky=-2*r; ky<=2*r; ky++){
            const yy=Math.max(0,Math.min(H-1,y+ky));
            for(let kx=-2*r; kx<=2*r; kx++, tt++){
              const xx=Math.max(0,Math.min(W-1,x+kx));
              const w=A[tt], jj2=(yy*W+xx)*3;
              S[jj2]+=w*d0; S[jj2+1]+=w*d1; S[jj2+2]+=w*d2;
            }
          }
          Qidx[i]=best; E+=bestDelta; moves++;
        }

        if(++processed % yieldEvery === 0 && onProgress){ await new Promise(requestAnimationFrame); onProgress({sweep, E, moves, Qidx: cropCore(Qidx)}); }
      }

      const Efull = energyFromR() + energyFidelity();
      E = Efull;
      if(onProgress){ onProgress({sweep, E, moves, Qidx: cropCore(Qidx)}); }
      if(moves===0) break;
    }

    return {Qidx: cropCore(Qidx), energy:E};
  }

  stopBtn.addEventListener('click', ()=>{ abortFlag=true; setStatus('Aborting…'); log('Stop requested…'); });
  saveBtn.addEventListener('click', async ()=>{
    if(!SRC_IMG){ alert('Load an image first.'); return; }
    let base = 'image';
    if (SRC_NAME){ const m = SRC_NAME.match(/^(.+?)(\.[^.]+)?$/); base = (m && m[1]) ? m[1] : SRC_NAME; }
    const fname = `${base}_quantized.png`;
    canvOut.toBlob((blob)=>{
      if(!blob){ alert('Failed to export image.'); return; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = fname; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(()=> URL.revokeObjectURL(url), 500);
    }, 'image/png');
  });
  startBtn.addEventListener('click', async ()=>{
    if(!Tlin || !paletteRGB.length){ alert('Load an image first.'); return; }
    abortFlag=false; startBtn.disabled=true; setStatus('Initializing…'); log('Starting DBS');
    const sigmaRaw = Number(sigmaIn && sigmaIn.value);
    const sigma = Math.max(0.5, Number.isFinite(sigmaRaw) ? sigmaRaw : 1.0);
    const radiusRaw = Number(radiusIn && radiusIn.value);
    const radius = Math.max(0, Math.floor(Number.isFinite(radiusRaw) ? radiusRaw : 0));
    const kRaw = Number(kCandIn && kCandIn.value);
    const kCand = Math.max(1, Math.floor(Number.isFinite(kRaw) ? kRaw : paletteRGB.length));
    const sweepsRaw = Number(maxSweepsIn && maxSweepsIn.value);
    const maxSweeps = Math.max(1, Math.floor(Number.isFinite(sweepsRaw) ? sweepsRaw : 6));
    const wYraw = Number(wYIn && wYIn.value);
    const wY = Math.max(0.01, Number.isFinite(wYraw) ? wYraw : 1.0);
    const wCraw = Number(wCIn && wCIn.value);
    const wC = Math.max(0.01, Number.isFinite(wCraw) ? wCraw : 0.35);
    const lamRaw = Number(wFidIn && wFidIn.value);
    const lambdaF = Math.max(0, Number.isFinite(lamRaw) ? lamRaw : 0.0);
    const trySwaps = !!doSwapsIn.checked;
    try{
      const {Qidx, energy} = await runDBS({ W, H, TYCG, A8, paletteRGB, paletteLin, paletteYCG, sigma, radius, kCand, maxSweeps, wY, wC, lambdaF, seedQidx:null, trySwaps,
        onProgress: ({sweep, E, moves, Qidx})=>{ setStatus(`Sweep ${sweep}…`); sSweep.textContent=String(sweep); sMoves.textContent=String(moves); sEnergy.textContent=Number(E).toExponential(4); drawOutFromQ(Qidx); } });
      sEnergy.textContent = Number(energy).toExponential(4);
      setStatus('Done'); log('Converged or reached limits.');
      drawOutFromQ(Qidx);
    } catch(err){ if(String(err&&err.message).toLowerCase().includes('abort')){ setStatus('Stopped'); log('Stopped by user.'); } else { console.error(err); setStatus('Error'); log('Error: '+err.message); } }
    finally { startBtn.disabled=false; }
  });

  setPalette(FREE_COUNT);
})();
