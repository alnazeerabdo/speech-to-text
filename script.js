document.addEventListener('DOMContentLoaded', () => {
    const recordBtn = document.getElementById('recordBtn');
    const statusText = document.getElementById('status');
    const transcriptionArea = document.getElementById('transcription');
    const copyBtn = document.getElementById('copyBtn');
    const clearBtn = document.getElementById('clearBtn');
    const apiKeyInput = document.getElementById('apiKey');

    let isRecording = false;
    let recognition = null;

    // Initialize Web Speech API
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.lang = 'ar-SA'; // Arabic Saudi Arabia
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onstart = () => {
            isRecording = true;
            updateUIState(true);
        };

        recognition.onend = () => {
            isRecording = false;
            updateUIState(false);
        };

        recognition.onresult = (event) => {
            let finalTranscript = '';
            let interimTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }

            // Append to existing text if needed, or just update
            // For simplicity in this demo, we'll just show what's currently being said + history
            // But to avoid duplication with continuous, we might need to be careful.
            // A simple approach for continuous:
            
            // Actually, let's just append final results to the textarea value
            // and show interim results temporarily? 
            // The standard way is to rebuild the string or append.
            
            // Let's use a slightly different approach:
            // We will just update the textarea with the latest valid full text if possible,
            // but since we want to keep history, we should probably just append.
            
            if (finalTranscript) {
                const currentText = transcriptionArea.value;
                transcriptionArea.value = currentText ? currentText + ' ' + finalTranscript : finalTranscript;
                // Scroll to bottom
                transcriptionArea.scrollTop = transcriptionArea.scrollHeight;
                
                // OPTIONAL: Send to OpenRouter for "enhancement" if desired
                // enhanceTextWithAI(finalTranscript); 
            }
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error', event.error);
            statusText.textContent = 'حدث خطأ: ' + event.error;
            isRecording = false;
            updateUIState(false);
        };

    } else {
        statusText.textContent = 'عذراً، متصفحك لا يدعم تحويل الصوت إلى نص.';
        recordBtn.disabled = true;
    }

    // Toggle Recording
    recordBtn.addEventListener('click', () => {
        if (!recognition) return;

        if (isRecording) {
            recognition.stop();
        } else {
            recognition.start();
        }
    });

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
    });

    function updateUIState(recording) {
        if (recording) {
            recordBtn.classList.add('recording');
            statusText.textContent = 'جاري الاستماع...';
            recordBtn.querySelector('i').className = 'fas fa-stop';
        } else {
            recordBtn.classList.remove('recording');
            statusText.textContent = 'اضغط للتحدث';
            recordBtn.querySelector('i').className = 'fas fa-microphone';
        }
    }

    // Placeholder for OpenRouter API integration
    // Since the requested model is text-based, we could use it to correct grammar
    // or format the text after transcription.
    async function enhanceTextWithAI(text) {
        const apiKey = apiKeyInput.value;
        if (!apiKey || !text) return;

        try {
            const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    "model": "x-ai/grok-4.1-fast:free",
                    "messages": [
                        {"role": "system", "content": "You are a helpful assistant that corrects Arabic text grammar and punctuation without changing the meaning. Output only the corrected text."},
                        {"role": "user", "content": text}
                    ]
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                const correctedText = data.choices[0].message.content;
                console.log("AI Corrected:", correctedText);
                // We could update the UI here with the corrected text if the user enables a "Auto-correct" feature
            }
        } catch (error) {
            console.error("OpenRouter API Error:", error);
        }
    }
});
