// DOM Elements
const chatHistory = document.getElementById('chat-history');
const inputForm = document.getElementById('input-form');
const userInput = document.getElementById('user-input');
const personaSelect = document.getElementById('persona-select');
const currentModelDiv = document.getElementById('current-model');
const typingIndicator = document.getElementById('typing-indicator');
const rateWarning = document.getElementById('rate-warning');
const themeToggle = document.getElementById('theme-toggle');
const clearChat = document.getElementById('clear-chat');
const voiceInput = document.getElementById('voice-input');

// State
let lastRequestTime = 0;
let requestCount = 0;
let recognition;
let currentTheme = localStorage.getItem('theme') || 'light';

// Initialize theme
document.documentElement.setAttribute('data-theme', currentTheme);
updateThemeToggleIcon();

// Utility Functions
function vibrate() {
    if ('vibrate' in navigator) {
        navigator.vibrate(50);
    }
}

function updateThemeToggleIcon() {
    const icon = themeToggle.querySelector('span');
    if (icon) {
        icon.textContent = currentTheme === 'dark' ? '☀️' : '🌙';
    }
}

function scrollToBottom() {
    requestAnimationFrame(() => {
        chatHistory.scrollTop = chatHistory.scrollHeight;
    });
}

function createMessageElement(role, content, model = null) {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', role);
    
    // Create avatar
    const avatar = document.createElement('div');
    avatar.classList.add('message-avatar');
    avatar.textContent = role === 'user' ? 'Y' : 'R';
    
    // Create content wrapper
    const contentWrapper = document.createElement('div');
    contentWrapper.classList.add('message-content');
    contentWrapper.textContent = content;
    
    // Add model info for assistant messages
    if (model && role === 'assistant') {
        const modelInfo = document.createElement('div');
        modelInfo.classList.add('message-model');
        modelInfo.textContent = `Model: ${model}`;
        contentWrapper.appendChild(modelInfo);
    }
    
    messageDiv.appendChild(avatar);
    messageDiv.appendChild(contentWrapper);
    
    return messageDiv;
}

function addMessage(role, content, model = null) {
    const messageElement = createMessageElement(role, content, model);
    chatHistory.appendChild(messageElement);
    scrollToBottom();
}

function showTyping() {
    typingIndicator.classList.add('show');
    scrollToBottom();
}

function hideTyping() {
    typingIndicator.classList.remove('show');
}

function showRateWarning() {
    rateWarning.classList.add('show');
}

function hideRateWarning() {
    rateWarning.classList.remove('show');
}

// Auto-resize textarea
function autoResizeTextarea() {
    userInput.style.height = 'auto';
    userInput.style.height = Math.min(userInput.scrollHeight, 120) + 'px';
}

// Event Listeners

// Form submission
inputForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    vibrate();
    
    const message = userInput.value.trim();
    const persona = personaSelect.value;
    
    if (!message) return;

    // Rate limiting check
    const now = Date.now();
    if (now - lastRequestTime < 60000 / 30) {
        requestCount++;
        if (requestCount >= 25) {
            showRateWarning();
        }
    } else {
        requestCount = 1;
        hideRateWarning();
    }
    lastRequestTime = now;

    // Add user message
    addMessage('user', message);
    userInput.value = '';
    autoResizeTextarea();
    showTyping();

    try {
        const response = await fetch('/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message, persona })
        });
        
        hideTyping();
        const data = await response.json();
        
        if (data.reply) {
            addMessage('assistant', data.reply, data.model);
            currentModelDiv.textContent = `Model: ${data.model}`;
        } else {
            addMessage('assistant', `Error: ${data.error || 'Unknown error'}`);
        }
    } catch (error) {
        hideTyping();
        addMessage('assistant', 'Error: Failed to fetch response. Please try again.');
        console.error('Chat error:', error);
    }
    
    // Keep focus on input
    userInput.focus();
});

// Textarea auto-resize
userInput.addEventListener('input', autoResizeTextarea);

// Enter key handling (Shift+Enter for new line, Enter to send)
userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        inputForm.requestSubmit();
    }
});

// Voice Input
if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.lang = 'en-US';
    recognition.interimResults = false;

    voiceInput.addEventListener('click', () => {
        vibrate();
        try {
            recognition.start();
            voiceInput.style.color = 'var(--accent-gold)';
        } catch (error) {
            console.error('Voice recognition error:', error);
        }
    });

    recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        userInput.value = transcript;
        autoResizeTextarea();
        voiceInput.style.color = '';
        // Auto-submit voice input
        setTimeout(() => inputForm.requestSubmit(), 100);
    };

    recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        voiceInput.style.color = '';
        addMessage('assistant', 'Voice input failed. Please type your message instead.');
    };

    recognition.onend = () => {
        voiceInput.style.color = '';
    };
} else {
    voiceInput.style.display = 'none';
}

// Theme Toggle
themeToggle.addEventListener('click', () => {
    vibrate();
    currentTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', currentTheme);
    localStorage.setItem('theme', currentTheme);
    updateThemeToggleIcon();
});

// Clear Chat
clearChat.addEventListener('click', async () => {
    vibrate();
    
    try {
        await fetch('/clear', { method: 'POST' });
        
        // Remove all messages except the welcome message
        const messages = chatHistory.querySelectorAll('.message');
        messages.forEach((message, index) => {
            if (index > 0) { // Keep the first welcome message
                message.remove();
            }
        });
        
        // Reset rate limiting
        requestCount = 0;
        lastRequestTime = 0;
        hideRateWarning();
        
        // Reset model display
        currentModelDiv.textContent = 'Model: Rotating...';
        
    } catch (error) {
        console.error('Clear chat error:', error);
        addMessage('assistant', 'Error: Failed to clear chat. Please refresh the page.');
    }
});

// Persona change handling
personaSelect.addEventListener('change', () => {
    vibrate();
    localStorage.setItem('selectedPersona', personaSelect.value);
});

// Load saved persona
const savedPersona = localStorage.getItem('selectedPersona');
if (savedPersona) {
    personaSelect.value = savedPersona;
}

// Focus input on load
window.addEventListener('load', () => {
    userInput.focus();
    autoResizeTextarea();
});

// Handle page visibility change to maintain focus
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        userInput.focus();
    }
});

// Prevent form submission when textarea is empty
userInput.addEventListener('input', () => {
    const submitBtn = inputForm.querySelector('.send-btn');
    const hasContent = userInput.value.trim().length > 0;
    submitBtn.disabled = !hasContent;
});