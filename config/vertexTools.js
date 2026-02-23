export const toolDeclarations = [
    {
        functionDeclarations: [
            {
                name: "generate_image",
                description: "Generates a high-quality image from a text prompt using Google's Imagen model.",
                parameters: {
                    type: "object",
                    properties: {
                        prompt: {
                            type: "string",
                            description: "Detailed description of the image to generate."
                        }
                    },
                    required: ["prompt"]
                }
            },
            {
                name: "generate_video",
                description: "Generates a cinematic video clip from a text prompt using Google's Veo model.",
                parameters: {
                    type: "object",
                    properties: {
                        prompt: {
                            type: "string",
                            description: "Detailed description of the video to generate."
                        }
                    },
                    required: ["prompt"]
                }
            },
            {
                name: "generate_audio",
                description: "Generates high-fidelity music or audio from a text prompt using Google's Lyria model.",
                parameters: {
                    type: "object",
                    properties: {
                        prompt: {
                            type: "string",
                            description: "Detailed description of the music or audio to generate including style and mood."
                        },
                        duration: {
                            type: "number",
                            description: "Duration of the audio in seconds (default 30)."
                        }
                    },
                    required: ["prompt"]
                }
            },
            {
                name: "file_conversion",
                description: "Converts a file from one format to another (e.g., PDF to DOCX, PPTX to PDF).",
                parameters: {
                    type: "object",
                    properties: {
                        target_format: {
                            type: "string",
                            description: "The desired output format (pdf, docx, pptx, xlsx)."
                        }
                    },
                    required: ["target_format"]
                }
            },
            {
                name: "set_reminder",
                description: "Sets a reminder or alarm for the user.",
                parameters: {
                    type: "object",
                    properties: {
                        title: {
                            type: "string",
                            description: "The title or description of the reminder."
                        },
                        datetime: {
                            type: "string",
                            description: "The date and time for the reminder in ISO format."
                        },
                        isAlarm: {
                            type: "boolean",
                            description: "Whether this is an alarm (true) or just a reminder (false)."
                        }
                    },
                    required: ["title", "datetime"]
                }
            },
            {
                name: "modify_image",
                description: "The primary tool for all image editing and modifications. Use this to remove backgrounds, erase objects/text, change colors, add elements, or transform existing images. You MUST provide the detailed instruction prompt for the modification.",
                parameters: {
                    type: "object",
                    properties: {
                        prompt: {
                            type: "string",
                            description: "Exhaustive instructions for the edit (e.g. 'remove all text and fill background', 'make the car red')."
                        }
                    },
                    required: ["prompt"]
                }
            },
            {
                name: "web_search",
                description: "Performs a real-time web search for information not present in the model's training data.",
                parameters: {
                    type: "object",
                    properties: {
                        query: {
                            type: "string",
                            description: "The search query to look up on the web."
                        }
                    },
                    required: ["query"]
                }
            }
        ]
    }
];
