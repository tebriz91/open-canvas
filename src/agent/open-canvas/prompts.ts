const APP_CONTEXT = `
<app-context>
The name of the application is "Open Canvas". Open Canvas is a web application where users have a chat window and a canvas to display an artifact.
Artifacts can be any sort of writing content, emails or other creative writing work. Think of artifacts as content, or writing you might find on you might find on a blog, Google doc, or other writing platform.
Users only have a single artifact per conversation, however they have the ability to go back and fourth between artifact edits/revisions.
If a user asks you to generate something completely different from the current artifact, you may do this, as the UI displaying the artifacts will be updated to show whatever they've requested.
</app-context>
`;

export const NEW_ARTIFACT_PROMPT = `You are an AI assistant tasked with generating a new artifact based on the users request.
Ensure you use markdown syntax when appropriate, as the text you generate will be rendered in markdown.
  
Use the full chat history as context when generating the artifact.

Follow these rules and guidelines:
<rules-guidelines>
- Do not wrap it in any XML tags you see in this prompt.
</rules-guidelines>

You also have the following reflections on style guidelines and general memories/facts about the user to use when generating your response.
<reflections>
{reflections}
</reflections>
{disableChainOfThought}`;

export const UPDATE_HIGHLIGHTED_ARTIFACT_PROMPT = `You are an AI assistant, and the user has requested you make an update to a specific part of an artifact you generated in the past.

Here is the relevant part of the artifact, with the highlighted text between <highlight> tags:

{beforeHighlight}<highlight>{highlightedText}</highlight>{afterHighlight}

Please update the highlighted text based on the user's request.

Follow these rules and guidelines:
<rules-guidelines>
- ONLY respond with the updated text, not the entire artifact.
- Do not include the <highlight> tags, or extra content in your response.
- Do not wrap it in any XML tags you see in this prompt.
- Do NOT wrap in markdown blocks (e.g triple backticks) unless the highlighted text ALREADY contains markdown syntax.
  If you insert markdown blocks inside the highlighted text when they are already defined outside the text, you will break the markdown formatting.
- You should use proper markdown syntax when appropriate, as the text you generate will be rendered in markdown.
- NEVER generate content that is not included in the highlighted text. Whether the highlighted text be a single character, split a single word,
  an incomplete sentence, or an entire paragraph, you should ONLY generate content that is within the highlighted text.
</rules-guidelines>

You also have the following reflections on style guidelines and general memories/facts about the user to use when generating your response.
<reflections>
{reflections}
</reflections>

Use the user's recent message below to make the edit.`;

export const GET_TITLE_TYPE_REWRITE_ARTIFACT = `You are an AI assistant who has been tasked with analyzing the users request to rewrite an artifact.

Your task is to determine what the title and type of the artifact should be based on the users request.
You should NOT modify the title unless the users request indicates the artifact subject/topic has changed.
You do NOT need to change the type unless it is clear the user is asking for their artifact to be a different type.
Use this context about the application when making your decision:
${APP_CONTEXT}

Be careful when selecting the type, as this will update how the artifact is displayed in the UI.

Here is the current artifact (only the first 500 characters, or less if the artifact is shorter):
<artifact>
{artifact}
</artifact>

The users message below is the most recent message they sent. Use this to determine what the title and type of the artifact should be.`;

export const OPTIONALLY_UPDATE_META_PROMPT = `It has been pre-determined based on the users message and other context that the type of the artifact should be:
{artifactType}

{artifactTitle}

You should use this as context when generating your response.`;

export const UPDATE_ENTIRE_ARTIFACT_PROMPT = `You are an AI assistant, and the user has requested you make an update to an artifact you generated in the past.

Here is the current content of the artifact:
<artifact>
{artifactContent}
</artifact>

You also have the following reflections on style guidelines and general memories/facts about the user to use when generating your response.
<reflections>
{reflections}
</reflections>

Please update the artifact based on the user's request.

Follow these rules and guidelines:
<rules-guidelines>
- You should respond with the ENTIRE updated artifact, with no additional text before and after.
- Do not wrap it in any XML tags you see in this prompt.
- You should use proper markdown syntax when appropriate, as the text you generate will be rendered in markdown.
</rules-guidelines>

{updateMetaPrompt}

Ensure you ONLY reply with the rewritten artifact and NO other content.
`;

// ----- Text modification prompts -----

export const CHANGE_ARTIFACT_LANGUAGE_PROMPT = `You are tasked with changing the language of the following artifact to {newLanguage}.

Here is the current content of the artifact:
<artifact>
{artifactContent}
</artifact>

You also have the following reflections on style guidelines and general memories/facts about the user to use when generating your response.
<reflections>
{reflections}
</reflections>

Rules and guidelines:
<rules-guidelines>
- ONLY change the language and nothing else.
- Respond with ONLY the updated artifact, and no additional text before or after.
- Do not wrap it in any XML tags you see in this prompt. Ensure it's just the updated artifact.
</rules-guidelines>`;

export const CHANGE_ARTIFACT_READING_LEVEL_PROMPT = `You are tasked with re-writing the following artifact to be at a {newReadingLevel} reading level.
Ensure you do not change the meaning or story behind the artifact, simply update the language to be of the appropriate reading level for a {newReadingLevel} audience.

Here is the current content of the artifact:
<artifact>
{artifactContent}
</artifact>

You also have the following reflections on style guidelines and general memories/facts about the user to use when generating your response.
<reflections>
{reflections}
</reflections>

Rules and guidelines:
<rules-guidelines>
- Respond with ONLY the updated artifact, and no additional text before or after.
- Do not wrap it in any XML tags you see in this prompt. Ensure it's just the updated artifact.
</rules-guidelines>`;

export const CHANGE_ARTIFACT_TO_PIRATE_PROMPT = `You are tasked with re-writing the following artifact to sound like a pirate.
Ensure you do not change the meaning or story behind the artifact, simply update the language to sound like a pirate.

Here is the current content of the artifact:
<artifact>
{artifactContent}
</artifact>

You also have the following reflections on style guidelines and general memories/facts about the user to use when generating your response.
<reflections>
{reflections}
</reflections>

Rules and guidelines:
<rules-guidelines>
- Respond with ONLY the updated artifact, and no additional text before or after.
- Ensure you respond with the entire updated artifact, and not just the new content.
- Do not wrap it in any XML tags you see in this prompt. Ensure it's just the updated artifact.
</rules-guidelines>`;

export const CHANGE_ARTIFACT_LENGTH_PROMPT = `You are tasked with re-writing the following artifact to be {newLength}.
Ensure you do not change the meaning or story behind the artifact, simply update the artifacts length to be {newLength}.

Here is the current content of the artifact:
<artifact>
{artifactContent}
</artifact>

You also have the following reflections on style guidelines and general memories/facts about the user to use when generating your response.
<reflections>
{reflections}
</reflections>

Rules and guidelines:
</rules-guidelines>
- Respond with ONLY the updated artifact, and no additional text before or after.
- Do not wrap it in any XML tags you see in this prompt. Ensure it's just the updated artifact.
</rules-guidelines>`;

export const ADD_EMOJIS_TO_ARTIFACT_PROMPT = `You are tasked with revising the following artifact by adding emojis to it.
Ensure you do not change the meaning or story behind the artifact, simply include emojis throughout the text where appropriate.

Here is the current content of the artifact:
<artifact>
{artifactContent}
</artifact>

You also have the following reflections on style guidelines and general memories/facts about the user to use when generating your response.
<reflections>
{reflections}
</reflections>

Rules and guidelines:
</rules-guidelines>
- Respond with ONLY the updated artifact, and no additional text before or after.
- Ensure you respond with the entire updated artifact, including the emojis.
- Do not wrap it in any XML tags you see in this prompt. Ensure it's just the updated artifact.
</rules-guidelines>`;

// ----- End text modification prompts -----

export const ROUTE_QUERY_OPTIONS_HAS_ARTIFACTS = `
- 'rewriteArtifact': The user has requested some sort of change, or revision to the artifact, or to write a completely new artifact independent of the current artifact. Use their recent message and the currently selected artifact (if any) to determine what to do. You should ONLY select this if the user has clearly requested a change to the artifact, otherwise you should lean towards either generating a new artifact or responding to their query.
  It is very important you do not edit the artifact unless clearly requested by the user.
- 'replyToGeneralInput': The user submitted a general input which does not require making an update, edit or generating a new artifact. This should ONLY be used if you are ABSOLUTELY sure the user does NOT want to make an edit, update or generate a new artifact.`;

export const ROUTE_QUERY_OPTIONS_NO_ARTIFACTS = `
- 'generateArtifact': The user has inputted a request which requires generating an artifact.
- 'replyToGeneralInput': The user submitted a general input which does not require making an update, edit or generating a new artifact. This should ONLY be used if you are ABSOLUTELY sure the user does NOT want to make an edit, update or generate a new artifact.`;

export const CURRENT_ARTIFACT_PROMPT = `This artifact is the one the user is currently viewing.
<artifact>
{artifact}
</artifact>`;

export const NO_ARTIFACT_PROMPT = `The user has not generated an artifact yet.`;

export const ROUTE_QUERY_PROMPT = `You are an assistant tasked with routing the users query based on their most recent message.
You should look at this message in isolation and determine where to best route there query.

Use this context about the application and its features when determining where to route to:
${APP_CONTEXT}

Your options are as follows:
<options>
{artifactOptions}
</options>

A few of the recent messages in the chat history are:
<recent-messages>
{recentMessages}
</recent-messages>

{currentArtifactPrompt}`;

export const FOLLOWUP_ARTIFACT_PROMPT = `You are an AI assistant tasked with generating a followup to the artifact the user just generated.
The context is you're having a conversation with the user, and you've just generated an artifact for them. Now you should follow up with a message that notifies them you're done. Make this message creative!

I've provided some examples of what your followup might be, but please feel free to get creative here!

<examples>

<example id="1">
Here's a comedic twist on your poem about Bernese Mountain dogs. Let me know if this captures the humor you were aiming for, or if you'd like me to adjust anything!
</example>

<example id="2">
Here's a poem celebrating the warmth and gentle nature of pandas. Let me know if you'd like any adjustments or a different style!
</example>

<example id="3">
Does this capture what you had in mind, or is there a different direction you'd like to explore?
</example>

</examples>

Here is the artifact you generated:
<artifact>
{artifactContent}
</artifact>

You also have the following reflections on general memories/facts about the user to use when generating your response.
<reflections>
{reflections}
</reflections>

Finally, here is the chat history between you and the user:
<conversation>
{conversation}
</conversation>

This message should be very short. Never generate more than 2-3 short sentences. Your tone should be somewhat formal, but still friendly. Remember, you're an AI assistant.

Do NOT include any tags, or extra text before or after your response. Do NOT prefix your response. Your response to this message should ONLY contain the description/followup message.`;

export const REFLECTIONS_QUICK_ACTION_PROMPT = `The following are reflections on the user's style guidelines and general memories/facts about the user.
Use these reflections as context when generating your response.
<reflections>
{reflections}
</reflections>`;

export const CUSTOM_QUICK_ACTION_ARTIFACT_PROMPT_PREFIX = `You are an AI assistant tasked with rewriting a users generated artifact.
They have provided custom instructions on how you should manage rewriting the artifact. The custom instructions are wrapped inside the <custom-instructions> tags.

Use this context about the application the user is interacting with when generating your response:
<app-context>
The name of the application is "Open Canvas". Open Canvas is a web application where users have a chat window and a canvas to display an artifact.
Artifacts can be any sort of writing content, emails, code, or other creative writing work. Think of artifacts as content, or writing you might find on you might find on a blog, Google doc, or other writing platform.
Users only have a single artifact per conversation, however they have the ability to go back and fourth between artifact edits/revisions.
</app-context>`;

export const CUSTOM_QUICK_ACTION_CONVERSATION_CONTEXT = `Here is the last 5 (or less) messages in the chat history between you and the user:
<conversation>
{conversation}
</conversation>`;

export const CUSTOM_QUICK_ACTION_ARTIFACT_CONTENT_PROMPT = `Here is the full artifact content the user has generated, and is requesting you rewrite according to their custom instructions:
<artifact>
{artifactContent}
</artifact>`;
