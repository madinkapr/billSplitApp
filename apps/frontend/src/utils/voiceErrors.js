const ERROR_KEYS = {
  NOTHING_HEARD: 'billSetup.voiceNothingHeard',
  MIC_DENIED: 'billSetup.voiceMicDenied',
  MIC_ERROR: 'billSetup.voiceMicDenied',
  TIMEOUT: 'billSetup.voiceErrorGeneric',
  NETWORK_ERROR: 'billSetup.voiceErrorGeneric',
}

// Maps a useVoiceInput errorCode to a localized message, falling back to a
// generic translated string rather than surfacing the raw (English-only)
// backend error text in a uz/ru UI.
export function voiceErrorMessage(t, errorCode) {
  return t(ERROR_KEYS[errorCode] || 'billSetup.voiceErrorGeneric')
}
