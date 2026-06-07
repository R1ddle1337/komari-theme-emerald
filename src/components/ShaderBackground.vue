<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useAppStore } from '@/stores/app'

const appStore = useAppStore()
const canvasRef = ref<HTMLCanvasElement>()
let gl: WebGLRenderingContext | null = null
let program: WebGLProgram | null = null
let animationId = 0
let startTime = 0

const VERTEX_SHADER = `
attribute vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`

const FRAGMENT_SHADER = `
precision mediump float;

uniform float iTime;
uniform vec2 iResolution;
uniform float isDark;

float hash(float n) {
  return fract(sin(dot(vec2(n, n), vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec2 uv = -1.0 + 2.0 * gl_FragCoord.xy / iResolution.xy;
  uv.x *= iResolution.x / iResolution.y;

  // base background color
  vec3 lightBg = vec3(0.96 + 0.04 * uv.y);
  vec3 darkBg = vec3(0.08 + 0.03 * uv.y);
  vec3 color = mix(lightBg, darkBg, isDark);

  // bubbles
  for (int i = 0; i < 40; i++) {
    float pha = sin(float(i) * 546.13 + 1.0) * 0.5 + 0.5;
    float siz = pow(sin(float(i) * 651.74 + 5.0) * 0.5 + 0.5, 4.0);
    float pox = sin(float(i) * 321.55 + 4.1) * iResolution.x / iResolution.y;

    float rad = 0.1 + 0.5 * siz;
    vec2 pos = vec2(pox, -1.0 - rad + (2.0 + 2.0 * rad) * mod(pha + 0.1 * iTime * (0.2 + 0.8 * siz), 1.0));
    float dis = length(uv - pos);
    vec3 col = mix(vec3(0.94, 0.3, 0.0), vec3(0.1, 0.4, 0.8), 0.5 + 0.5 * sin(float(i) * 1.2 + 1.9));

    // in dark mode, use lighter bubble colors
    vec3 darkCol = mix(vec3(0.3, 0.5, 0.9), vec3(0.2, 0.8, 0.6), 0.5 + 0.5 * sin(float(i) * 1.2 + 1.9));
    col = mix(col, darkCol, isDark);

    float f = length(uv - pos) / rad;
    f = sqrt(clamp(1.0 - f * f, 0.0, 1.0));

    // light mode: subtract color; dark mode: add color
    vec3 contribution = col.zyx * (1.0 - smoothstep(rad * 0.95, rad, dis)) * f;
    color = mix(color - contribution * 0.8, color + contribution * 0.4, isDark);
  }

  // vignette
  color *= sqrt(1.5 - 0.5 * length(uv));

  gl_FragColor = vec4(color, 1.0);
}
`

function createShader(glCtx: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = glCtx.createShader(type)
  if (!shader) return null
  glCtx.shaderSource(shader, source)
  glCtx.compileShader(shader)
  if (!glCtx.getShaderParameter(shader, glCtx.COMPILE_STATUS)) {
    console.warn('[ShaderBackground] Shader compile error:', glCtx.getShaderInfoLog(shader))
    glCtx.deleteShader(shader)
    return null
  }
  return shader
}

function initWebGL() {
  const canvas = canvasRef.value
  if (!canvas) return false

  gl = canvas.getContext('webgl', { alpha: false, antialias: false, preserveDrawingBuffer: false })
  if (!gl) return false

  const vs = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER)
  const fs = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER)
  if (!vs || !fs) return false

  program = gl.createProgram()
  if (!program) return false

  gl.attachShader(program, vs)
  gl.attachShader(program, fs)
  gl.linkProgram(program)

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.warn('[ShaderBackground] Program link error:', gl.getProgramInfoLog(program))
    return false
  }

  gl.useProgram(program)

  // full-screen quad
  const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1])
  const buffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW)

  const posAttr = gl.getAttribLocation(program, 'position')
  gl.enableVertexAttribArray(posAttr)
  gl.vertexAttribPointer(posAttr, 2, gl.FLOAT, false, 0, 0)

  return true
}

function resize() {
  const canvas = canvasRef.value
  if (!canvas) return

  // Use lower resolution for performance (0.5x on mobile, 0.75x on desktop)
  const dpr = window.innerWidth < 768 ? 0.5 : 0.75
  const width = Math.floor(canvas.clientWidth * dpr)
  const height = Math.floor(canvas.clientHeight * dpr)

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width
    canvas.height = height
    gl?.viewport(0, 0, width, height)
  }
}

function render() {
  if (!gl || !program) return

  resize()

  const time = (performance.now() - startTime) / 1000.0

  const iTimeLoc = gl.getUniformLocation(program, 'iTime')
  const iResLoc = gl.getUniformLocation(program, 'iResolution')
  const isDarkLoc = gl.getUniformLocation(program, 'isDark')

  gl.uniform1f(iTimeLoc, time)
  gl.uniform2f(iResLoc, canvasRef.value!.width, canvasRef.value!.height)
  gl.uniform1f(isDarkLoc, appStore.isDark ? 1.0 : 0.0)

  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

  animationId = requestAnimationFrame(render)
}

onMounted(() => {
  startTime = performance.now()
  if (initWebGL()) {
    render()
  }
})

onBeforeUnmount(() => {
  if (animationId) {
    cancelAnimationFrame(animationId)
    animationId = 0
  }
  if (gl) {
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    gl = null
  }
})

// Rebuild on theme change (uniform handles it, but just in case)
watch(() => appStore.isDark, () => {
  // isDark uniform is updated every frame, no rebuild needed
})
</script>

<template>
  <canvas
    ref="canvasRef"
    class="absolute inset-0 w-full h-full"
    aria-hidden="true"
  />
</template>
