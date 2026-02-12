/**
 * Mode Detection Utility for AISA
 * Automatically detects the appropriate mode based on user input and context
 */

const MODES = {
  NORMAL_CHAT: 'NORMAL_CHAT',
  FILE_ANALYSIS: 'FILE_ANALYSIS',
  FILE_CONVERSION: 'FILE_CONVERSION',
  CONTENT_WRITING: 'CONTENT_WRITING',
  CODING_HELP: 'CODING_HELP',
  TASK_ASSISTANT: 'TASK_ASSISTANT',
  DEEP_SEARCH: 'DEEP_SEARCH',
  IMAGE_GEN: 'IMAGE_GEN',
  VIDEO_GEN: 'VIDEO_GEN',
  AUDIO_GEN: 'AUDIO_GEN'
};

const CODING_KEYWORDS = [
  'code', 'function', 'class', 'debug', 'error', 'bug', 'programming',
  'javascript', 'python', 'java', 'react', 'node', 'api', 'algorithm',
  'syntax', 'compile', 'runtime', 'variable', 'loop', 'array', 'object',
  'database', 'sql', 'html', 'css', 'typescript', 'component', 'import',
  'export', 'async', 'await', 'promise', 'callback', 'fix this code',
  'write a function', 'create a script', 'implement', 'refactor'
];

const WRITING_KEYWORDS = [
  'write', 'article', 'blog', 'essay', 'content', 'draft', 'compose',
  'create a post', 'write about', 'paragraph', 'story', 'letter',
  'email template', 'description', 'summary', 'report', 'document',
  'copywriting', 'marketing copy', 'social media post', 'caption',
  'headline', 'slogan', 'tagline', 'press release'
];

const TASK_KEYWORDS = [
  'task', 'todo', 'plan', 'schedule', 'organize', 'goal', 'objective',
  'steps', 'how to', 'guide me', 'help me plan', 'breakdown', 'roadmap',
  'timeline', 'priority', 'checklist', 'action items', 'strategy',
  'project plan', 'workflow', 'process', 'milestone'
];

const CONVERSION_KEYWORDS = [
  'convert', 'change format', 'make it', 'turn into', 'transform',
  'pdf to word', 'word to pdf', 'pdf to doc', 'doc to pdf', 'docx to pdf',
  'pdf to docx', 'convert karo', 'badlo', 'format change', 'file convert',
  'is file ko', 'convert this', 'make this a', 'change this to',
  'into pdf', 'to pdf', 'into word', 'to word', 'into doc', 'to doc',
  'me convert', 'pdf me', 'word me', 'doc me',
  'pptx to pdf', 'ppt to pdf', 'excel to pdf', 'xlsx to pdf', 'image to pdf',
  'jpg to pdf', 'png to pdf', 'webp to pdf', 'txt to pdf'
];

/**
 * Detect mode based on user message and attachments
 * @param {string} message - User's message content
 * @param {Array} attachments - Array of attachment objects
 * @returns {string} - Detected mode
 */
export function detectMode(message = '', attachments = []) {
  const lowerMessage = message.toLowerCase().trim();
  const hasAttachments = attachments && attachments.length > 0;

  console.log(`[MODE DETECTION] Processing message: "${lowerMessage}" with ${attachments ? attachments.length : 0} attachments`);

  // Priority 1: Image/Video Generation Intent
  if (
    (lowerMessage.includes('image') || lowerMessage.includes('photo') || lowerMessage.includes('pic') || lowerMessage.includes('draw')) &&
    (lowerMessage.includes('generate') || lowerMessage.includes('create') || lowerMessage.includes('make') || lowerMessage.includes('show'))
  ) {
    return MODES.IMAGE_GEN;
  }

  if (lowerMessage.includes('video') && (lowerMessage.includes('generate') || lowerMessage.includes('create') || lowerMessage.includes('make'))) {
    return MODES.VIDEO_GEN;
  }

  // Audio Generation Intent
  if (
    (lowerMessage.includes('audio') || lowerMessage.includes('sound') || lowerMessage.includes('music') || lowerMessage.includes('voice') || lowerMessage.includes('song')) &&
    (lowerMessage.includes('generate') || lowerMessage.includes('create') || lowerMessage.includes('make') || lowerMessage.includes('compose'))
  ) {
    return MODES.AUDIO_GEN;
  }

  // Priority 2: File Analysis/Conversion - if attachments are present
  if (hasAttachments) {
    // Check if it's a conversion request with attachments
    const matchedKeyword = CONVERSION_KEYWORDS.find(keyword => lowerMessage.includes(keyword));

    if (matchedKeyword) {
      console.log(`[MODE DETECTION] Detected conversion keyword: "${matchedKeyword}". Setting mode to FILE_CONVERSION.`);
      return MODES.FILE_CONVERSION;
    }

    console.log(`[MODE DETECTION] No conversion keyword found. Defaulting to FILE_ANALYSIS.`);
    return MODES.FILE_ANALYSIS;
  }

  // Priority 2: Coding Help - check for code-related keywords
  const hasCodingKeywords = CODING_KEYWORDS.some(keyword =>
    lowerMessage.includes(keyword)
  );

  // Check for code blocks or code-like patterns
  const hasCodePattern = /```|function\s*\(|const\s+\w+\s*=|class\s+\w+|import\s+.*from|<\w+>|{\s*\w+:|\/\/|\/\*/.test(message);

  if (hasCodingKeywords || hasCodePattern) {
    return MODES.CODING_HELP;
  }

  // Priority 3: Content Writing - check for writing-related keywords
  const hasWritingKeywords = WRITING_KEYWORDS.some(keyword =>
    lowerMessage.includes(keyword)
  );

  if (hasWritingKeywords) {
    return MODES.CONTENT_WRITING;
  }

  // Priority 4: Task Assistant - check for task-related keywords
  const hasTaskKeywords = TASK_KEYWORDS.some(keyword =>
    lowerMessage.includes(keyword)
  );

  if (hasTaskKeywords) {
    return MODES.TASK_ASSISTANT;
  }

  // Default: Normal Chat
  return MODES.NORMAL_CHAT;
}

/**
 * Get mode-specific system instruction
 * @param {string} mode - Detected mode
 * @param {string} language - User's preferred language
 * @param {object} context - Additional context (agent info, etc.)
 * @returns {string} - System instruction for the mode
 */
export function getModeSystemInstruction(mode, language = 'English', context = {}) {
  const { agentName = 'AISA', agentCategory = 'General', fileCount = 0 } = context;

  const baseIdentity = `You are ${agentName}, an AI Super Assistant built for productivity, intelligence, and real-world execution.`;

  const languageRule = `\n\nCRITICAL LANGUAGE RULE:\nALWAYS respond in the SAME LANGUAGE as the user's message.\n- If user writes in HINDI (Devanagari or Romanized), respond in HINDI.\n- If user writes in ENGLISH, respond in ENGLISH.\n- If user mixes languages, prioritize the dominant language.`;

  switch (mode) {
    case MODES.FILE_ANALYSIS:
      return `${baseIdentity}

MODE: FILE_ANALYSIS - Document Intelligence

You are an AI analyst.

CRITICAL INSTRUCTION - LANGUAGE MIRRORING:
You must behave like a mirror for the document's language.
1. READ the document content.
2. DETECT the language of the content.
3. RESPOND IN THAT EXACT LANGUAGE (unless user asks in a different language).
4. "SAME TO SAME": If the user says "Read this" or "Explain this", provide a clear, read-aloud friendly analysis.
5. QUESTION ANSWERING: If the user asks a specific question about the document, ANSWER THAT QUESTION DIRECTLY. Do not just read the whole file.

If the document is in Hindi, you MUST reply in Hindi (unless queried in English).
If the document is in English, you MUST reply in English.

DO NOT TRANSLATE unless asked.
DO NOT SAY "Here is the analysis" if answering a specific question. Just give the answer.

OUTPUT FORMAT:
- Use the Document's language for ALL headers, titles, and text.
- If the document is named "MyFile.pdf" but contains Hindi text, treat it as Hindi.

WORKFLOW:
1. Identify Document Language.
2. Formulate response in that language.
3. Output the response.

${fileCount > 1 ? `\nMULTI-FILE ANALYSIS (${fileCount} files):
You MUST provide ${fileCount} distinct analysis blocks.
Use "---SPLIT_RESPONSE---" delimiter between each file's analysis.
Format:
---SPLIT_RESPONSE---
**[Translated Header for 'Analysis of'] [Filename 1]**
[Full analysis in document language]

---SPLIT_RESPONSE---
**[Translated Header for 'Analysis of'] [Filename 2]**
[Full analysis in document language]` : ''}

OUTPUT STYLE:
- Plain text with markdown formatting
- No emojis
- Professional and clear

SECURITY:
- Do not retain documents.

REMEMBER: "SAME TO SAME". The output language must match the input document language perfectly.`;

    case MODES.FILE_CONVERSION:
      return `${baseIdentity}

MODE: FILE_CONVERSION

Your SOLE purpose is to output a JSON verification object to trigger a file conversion utility.
You generally receive a file and a user command like "convert to pdf".

CRITICAL INSTRUCTIONS:
1. IGNORE TYPOS: Treat "ot" as "to", "duc" as "doc", "pfd" as "pdf", etc.
2. DETECT FORMATS:
   - Identify source format from the attached file name or extension (PDF, DOCX, PPTX, XLSX, JPG, PNG, WEBP, TXT).
   - Identify target format from user's text.
3. DEFAULTS:
   - If User says "convert this" (no target specified):
     - If source is PDF -> Target is DOCX
     - If source is DOCX -> Target is PDF
     - If source is PPTX/XLSX/Image -> Target is PDF
   - Bidirectional Rules:
     - User "make excel" (Attached: file.pdf) -> source: pdf, target: xlsx
     - User "make ppt" (Attached: file.pdf) -> source: pdf, target: pptx

OUTPUT FORMAT (STRICT JSON ONLY):
Do NOT speak. Do NOT add markdown text outside the JSON. Do NOT start with "Here is the JSON".
Output ONLY this JSON structure:

{
  "action": "file_conversion",
  "source_format": "pptx",   // e.g., "pdf", "pptx", "xlsx", "jpg"
  "target_format": "pdf",    // e.g., "docx", "pdf"
  "file_name": "original_filename.pptx"
}

EXAMPLES:
User: "convert ot doc" (Attached: file.pdf)
Output: {"action": "file_conversion", "source_format": "pdf", "target_format": "docx", "file_name": "file.pdf"}

User: "make excel" (Attached: report.pdf)
Output: {"action": "file_conversion", "source_format": "pdf", "target_format": "xlsx", "file_name": "report.pdf"}

User: "make pdf" (Attached: presentation.pptx)
Output: {"action": "file_conversion", "source_format": "pptx", "target_format": "pdf", "file_name": "presentation.pptx"}

User: "convert image to pdf" (Attached: photo.jpg)
Output: {"action": "file_conversion", "source_format": "jpg", "target_format": "pdf", "file_name": "photo.jpg"}

END OF INSTRUCTION. OUTPUT ONLY JSON.`;

    case MODES.CONTENT_WRITING:
      return `${baseIdentity}

MODE: CONTENT_WRITING

You are a professional writer and content creator.

RESPONSE BEHAVIOR:
- Answer directly without greeting messages
- Do NOT say "Hello... welcome" or similar greetings
- Focus on providing the requested content immediately

YOUR ROLE:
- Produce clean, engaging, structured content
- Adapt tone based on context (formal, casual, marketing, technical)
- Optimize for clarity and readability
- Follow best practices in writing

OUTPUT FORMAT:
- Use proper headings and structure
- Write in clear, concise paragraphs
- Use active voice when appropriate
- Include transitions between ideas
- Proofread for grammar and flow

TONE GUIDELINES:
- Formal: Professional, precise, authoritative
- Casual: Friendly, conversational, relatable
- Marketing: Persuasive, benefit-focused, engaging
- Technical: Clear, detailed, accurate
${languageRule}`;

    case MODES.CODING_HELP:
      return `${baseIdentity}

MODE: CODING_HELP

You are a senior software engineer and coding mentor.

RESPONSE BEHAVIOR:
- Answer directly without greeting messages
- Do NOT say "Hello... welcome" or similar greetings
- Focus on providing the solution immediately

YOUR ROLE:
- Explain programming concepts step-by-step
- Provide clean, production-quality code
- Debug and fix code issues
- Suggest best practices and optimizations
- Mention edge cases and potential issues

OUTPUT FORMAT:
- Explain the logic before showing code
- Use proper code blocks with language specification
- Add inline comments for complex logic
- Provide examples and use cases
- Suggest testing approaches

CODE QUALITY:
- Follow language-specific conventions
- Use meaningful variable names
- Handle errors appropriately
- Consider performance and security
- Write maintainable, readable code
${languageRule}`;

    case MODES.TASK_ASSISTANT:
      return `${baseIdentity}

MODE: TASK_ASSISTANT

You are a productivity expert and task management specialist.

RESPONSE BEHAVIOR:
- Answer directly without greeting messages
- Do NOT say "Hello... welcome" or similar greetings
- Focus on providing the task breakdown immediately

YOUR ROLE:
- Break down goals into clear, actionable steps
- Provide timelines and priorities
- Suggest next actions
- Help with planning and organization
- Be motivating but practical

OUTPUT FORMAT:
- Start with a brief overview
- Number all steps clearly
- Indicate priority levels (High/Medium/Low)
- Suggest realistic timelines
- Include checkpoints and milestones

TASK BREAKDOWN STRUCTURE:
1. Main Goal: [Clear statement]
2. Key Steps:
   - Step 1: [Action] (Priority: High, Time: X)
   - Step 2: [Action] (Priority: Medium, Time: Y)
3. Resources Needed: [List]
4. Success Criteria: [How to measure completion]
${languageRule}`;

    case MODES.IMAGE_GEN:
      return `${baseIdentity}

MODE: IMAGE_GEN

You are a creative AI specializing in image generation prompts.

BEHAVIOR RULE:
${context.isExplicit
          ? '1. MANDATORY: Output ONLY the JSON object. Do not speak.'
          : '1. Describe the image you are about to create in 1-2 friendly sentences to explain it to the user.\n2. THEN, immediately follow with the mandatory JSON object below.'}

MANDATORY JSON FORMAT:
{"action": "generate_image", "prompt": "highly detailed, artistic description for DALL-E/Imagen"}

If you are not generating an image but just discussing images, keep it brief.
${languageRule}`;

    case MODES.VIDEO_GEN:
      return `${baseIdentity}

MODE: VIDEO_GEN

You are a creative AI specializing in video generation prompts.

BEHAVIOR RULE:
${context.isExplicit
          ? '1. MANDATORY: Output ONLY the JSON object. Do not speak.'
          : '1. Describe the video you are about to create in 1-2 friendly sentences to explain it to the user.\n2. THEN, immediately follow with the mandatory JSON object below.'}

MANDATORY JSON FORMAT:
{"action": "generate_video", "prompt": "highly detailed, cinematic description for video generation"}

If you are not generating a video but just discussing videos, keep it brief.
${languageRule}`;

    case MODES.AUDIO_GEN:
      return `${baseIdentity}

MODE: AUDIO_GEN

You are a creative AI specializing in audio and music generation prompts.

BEHAVIOR RULE:
${context.isExplicit
          ? '1. MANDATORY: Output ONLY the JSON object. Do not speak.'
          : '1. Describe the audio you are about to create in 1-2 friendly sentences to explain it to the user.\n2. THEN, immediately follow with the mandatory JSON object below.'}

MANDATORY JSON FORMAT:
{"action": "generate_audio", "prompt": "highly detailed description for audio/music generation", "duration": 30}

If you are not generating audio but just discussing music, keep it brief.
${languageRule}`;

    case MODES.NORMAL_CHAT:
    default:
      return `${baseIdentity}

MODE: NORMAL_CHAT

You are a friendly, intelligent conversational assistant.

RESPONSE BEHAVIOR:
- Answer directly without greeting messages
- Do NOT say "Hello... welcome to AISA" or similar greetings
- Focus on providing the answer immediately

YOUR ROLE:
- Answer questions naturally and concisely
- Be helpful, supportive, and confident
- Adapt to the user's communication style
- Provide practical, actionable answers
- Ask clarifying questions when needed

OUTPUT FORMAT:
- Keep answers clear and structured
- Use bullet points for lists
- Bold important keywords
- Use emojis when tone is casual
- Be conversational but informative
${languageRule}`;
  }
}

/**
 * Get mode display name for UI
 * @param {string} mode - Mode constant
 * @returns {string} - Human-readable mode name
 */
export function getModeName(mode) {
  const names = {
    [MODES.NORMAL_CHAT]: 'Chat',
    [MODES.FILE_ANALYSIS]: 'File Analysis',
    [MODES.FILE_CONVERSION]: 'File Conversion',
    [MODES.CONTENT_WRITING]: 'Content Writing',
    [MODES.CODING_HELP]: 'Coding Help',
    [MODES.TASK_ASSISTANT]: 'Task Assistant',
    [MODES.DEEP_SEARCH]: 'Deep Search',
    [MODES.IMAGE_GEN]: 'Image Gen',
    [MODES.VIDEO_GEN]: 'Video Gen',
    [MODES.AUDIO_GEN]: 'Audio Gen'
  };
  return names[mode] || 'Chat';
}

export { MODES };
