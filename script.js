const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const closeSettingsBtn = document.getElementById('close-settings-btn');
const themeToggle = document.getElementById('theme-toggle');

// Open Modal
settingsBtn.addEventListener('click', () => {
    settingsModal.classList.add('active');
});

// Close Modal
closeSettingsBtn.addEventListener('click', () => {
    settingsModal.classList.remove('active');
});

// Close when clicking outside the panel
settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) {
        settingsModal.classList.remove('active');
    }
});

// Toggle Light/Dark Mode
themeToggle.addEventListener('change', () => {
    if (themeToggle.checked) {
        document.body.classList.add('light-mode');
    } else {
        document.body.classList.remove('light-mode');
    }
});