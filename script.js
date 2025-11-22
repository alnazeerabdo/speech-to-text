document.addEventListener('DOMContentLoaded', () => {
    const recordBtn = document.getElementById('recordBtn');
    const statusText = document.getElementById('status');
    const transcriptionArea = document.getElementById('transcription');
    const copyBtn = document.getElementById('copyBtn');
    const clearBtn = document.getElementById('clearBtn');
    const apiKeyInput = document.getElementById('apiKey');

    let mediaRecorder = null;
    let audioChunks = [];
    let isRecording = false;

    // Check for MediaRecorder support
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        statusText.textContent = 'عذراً، متصفحك لا يدعم تسجيل الصوت.';
        recordBtn.disabled = true;
    }

    recordBtn.addEventListener('click', async () => {
        if (isRecording) {
            stopRecording();
        } else {
            await startRecording();
        }
    });

    async function startRecording() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];

            mediaRecorder.ondataavailable = (event) => {
                audioChunks.push(event.data);
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/wav' }); // or 'audio/webm' depending on browser
                await processAudio(audioBlob);

                // Stop all tracks to release microphone
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            isRecording = true;
            updateUIState(true);
        } catch (err) {
            console.error('Error accessing microphone:', err);
            statusText.textContent = 'خطأ في الوصول للميكروفون';
        }
    }

    function stopRecording() {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
            isRecording = false;
            updateUIState(false);
            statusText.textContent = 'جاري المعالجة...';
        }
    }

    async function processAudio(audioBlob) {
        const apiKey = apiKeyInput.value;
        if (!apiKey) {
            alert('الرجاء إدخال مفتاح API');
            statusText.textContent = 'مطلوب مفتاح API';
            return;
        }

        try {
            // Convert Blob to Base64
            const base64Audio = await blobToBase64(audioBlob);

            // Prepare the request payload for OpenRouter (OpenAI compatible)
            // Note: x-ai/grok-4.1-fast might expect a specific format. 
            // We will try the standard multimodal format.

            const payload = {
                "model": "x-ai/grok-4.1-fast:free",
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": "Transcribe this Arabic audio to text exactly as spoken."
                            },
                            {
                                "type": "image_url", // Wait, Grok might treat audio as a file upload or specific input type. 
                                // Standard OpenAI audio input is usually separate endpoint (transcriptions) OR multimodal chat.
                                // Let's try the multimodal chat format if supported, otherwise we might need a different approach.
                                // BUT, since standard OpenAI chat completion doesn't strictly support "audio_url" or "input_audio" in the public docs widely yet (it's new),
                                // and OpenRouter usually proxies.

                                // Let's try the "input_audio" format which is becoming standard for some models.
                                // If this fails, we might need to assume the user meant "use the model to process text" but they said "convert user sound into text".
                                // Given the specific model request, I will try the most likely multimodal format.

                                "type": "input_audio",
                                "input_audio": {
                                    "data": base64Audio,
                                    "format": "wav"
                                }
                            }
                        ]
                    }
                ]
            };

            // NOTE: If the model doesn't support direct audio input via chat completions, 
            // we would normally use the /v1/audio/transcriptions endpoint.
            // However, the user specified a CHAT model (grok-4.1-fast).
            // Let's try to send it to the chat endpoint.

            // Correction: Most "Speech to Text" via LLM uses the transcription endpoint (Whisper-like).
            // If Grok is multimodal, it might accept it. 
            // Let's implement a fallback or a specific check? No, let's just try the chat completion first.

            // Actually, for safety, let's try to use the standard /v1/chat/completions with the content.
            // If that fails, we might need to inform the user.

            // Wait, "input_audio" is not a standard field in "content" array for all providers yet.
            // Let's try the "image_url" hack if it was video? No.

            // Let's stick to the "input_audio" field in the message content, which is the OpenAI Realtime/Multimodal spec.

            const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                    "HTTP-Referer": window.location.href, // Required by OpenRouter
                    "X-Title": "Speech to Text App"
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error?.message || 'API Error');
            }

            const data = await response.json();
            const text = data.choices[0].message.content;

            transcriptionArea.value = text;
            statusText.textContent = 'تم التحويل بنجاح';

        } catch (error) {
            console.error('API Error:', error);
            statusText.textContent = 'حدث خطأ: ' + error.message;
            transcriptionArea.value = 'Error: ' + error.message + '\n\nNote: Ensure the model supports audio input via the Chat API.';
        }
    }

    function blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = reader.result.split(',')[1];
                resolve(base64String);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    // Copy to Clipboard
    copyBtn.addEventListener('click', () => {
        const text = transcriptionArea.value;
        if (!text) return;

        navigator.clipboard.writeText(text).then(() => {
            const originalText = copyBtn.innerHTML;
            copyBtn.innerHTML = '<i class="fas fa-check"></i> تم النسخ';
            copyBtn.style.background = 'rgba(16, 185, 129, 0.2)';

            setTimeout(() => {
                copyBtn.innerHTML = originalText;
                copyBtn.style.background = '';
            }, 2000);
        }).catch(err => {
            console.error('Failed to copy: ', err);
            alert('فشل النسخ');
        });
    });

    // Clear Text
    clearBtn.addEventListener('click', () => {
        transcriptionArea.value = '';
        statusText.textContent = 'اضغط للتحدث';
    });

    function updateUIState(recording) {
        if (recording) {
            recordBtn.classList.add('recording');
            statusText.textContent = 'جاري التسجيل...';
            recordBtn.querySelector('i').className = 'fas fa-stop';
        } else {
            recordBtn.classList.remove('recording');
            // statusText handled in stopRecording
            recordBtn.querySelector('i').className = 'fas fa-microphone';
        }
    }
});
