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
                const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
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
                console.error("API Error Details:", errData);

                if (response.status === 401) {
                    throw new Error('User not found or Invalid API Key. Please check your key.');
                } else if (response.status === 402) {
                    throw new Error('Insufficient credits.');
                } else {
                    throw new Error(errData.error?.message || `API Error (${response.status})`);
                }
            }

            const data = await response.json();

            if (data.choices && data.choices.length > 0) {
                const text = data.choices[0].message.content;
                transcriptionArea.value = text;
                statusText.textContent = 'تم التحويل بنجاح';
            } else {
                throw new Error('No content returned from API');
            }

        } catch (error) {
            console.error('API Error:', error);
            statusText.textContent = 'حدث خطأ';
            transcriptionArea.value = `Error: ${error.message}\n\nTroubleshooting:\n1. Check if your API key is correct.\n2. Ensure the model supports audio input.\n3. Check console for details.`;
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
