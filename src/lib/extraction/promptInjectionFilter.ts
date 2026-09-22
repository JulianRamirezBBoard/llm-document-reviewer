// Layer 1 of the jailbreak defence: cheap local checks that run before any
// model call. A hit is treated exactly like an "unsafe" guardrail verdict.
// Layer 2 (the model guardrail) catches the subtler attempts this misses.
//
// The patterns are anchored to attack phrasing, not to single words, so an
// ordinary contract ("the parties disregard all prior agreements") or policy
// ("staff must not ignore safety rules") does not trip them. The
// ORDINARY_DOCUMENTS set in tests/fixtures/jailbreak-prompts.ts is the guard
// against that.

const INJECTION_PATTERNS: RegExp[] = [
  // Instruction override.
  /\b(ignore|disregard|forget|pay no attention to|do not follow|don'?t follow)\b[^.\n]{0,40}\b(previous|above|prior|earlier|preceding|initial|original|system|your)\b[^.\n]{0,20}\b(instructions?|system prompt|prompts?|directives?)\b/i,
  /\bforget (everything|all|what)\b[^.\n]{0,30}\b(you (were told|know|said)|above|before|so far)\b/i,
  /\b(reset|clear|wipe|override) (your|the) (instructions|system prompt|prompt|context)\b/i,
  /\bnew instructions?\s*:/i,
  /\byour (new|real|actual|true|secret) (role|task|job|purpose|instructions?) (is|are)\b/i,

  // Fake system or developer turns, and model chat markup.
  /^\s*(system|assistant|developer|user)\s*:/im,
  /<\/?(system|assistant|user|instructions?)>/i,
  /\[\/?INST\]|<\|im_start\|>|<\|im_end\|>/i,
  /(#{2,}|-{3,}|={3,}|\*{3,})\s*(end of (document|input|text)|new (instructions?|task|prompt))\b/i,

  // Role reassignment and roleplay wrappers.
  /\byou are (now|actually|really|from now on) (a|an|the|my|not|no longer)\b/i,
  /\bfrom now on,?\s+you (are|will be|must|should|shall|have to)\b/i,
  /^\s*(please\s+)?(act as|pretend to be|pretend you are|roleplay as|role-play as|simulate being)\b/i,
  /\b(imagine|pretend|suppose|hypothetically)\b[^.\n]{0,50}\b(no (rules|restrictions|filters|guardrails|limits)|you (can|could) (say|do) anything|you are (unrestricted|uncensored|unfiltered))\b/i,
  /\b(dan|do anything now|developer mode|jailbreak|god mode)\b/i,
  /\b(unfiltered|uncensored)\b[^.\n]{0,20}\b(mode|assistant|ai|model|response)\b/i,
  /\bwithout (any )?(restrictions?|filters?|guardrails?|safety|censorship)\b/i,
  /\bas an ai (with no|without) (rules|restrictions|guidelines|filters|limits)\b/i,

  // System-prompt or context exfiltration.
  /\b(repeat|print|show|output|reveal|display|echo|write out) (me |back |to me |us )?(everything|all( of)?|the (text|content|words|message|prompt|instructions?)) (above|before (this|now)|preceding this|so far|up to (this|here))\b/i,
  /\b(what|which) (were|are|is) (your|the) (exact |original |initial |full |complete |system )?(prompt|instructions?|system prompt|directives?)\b/i,
  /\b(print|output|reveal|show|display|leak|dump|share|repeat) (me |us )?(your|the) (system )?(prompt|instructions?|configuration|context|system message)\b/i,
  /\bverbatim\b[^.\n]{0,30}\b(prompt|instructions?|system message|above)\b/i,

  // Refusal suppression, anchored to AI-directed phrasing.
  /\b(do not|don'?t|never) (refuse|decline)\b[^.\n]{0,20}\b(this|the|my|any|to comply|the request|the task|the instructions?)\b/i,
  /\b(do not|don'?t|never) (say|reply|respond|tell me)\b[^.\n]{0,20}\byou (can'?t|cannot|are unable|won'?t|will not)\b/i,

  // Obfuscated payloads meant to smuggle an instruction.
  /\b(base64|rot13|rot-13|hex|hexadecimal|binary|morse code|leetspeak)\b[^.\n]{0,60}\b(decode|decrypt|then (do|follow|obey|run|execute)|and (do|follow|obey|run|execute))\b/i,
  /\b(decode|decrypt|unscramble|deobfuscate|translate) (the |this )?(following|below|text|string|message)\b[^.\n]{0,40}\b(then|and)\b[^.\n]{0,20}\b(do|follow|obey|execute|run|comply)\b/i,

  // Task substitution.
  /\binstead of (extracting|the extraction|reading|processing|analy[sz]ing)\b[^.\n]{0,40}\b(write|translate|answer|tell me|give me|generate|compose|explain|summari[sz]e for me)\b/i,

  // Authority and urgency social engineering.
  /\bas (the|your) (developer|administrator|admin|owner|creator|operator)\b[^.\n]{0,30}\b(i|we) (authorize|instruct|command|permit|allow|order) you\b/i,
  /\b(this is|it'?s) (an?|the) (emergency|urgent matter|test|drill)\b[^.\n]{0,50}\b(skip|bypass|ignore|disable|turn off) (the |any )?(safety|check|guardrail|filter|rule)/i,
]

// True when the text carries a phrase whose only purpose is to redirect the AI.
export const looksLikeInjection = (text: string): boolean =>
  INJECTION_PATTERNS.some((pattern) => pattern.test(text))

// Layer 3: a cheap local check on the extraction result. If a field value
// reads like a refusal, a paragraph of prose, or a quote of the prompt, the
// model probably followed an injection, so the caller drops the result.

const REFUSAL_START =
  /^\s*(i\s+(can'?t|cannot|won'?t|am unable|am sorry)|i'?m\s+(sorry|unable|an ai)|as an ai\b|sorry[,.]?\s+(but\s+)?i)/i

const looksLikePromptQuote = (value: string, systemPrompt: string): boolean => {
  if (value.includes('<document_text>')) {
    return true
  }
  if (
    /treat (everything|this)[^.\n]{0,25}(as data|between the tags)/i.test(value)
  ) {
    return true
  }
  const head = systemPrompt.slice(0, 60).trim()
  return head.length > 20 && value.includes(head)
}

const looksLikeProse = (value: string): boolean => {
  if (value.length <= 200) {
    return false
  }
  const sentenceBreaks = value.match(/[.!?](\s|$)/g)?.length ?? 0
  return sentenceBreaks >= 3
}

export const looksLikeInjectedResult = (
  result: { fields: { value: string }[] },
  systemPrompt: string,
): boolean =>
  result.fields.some(
    (field) =>
      REFUSAL_START.test(field.value) ||
      looksLikePromptQuote(field.value, systemPrompt) ||
      looksLikeProse(field.value),
  )
