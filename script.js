document.addEventListener('DOMContentLoaded', () => {
    const recordBtn = document.getElementById('recordBtn');
    document.addEventListener('DOMContentLoaded', () => {
        const recordBtn = document.getElementById('recordBtn');
        const statusText = document.getElementById('status');
        const transcriptionArea = document.getElementById('transcription');
        const copyBtn = document.getElementById('copyBtn');
        const clearBtn = document.getElementById('clearBtn');
        // const apiKeyInput = document.getElementById('apiKey'); // Removed as it's not used by Web Speech API

        let recognition = null;
        let isRecording = false;

        // Initialize Web Speech API
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            recognition = new SpeechRecognition();
            recognition.lang = 'ar-SA'; // Set language to Arabic (Saudi Arabia)
            recognition.continuous = true; // Keep listening even if the user pauses
            recognition.interimResults = true; // Show interim results

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
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        finalTranscript += event.results[i][0].transcript;
                    }
                }

                if (finalTranscript) {
                    const currentText = transcriptionArea.value;
                    transcriptionArea.value = currentText ? currentText + ' ' + finalTranscript : finalTranscript;
                    transcriptionArea.scrollTop = transcriptionArea.scrollHeight; // Scroll to bottom
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

        recordBtn.addEventListener('click', () => {
            if (!recognition) return; // If recognition is not supported, do nothing
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
            statusText.textContent = 'اضغط للتحدث';
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
    });
