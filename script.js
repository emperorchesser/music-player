document.addEventListener('DOMContentLoaded', () => {
    /* =========================================
       DOM ELEMENTS
    ========================================= */
    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const closeSettingsBtn = document.getElementById('close-settings-btn');

    // Inputs
    const themeToggle = document.getElementById('theme-toggle');
    const crossfadeSlider = document.getElementById('crossfade-slider');
    const crossfadeVal = document.getElementById('crossfade-val');
    const explicitToggle = document.getElementById('explicit-toggle');

    // Custom Dropdown Elements
    const qualityDropdown = document.getElementById('quality-dropdown');
    const qualityHeader = document.getElementById('quality-header');
    const qualityOptions = document.querySelectorAll('#quality-options li');
    const qualitySelectedText = document.getElementById(
        'quality-selected-text',
    );

    /* =========================================
       SETTINGS & LOCAL STORAGE
    ========================================= */
    const defaultSettings = {
        lightMode: false,
        audioQuality: 'high',
        crossfade: 0,
        allowExplicit: true,
    };

    let appSettings = { ...defaultSettings };

    // 1. Load from Local Storage (With Poison Control Failsafe!)
    const savedSettings = localStorage.getItem('vibez_settings');
    if (savedSettings) {
        try {
            const parsedSettings = JSON.parse(savedSettings);
            appSettings = { ...defaultSettings, ...parsedSettings };

            // POISON CONTROL: If the old code saved the wrong data type, fix it instantly!
            if (
                appSettings.audioQuality !== 'high' &&
                appSettings.audioQuality !== 'normal'
            ) {
                console.warn(
                    "Corrupted audio quality found in storage. Resetting to 'high'.",
                );
                appSettings.audioQuality = 'high';
                saveSettings(); // Overwrite the bad data in the browser
            }
        } catch (error) {
            console.error('Local storage corrupted. Resetting to defaults.');
            appSettings = { ...defaultSettings };
        }
    }

    // 2. Apply settings to UI
    function applySettings() {
        // Apply Theme
        if (themeToggle) themeToggle.checked = appSettings.lightMode;
        if (appSettings.lightMode) document.body.classList.add('light-mode');
        else document.body.classList.remove('light-mode');

        // Apply Audio Quality Text (FIXED: Using textContent for hidden modal elements)
        if (qualityOptions && qualitySelectedText) {
            qualityOptions.forEach((opt) => {
                opt.classList.remove('active-option');
                if (
                    opt.getAttribute('data-value') === appSettings.audioQuality
                ) {
                    // textContent forces the update even when the modal is closed!
                    qualitySelectedText.textContent = opt.textContent;
                    opt.classList.add('active-option');
                }
            });
        }

        // Apply Crossfade
        if (crossfadeSlider && crossfadeVal) {
            crossfadeSlider.value = appSettings.crossfade;
            crossfadeVal.textContent = appSettings.crossfade + 's';
        }

        // Apply Explicit Content
        if (explicitToggle) {
            explicitToggle.checked = appSettings.allowExplicit;
        }
    }

    // 3. Save Settings
    function saveSettings() {
        localStorage.setItem('vibez_settings', JSON.stringify(appSettings));
    }

    /* =========================================
       EVENT LISTENERS
    ========================================= */

    // Theme Toggle
    if (themeToggle) {
        themeToggle.addEventListener('change', (e) => {
            appSettings.lightMode = e.target.checked;
            applySettings();
            saveSettings();
        });
    }

    // Crossfade Slider
    if (crossfadeSlider) {
        crossfadeSlider.addEventListener('input', (e) => {
            appSettings.crossfade = e.target.value;
            crossfadeVal.innerText = e.target.value + 's';
            saveSettings();
        });
    }

    // Explicit Toggle
    if (explicitToggle) {
        explicitToggle.addEventListener('change', (e) => {
            appSettings.allowExplicit = e.target.checked;
            saveSettings();
        });
    }

    // Custom Dropdown UI Logic
    if (qualityHeader) {
        qualityHeader.addEventListener('click', (e) => {
            e.stopPropagation();
            qualityDropdown.classList.toggle('open');
        });
    }

    if (qualityOptions) {
        qualityOptions.forEach((option) => {
            option.addEventListener('click', () => {
                appSettings.audioQuality = option.getAttribute('data-value');
                applySettings();
                saveSettings();
                qualityDropdown.classList.remove('open');
            });
        });
    }

    // Close dropdown when clicking outside
    document.addEventListener('click', () => {
        if (qualityDropdown) qualityDropdown.classList.remove('open');
    });

    // Modal Open/Close
    if (settingsBtn)
        settingsBtn.addEventListener('click', () =>
            settingsModal.classList.add('active'),
        );
    if (closeSettingsBtn)
        closeSettingsBtn.addEventListener('click', () =>
            settingsModal.classList.remove('active'),
        );
    if (settingsModal) {
        settingsModal.addEventListener('click', (e) => {
            if (e.target === settingsModal)
                settingsModal.classList.remove('active');
        });
    }

    // Initialize Everything on Load
    applySettings();

    /* =========================================
       LYRICS TOGGLE LOGIC
    ========================================= */
    const lyricsBtn = document.getElementById('btn-lyrics-toggle');
    const lyricsPanel = document.getElementById('lyrics-panel');

    if (lyricsBtn && lyricsPanel) {
        lyricsBtn.addEventListener('click', () => {
            lyricsPanel.classList.toggle('hidden');
            lyricsBtn.classList.toggle('active');
        });
    }

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
        if (volumeFill) volumeFill.style.width = percentage * 100 + '%';

        if (muteIcon) {
            if (percentage === 0)
                muteIcon.className = 'fa-light fa-volume-xmark icon-sm';
            else if (percentage < 0.5)
                muteIcon.className = 'fa-light fa-volume-low icon-sm';
            else muteIcon.className = 'fa-light fa-volume-high icon-sm';
        }
    }

    function setVolumeFromEvent(e) {
        if (!volumeContainer) return;
        const rect = volumeContainer.getBoundingClientRect();
        const percentage = (e.clientX - rect.left) / rect.width;
        updateVolumeUI(percentage);
    }

    if (volumeContainer) {
        volumeContainer.addEventListener('mousedown', (e) => {
            isDraggingVolume = true;
            document.body.classList.add('dragging');
            setVolumeFromEvent(e);
        });
    }

    window.addEventListener('mousemove', (e) => {
        if (isDraggingVolume) setVolumeFromEvent(e);
    });

    window.addEventListener('mouseup', () => {
        if (isDraggingVolume) {
            isDraggingVolume = false;
            document.body.classList.remove('dragging');
        }
    });

    if (muteBtn) {
        muteBtn.addEventListener('click', () => {
            if (currentVolume > 0) {
                previousVolume = currentVolume;
                updateVolumeUI(0);
            } else {
                updateVolumeUI(previousVolume > 0 ? previousVolume : 0.7);
            }
        });
    }
}); // End of DOMContentLoaded
