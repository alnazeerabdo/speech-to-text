document.addEventListener('DOMContentLoaded', () => {
    const recordBtn = document.getElementById('recordBtn');
    const statusText = document.getElementById('status');
    const transcriptionArea = document.getElementById('transcription');
    const copyBtn = document.getElementById('copyBtn');
    const clearBtn = document.getElementById('clearBtn');
    const apiKeyInput = document.getElementById('apiKey');
    const apiSettingsPanel = document.getElementById('apiSettingsPanel');
    const modeBrowser = document.getElementById('modeBrowser');
    const modeGemini = document.getElementById('modeGemini');

    let currentMode = 'browser'; // 'browser' or 'gemini'
    let isRecording = false;

    // Web Speech API variables
    let recognition = null;

    // Gemini API variables
    let mediaRecorder = null;
    let audioChunks = [];

    // Initialize Modes
    function updateMode() {
        if (modeBrowser.checked) {
            currentMode = 'browser';
            apiSettingsPanel.style.display = 'none';
            statusText.textContent = 'اضغط للتحدث (الميكروفون)';
        } else {
            currentMode = 'gemini';
            apiSettingsPanel.style.display = 'block';
            statusText.textContent = 'اضغط للتحدث (Gemini)';
        }
    }

    modeBrowser.addEventListener('change', updateMode);
    modeGemini.addEventListener('change', updateMode);

    // Initialize Web Speech API
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.lang = 'ar-SA';
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onstart = () => {
            isRecording = true;
            updateUIState(true);
        };

        recognition.onend = () => {
            if (currentMode === 'browser' && isRecording) {
                // If it stopped but we didn't click stop (e.g. silence), restart it
                // But for this simple app, let's just stop UI
                isRecording = false;
                updateUIState(false);
            }
        };

        recognition.onresult = (event) => {
            let finalTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                }
            }

            if (finalTranscript) {
                const currentText = transcriptionArea.value;
                transcriptionArea.value = currentText ? currentText + ' ' + finalTranscript : finalTranscript;
                transcriptionArea.scrollTop = transcriptionArea.scrollHeight;
            }
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error', event.error);
            if (currentMode === 'browser') {
                statusText.textContent = 'حدث خطأ: ' + event.error;
                isRecording = false;
                updateUIState(false);
            }
        };
    }

    // Main Record Button Handler
    recordBtn.addEventListener('click', async () => {
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    });

    async function startRecording() {
        if (currentMode === 'browser') {
            if (recognition) {
                try {
                    recognition.start();
                    isRecording = true;
                    updateUIState(true);
                } catch (e) {
                    console.error(e);
                    // Sometimes it throws if already started
                    recognition.stop();
                }
            } else {
                alert('المتصفح لا يدعم التعرف الصوتي المباشر');
            }
        } else {
            // Gemini Mode
            await startGeminiRecording();
        }
    }

    function stopRecording() {
        if (currentMode === 'browser') {
            if (recognition) {
                recognition.stop();
                isRecording = false;
                updateUIState(false);
            }
        } else {
            // Gemini Mode
            stopGeminiRecording();
        }
    }

    // Gemini Recording Logic
    async function startGeminiRecording() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            alert('المتصفح لا يدعم تسجيل الصوت');
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];

            mediaRecorder.ondataavailable = (event) => {
                audioChunks.push(event.data);
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
                await processGeminiAudio(audioBlob);
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            isRecording = true;
            updateUIState(true);
        } catch (err) {
            console.error('Error accessing microphone:', err);
            statusText.textContent = 'خطأ في الميكروفون';
        }
    }

    function stopGeminiRecording() {
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
            isRecording = false;
            updateUIState(false);
            statusText.textContent = 'جاري المعالجة...';
        }
    }

    async function processGeminiAudio(audioBlob) {
        const apiKey = apiKeyInput.value;
        if (!apiKey) {
            alert('الرجاء إدخال مفتاح API لاستخدام Gemini');
            statusText.textContent = 'مطلوب مفتاح API';
            return;
        }

        try {
            const base64Audio = await blobToBase64(audioBlob);

            const payload = {
                "model": "google/gemini-2.0-flash-exp:free",
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": "Transcribe this Arabic audio to text exactly as spoken. Output ONLY the text."
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
                    "HTTP-Referer": window.location.href,
                    "X-Title": "Speech to Text App"
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error?.message || `API Error (${response.status})`);
            }

            const data = await response.json();

            if (data.choices && data.choices.length > 0) {
                const text = data.choices[0].message.content;
                const currentText = transcriptionArea.value;
                transcriptionArea.value = currentText ? currentText + '\n' + text : text;
                statusText.textContent = 'تم التحويل بنجاح';
            } else {
                throw new Error('No content returned');
            }

        } catch (error) {
            console.error('Gemini API Error:', error);
            statusText.textContent = 'حدث خطأ في API';
            alert(`Error: ${error.message}`);
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
            statusText.textContent = currentMode === 'browser' ? 'جاري الاستماع...' : 'جاري التسجيل...';
            recordBtn.querySelector('i').className = 'fas fa-stop';
        } else {
            recordBtn.classList.remove('recording');
            // statusText is handled individually for end states
            if (!recording && statusText.textContent !== 'جاري المعالجة...') {
                statusText.textContent = 'اضغط للتحدث';
            }
            recordBtn.querySelector('i').className = 'fas fa-microphone';
        }
    }

    // Initial call to set state
    updateMode();
});
