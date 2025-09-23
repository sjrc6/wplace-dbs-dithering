(function(global){
  const Scaler = {};
  let gl = null, glCanvas = null, program = null;
  let attribPos = -1;
  let uniTex = null, uniTexSize = null, uniMode = null;
  let vbo = null;

  function initGL(){
    if (gl) return true;
    glCanvas = document.createElement('canvas');
    gl = glCanvas.getContext('webgl', {premultipliedAlpha: false, alpha: true});
    if (!gl) return false;

    const vsSrc = `
      attribute vec2 aPos;
      varying vec2 vUV;
      void main(){
        vUV = (aPos + 1.0) * 0.5;
        gl_Position = vec4(aPos, 0.0, 1.0);
      }
    `;
    const fsSrc = `
      precision mediump float;
      uniform sampler2D uTex;
      uniform vec2 uTexSize;
      uniform int uMode;
      varying vec2 vUV;

      float cubic(float x){
        float a = -0.5; // Catmull-Rom
        x = abs(x);
        if (x <= 1.0) {
          return (a + 2.0)*x*x*x - (a + 3.0)*x*x + 1.0;
        } else if (x < 2.0) {
          return a*x*x*x - 5.0*a*x*x + 8.0*a*x - 4.0*a;
        } else {
          return 0.0;
        }
      }

      vec4 textureBicubic(sampler2D s, vec2 uv, vec2 texSize){
        vec2 coord = uv * texSize - 0.5;
        vec2 f = fract(coord);
        vec2 base = floor(coord);
        vec4 acc = vec4(0.0);
        float wsum = 0.0;
        for (int j = -1; j <= 2; j++){
          for (int i = -1; i <= 2; i++){
            vec2 o = vec2(float(i), float(j));
            vec2 sampleCoord = (base + o + 0.5) / texSize;
            float wx = cubic(o.x - f.x);
            float wy = cubic(o.y - f.y);
            float w = wx * wy;
            acc += texture2D(s, sampleCoord) * w;
            wsum += w;
          }
        }
        return acc / max(wsum, 1e-6);
      }

      void main(){
        if (uMode == 2) {
          gl_FragColor = textureBicubic(uTex, vUV, uTexSize);
        } else {
          gl_FragColor = texture2D(uTex, vUV);
        }
      }
    `;

    function compile(type, src){ const sh = gl.createShader(type); gl.shaderSource(sh, src); gl.compileShader(sh); if(!gl.getShaderParameter(sh, gl.COMPILE_STATUS)){ console.error('Shader compile error:', gl.getShaderInfoLog(sh)); gl.deleteShader(sh); return null; } return sh; }
    const vs = compile(gl.VERTEX_SHADER, vsSrc);
    const fs = compile(gl.FRAGMENT_SHADER, fsSrc);
    if(!vs || !fs) return false;
    program = gl.createProgram(); gl.attachShader(program, vs); gl.attachShader(program, fs); gl.linkProgram(program);
    if(!gl.getProgramParameter(program, gl.LINK_STATUS)){ console.error('Program link error:', gl.getProgramInfoLog(program)); return false; }
    attribPos = gl.getAttribLocation(program, 'aPos');
    uniTex = gl.getUniformLocation(program, 'uTex');
    uniTexSize = gl.getUniformLocation(program, 'uTexSize');
    uniMode = gl.getUniformLocation(program, 'uMode');

    vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    const verts = new Float32Array([
      -1, -1,  1, -1,  -1,  1,
      -1,  1,  1, -1,   1,  1
    ]);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    return true;
  }

  function draw(img, outCanvas, mode){
    if (mode === 'nearest'){
      const ctx2d = outCanvas.getContext('2d');
      ctx2d.imageSmoothingEnabled = false;
      if ('imageSmoothingQuality' in ctx2d) ctx2d.imageSmoothingQuality = 'low';
      ctx2d.clearRect(0,0,outCanvas.width,outCanvas.height);
      ctx2d.drawImage(img, 0, 0, outCanvas.width, outCanvas.height);
      return;
    }
    const useGL = initGL();
    if (!useGL){ throw new Error('WebGL unavailable for smooth scaling'); }

    glCanvas.width = outCanvas.width;
    glCanvas.height = outCanvas.height;
    gl.viewport(0,0,glCanvas.width, glCanvas.height);
    gl.clearColor(0,0,0,0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.activeTexture(gl.TEXTURE0);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const isBilinear = (mode === 'bilinear');
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, isBilinear ? gl.LINEAR : gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, isBilinear ? gl.LINEAR : gl.NEAREST);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);

    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.enableVertexAttribArray(attribPos);
    gl.vertexAttribPointer(attribPos, 2, gl.FLOAT, false, 0, 0);
    gl.uniform1i(uniTex, 0);
    gl.uniform2f(uniTexSize, img.naturalWidth || img.width, img.naturalHeight || img.height);
    gl.uniform1i(uniMode, (mode === 'bicubic') ? 2 : 0);

    gl.drawArrays(gl.TRIANGLES, 0, 6);

    const ctx2d = outCanvas.getContext('2d');
    ctx2d.clearRect(0,0,outCanvas.width, outCanvas.height);
    ctx2d.drawImage(glCanvas, 0, 0);

    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.deleteTexture(tex);
  }

  Scaler.drawScaledImage = function(img, outCanvas, mode){
    const m = (mode||'nearest');
    draw(img, outCanvas, m);
  };

  global.Scaler = Scaler;
})(window);
