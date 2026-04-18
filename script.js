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

/* =========================================
   LYRICS TOGGLE LOGIC
========================================= */
const lyricsBtn = document.getElementById('btn-lyrics-toggle');
const lyricsPanel = document.getElementById('lyrics-panel');

lyricsBtn.addEventListener('click', () => {
    // Toggle the hidden class on the panel
    lyricsPanel.classList.toggle('hidden');
    // Toggle the colored active state on the button
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
let currentVolume = 0.7; // Represents 70%
let previousVolume = 0.7; // Remembers volume before muting

// Function to update the UI visually
function updateVolumeUI(percentage) {
    // Clamp the percentage between 0 and 1 so it doesn't break out of the bar
    percentage = Math.max(0, Math.min(1, percentage));
    currentVolume = percentage;

    // Update the visual bar width
    volumeFill.style.width = percentage * 100 + '%';

    // Dynamically change the Font Awesome icon based on volume level
    if (percentage === 0) {
        muteIcon.className = 'fa-light fa-volume-xmark icon-sm';
    } else if (percentage < 0.5) {
        muteIcon.className = 'fa-light fa-volume-low icon-sm';
    } else {
        muteIcon.className = 'fa-light fa-volume-high icon-sm';
    }
}

// Function to calculate volume based on mouse position
function setVolumeFromEvent(e) {
    const rect = volumeContainer.getBoundingClientRect();
    // Calculate where the mouse is relative to the container's width
    const percentage = (e.clientX - rect.left) / rect.width;
    updateVolumeUI(percentage);

    // Note: Later, you will also add `audioPlayer.volume = currentVolume;` here
}

// 1. Start dragging on Mouse Down
volumeContainer.addEventListener('mousedown', (e) => {
    isDraggingVolume = true;
    document.body.classList.add('dragging'); // Prevents text selection
    setVolumeFromEvent(e);
});

// 2. Update while dragging on Mouse Move
window.addEventListener('mousemove', (e) => {
    if (isDraggingVolume) {
        setVolumeFromEvent(e);
    }
});

// 3. Stop dragging on Mouse Up
window.addEventListener('mouseup', () => {
    if (isDraggingVolume) {
        isDraggingVolume = false;
        document.body.classList.remove('dragging');
    }
});

// 4. Mute Button Click Logic
muteBtn.addEventListener('click', () => {
    if (currentVolume > 0) {
        // Mute: Save current volume and set to 0
        previousVolume = currentVolume;
        updateVolumeUI(0);
    } else {
        // Unmute: Restore previous volume (default to 70% if there wasn't one)
        updateVolumeUI(previousVolume > 0 ? previousVolume : 0.7);
    }
});
