/* =========================================
   SETTINGS & LOCAL STORAGE LOGIC
========================================= */
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const closeSettingsBtn = document.getElementById('close-settings-btn');

// Input Elements
const themeToggle = document.getElementById('theme-toggle');
const qualitySelect = document.getElementById('quality-select');
const crossfadeSlider = document.getElementById('crossfade-slider');
const crossfadeVal = document.getElementById('crossfade-val');
const explicitToggle = document.getElementById('explicit-toggle');

// 1. Default Settings Object
let appSettings = {
    lightMode: false,
    audioQuality: 'high',
    crossfade: 0,
    allowExplicit: true
};

// 2. Load settings from Local Storage
const savedSettings = localStorage.getItem('vibez_settings');
if (savedSettings) {
    appSettings = JSON.parse(savedSettings); // Overwrite defaults with saved data
}

// 3. Apply settings to the UI
function applySettings() {
    // Theme
    themeToggle.checked = appSettings.lightMode;
    if (appSettings.lightMode) document.body.classList.add('light-mode');
    else document.body.classList.remove('light-mode');
    
    // Quality
    qualitySelect.value = appSettings.audioQuality;
    
    // Crossfade
    crossfadeSlider.value = appSettings.crossfade;
    crossfadeVal.innerText = appSettings.crossfade + 's';
    
    // Explicit Content
    explicitToggle.checked = appSettings.allowExplicit;
}

// 4. Save to Local Storage function
function saveSettings() {
    localStorage.setItem('vibez_settings', JSON.stringify(appSettings));
}

// --- Event Listeners for Setting Changes ---
themeToggle.addEventListener('change', (e) => {
    appSettings.lightMode = e.target.checked;
    applySettings(); // Instantly visually update theme
    saveSettings();
});

qualitySelect.addEventListener('change', (e) => {
    appSettings.audioQuality = e.target.value;
    saveSettings();
});

crossfadeSlider.addEventListener('input', (e) => {
    appSettings.crossfade = e.target.value;
    crossfadeVal.innerText = e.target.value + 's';
    saveSettings();
});

explicitToggle.addEventListener('change', (e) => {
    appSettings.allowExplicit = e.target.checked;
    saveSettings();
});

// Modal open/close logic
settingsBtn.addEventListener('click', () => settingsModal.classList.add('active'));
closeSettingsBtn.addEventListener('click', () => settingsModal.classList.remove('active'));
settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) settingsModal.classList.remove('active');
});

// Initialize on page load
applySettings();


/* =========================================
   LYRICS TOGGLE LOGIC
========================================= */
const lyricsBtn = document.getElementById('btn-lyrics-toggle');
const lyricsPanel = document.getElementById('lyrics-panel');

lyricsBtn.addEventListener('click', () => {
    lyricsPanel.classList.toggle('hidden');
    lyricsBtn.classList.toggle('active');
});

/* =========================================
   VOLUME SLIDER LOGIC
========================================= */
const volumeContainer = document.getElementById('volume-container');
const volumeFill = document.getElementById('volume-fill');
const muteBtn = document.getElementById('btn-mute');
const muteIcon = document.getElementById('mute-icon');

let isDraggingVolume = false;
let currentVolume = 0.7; 
let previousVolume = 0.7; 

function updateVolumeUI(percentage) {
    percentage = Math.max(0, Math.min(1, percentage));
    currentVolume = percentage;
    volumeFill.style.width = (percentage * 100) + '%';
    
    if (percentage === 0) muteIcon.className = 'fa-light fa-volume-xmark icon-sm';
    else if (percentage < 0.5) muteIcon.className = 'fa-light fa-volume-low icon-sm';
    else muteIcon.className = 'fa-light fa-volume-high icon-sm';
}

function setVolumeFromEvent(e) {
    const rect = volumeContainer.getBoundingClientRect();
    const percentage = (e.clientX - rect.left) / rect.width;
    updateVolumeUI(percentage);
}

volumeContainer.addEventListener('mousedown', (e) => {
    isDraggingVolume = true;
    document.body.classList.add('dragging'); 
    setVolumeFromEvent(e);
});

window.addEventListener('mousemove', (e) => {
    if (isDraggingVolume) setVolumeFromEvent(e);
});

window.addEventListener('mouseup', () => {
    if (isDraggingVolume) {
        isDraggingVolume = false;
        document.body.classList.remove('dragging');
    }
});

muteBtn.addEventListener('click', () => {
    if (currentVolume > 0) {
        previousVolume = currentVolume;
        updateVolumeUI(0);
    } else {
        updateVolumeUI(previousVolume > 0 ? previousVolume : 0.7);
    }
});