// Raw Web Audio API mic capture, record-then-send, hand-rolled 16-bit mono WAV
// encoding. Ported from the Voice_to_Text project's WavRecorder — WAV is an
// officially supported Gemini inline-audio mimetype, unlike MediaRecorder's
// webm/opus output.
export class WavRecorder {
  constructor() {
    this.recording = false
    this.buffers = []
    this.ready = null
  }

  // Lazily initialized on first start() (not the constructor) so BillSetup —
  // a multi-purpose screen — doesn't prompt for mic permission before the
  // user has touched a mic control.
  async init() {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)()
    this.sampleRate = this.audioContext.sampleRate
    this.input = this.audioContext.createMediaStreamSource(this.stream)
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1)
    this.processor.onaudioprocess = (e) => {
      if (this.recording) {
        this.buffers.push(new Float32Array(e.inputBuffer.getChannelData(0)))
      }
    }
    this.input.connect(this.processor)
    this.processor.connect(this.audioContext.destination)
  }

  async start() {
    if (!this.ready) this.ready = this.init()
    await this.ready
    if (this.audioContext.state === 'suspended') await this.audioContext.resume()
    this.buffers = []
    this.recording = true
  }

  stop() {
    this.recording = false
    const durationMs = (this.buffers.reduce((sum, b) => sum + b.length, 0) / this.sampleRate) * 1000
    const blob = encodeWav(this.buffers, this.sampleRate)
    return { blob, durationMs }
  }
}

function encodeWav(buffers, sampleRate) {
  const totalLength = buffers.reduce((sum, b) => sum + b.length, 0)
  const pcm = new Int16Array(totalLength)
  let offset = 0
  for (const buf of buffers) {
    for (let i = 0; i < buf.length; i++) {
      const s = Math.max(-1, Math.min(1, buf[i]))
      pcm[offset++] = s < 0 ? s * 0x8000 : s * 0x7fff
    }
  }

  const bytesPerSample = 2
  const blockAlign = bytesPerSample // mono
  const byteRate = sampleRate * blockAlign
  const dataSize = pcm.length * bytesPerSample
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  writeString(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(view, 8, 'WAVE')
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, 16, true) // bits per sample
  writeString(view, 36, 'data')
  view.setUint32(40, dataSize, true)

  let pos = 44
  for (let i = 0; i < pcm.length; i++, pos += 2) {
    view.setInt16(pos, pcm[i], true)
  }

  return new Blob([buffer], { type: 'audio/wav' })
}

function writeString(view, offset, str) {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
}
