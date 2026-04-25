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

    /* =========================================
       JSON DATABASE & DATA BINDING
    ========================================= */
    const recentlyAddedGrid = document.getElementById('recently-added-grid');
    const npTitle = document.getElementById('now-playing-title');
    const npArtists = document.getElementById('now-playing-artists');
    const npArtwork = document.getElementById('now-playing-artwork');

    function loadMusicDatabase() {
        try {
            const data = musicData;
            renderRecentlyAdded(data.songs);
            if (data.songs.length > 0) {
                loadTrackIntoPlayer(data.songs[0]); // Loads but doesn't auto-play on boot
            }
        } catch (error) {
            console.error('Failed to load database:', error);
        }
    }

    // 2. Render the Grid dynamically
    function renderRecentlyAdded(songs) {
        if (!recentlyAddedGrid) return;
        recentlyAddedGrid.innerHTML = '';

        // RESTRICTION: Only show the first 6 items
        const limitedSongs = songs.slice(0, 6);

        limitedSongs.forEach((song) => {
            let artistString = song.artists.join(', ');
            const card = document.createElement('div');
            card.className = 'album-card';

            card.innerHTML = `
                <div class="album-art-container">
                    <div class="album-art" style="background: ${song.artwork}"></div>
                    <button class="card-play-btn"><i class="fa-solid fa-play"></i></button>
                </div>
                <h4>${song.title} ${song.explicit ? '<span style="background:var(--text-secondary); color:var(--bg-main); font-size:10px; padding:2px 4px; border-radius:3px; vertical-align:middle; margin-left:4px;">E</span>' : ''}</h4>
                <p>${song.albumType} • ${artistString}</p>
            `;

            // Click card to instantly Play
            card.addEventListener('click', () => {
                loadTrackIntoPlayer(song);
                audioPlayer.play();
                isPlaying = true;
                mainPlayPauseBtn.innerHTML =
                    '<i class="fa-solid fa-pause"></i>';
            });
            recentlyAddedGrid.appendChild(card);
        });
    }

    // 3. Update the Control Bar with Song Data
    function loadTrackIntoPlayer(song) {
        if (!npTitle || !npArtists || !npArtwork) return;

        npTitle.innerText = song.title;
        npArtwork.style.background = song.artwork;
        
        let mainArtistsHTML = song.artists.map(a => `<a href="#" class="artist-link">${a}</a>`).join(", ");
        if (song.featuredArtists && song.featuredArtists.length > 0) {
            let featArtistsHTML = song.featuredArtists.map(a => `<a href="#" class="artist-link">${a}</a>`).join(", ");
            npArtists.innerHTML = `${mainArtistsHTML} ft. ${featArtistsHTML}`;
        } else {
            npArtists.innerHTML = mainArtistsHTML;
        }

        // LOAD AUDIO FILE
        if (song.audioFile) {
            audioPlayer.src = song.audioFile;
        }
    }

    // Trigger the load sequence
    loadMusicDatabase();
    /* =========================================
       AUDIO ENGINE LOGIC (PLAYBACK & PROGRESS)
    ========================================= */
    const audioPlayer = document.getElementById('main-audio-player');
    const mainPlayPauseBtn = document.querySelector('.btn-play-pause');
    
    // Progress Bar DOM elements
    const currentTimeLabel = document.getElementById('current-time');
    const totalTimeLabel = document.getElementById('total-time');
    const playbackFill = document.getElementById('playback-fill');
    
    let isPlaying = false;

    // Time Formatter helper (turns 125 seconds into "2:05")
    function formatTime(seconds) {
        if (isNaN(seconds)) return "0:00";
        const min = Math.floor(seconds / 60);
        const sec = Math.floor(seconds % 60);
        return `${min}:${sec < 10 ? '0' : ''}${sec}`;
    }

    // Toggle Play/Pause
    function togglePlay() {
        if (!audioPlayer.src) return;
        if (isPlaying) {
            audioPlayer.pause();
            mainPlayPauseBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
        } else {
            audioPlayer.play();
            mainPlayPauseBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
        }
        isPlaying = !isPlaying;
    }

    if (mainPlayPauseBtn) mainPlayPauseBtn.addEventListener('click', togglePlay);

    // Update Progress Bar as song plays
    audioPlayer.addEventListener('timeupdate', () => {
        const percent = (audioPlayer.currentTime / audioPlayer.duration) * 100;
        if (playbackFill) playbackFill.style.width = `${percent}%`;
        if (currentTimeLabel) currentTimeLabel.innerText = formatTime(audioPlayer.currentTime);
    });

    // Update Total Time when a new song loads
    audioPlayer.addEventListener('loadedmetadata', () => {
        if (totalTimeLabel) totalTimeLabel.innerText = formatTime(audioPlayer.duration);
    });

    // Reset Play button when song finishes
    audioPlayer.addEventListener('ended', () => {
        isPlaying = false;
        mainPlayPauseBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
        if (playbackFill) playbackFill.style.width = '0%';
        if (currentTimeLabel) currentTimeLabel.innerText = "0:00";
    });
}); // End of DOMContentLoaded
