document.addEventListener('DOMContentLoaded', () => {
    /* =========================================
       DOM ELEMENTS
    ========================================= */
    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const closeSettingsBtn = document.getElementById('close-settings-btn');

    // Settings Inputs
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
    // 1. Added "lastPlayedSongId" to our defaults!
    const defaultSettings = {
        lightMode: false,
        audioQuality: 'high',
        crossfade: 0,
        allowExplicit: true,
        lastPlayedSongId: null,
    };

    let appSettings = { ...defaultSettings };

    // 2. Load from Local Storage safely
    const savedSettings = localStorage.getItem('vibez_settings');
    if (savedSettings) {
        try {
            const parsedSettings = JSON.parse(savedSettings);
            appSettings = { ...defaultSettings, ...parsedSettings };
            if (
                appSettings.audioQuality !== 'high' &&
                appSettings.audioQuality !== 'normal'
            ) {
                appSettings.audioQuality = 'high';
            }
        } catch (error) {
            console.error('Local storage corrupted. Resetting to defaults.');
            appSettings = { ...defaultSettings };
        }
    }

    // 3. Apply settings to UI
    function applySettings() {
        if (themeToggle) themeToggle.checked = appSettings.lightMode;
        if (appSettings.lightMode) document.body.classList.add('light-mode');
        else document.body.classList.remove('light-mode');

        if (qualityOptions && qualitySelectedText) {
            qualityOptions.forEach((opt) => {
                opt.classList.remove('active-option');
                if (
                    opt.getAttribute('data-value') === appSettings.audioQuality
                ) {
                    qualitySelectedText.textContent = opt.textContent;
                    opt.classList.add('active-option');
                }
            });
        }

        if (crossfadeSlider && crossfadeVal) {
            crossfadeSlider.value = appSettings.crossfade;
            crossfadeVal.textContent = appSettings.crossfade + 's';
        }
        if (explicitToggle) explicitToggle.checked = appSettings.allowExplicit;
    }

    // 4. Save Settings
    function saveSettings() {
        localStorage.setItem('vibez_settings', JSON.stringify(appSettings));
    }

    /* =========================================
       AUDIO ENGINE LOGIC (PLAYBACK & PROGRESS)
    ========================================= */
    const audioPlayer = document.getElementById('main-audio-player');
    const mainPlayPauseBtn = document.querySelector('.btn-play-pause');

    const currentTimeLabel = document.getElementById('current-time');
    const totalTimeLabel = document.getElementById('total-time');
    const playbackContainer = document.getElementById('playback-scrollbar');
    const playbackFill = document.getElementById('playback-fill');

    let isPlaying = false;
    let isDraggingPlayback = false; // Tracks if user is scrubbing
    let scrubTime = 0; // Temporarily holds the time while dragging

    // Time Formatter helper
    function formatTime(seconds) {
        if (isNaN(seconds)) return '0:00';
        const min = Math.floor(seconds / 60);
        const sec = Math.floor(seconds % 60);
        return `${min}:${sec < 10 ? '0' : ''}${sec}`;
    }

    // Toggle Play/Pause
    function togglePlay() {
        if (!audioPlayer.src) return;
        if (isPlaying) {
            audioPlayer.pause();
            if (mainPlayPauseBtn)
                mainPlayPauseBtn.innerHTML =
                    '<i class="fa-solid fa-play"></i>';
        } else {
            audioPlayer.play();
            if (mainPlayPauseBtn)
                mainPlayPauseBtn.innerHTML =
                    '<i class="fa-solid fa-pause"></i>';
        }
        isPlaying = !isPlaying;
    }

    if (mainPlayPauseBtn)
        mainPlayPauseBtn.addEventListener('click', togglePlay);

    // Auto-update Progress Bar as song plays
    audioPlayer.addEventListener('timeupdate', () => {
        // Stop updating visually if the user is currently dragging the bar!
        if (isDraggingPlayback) return;

        const percent = (audioPlayer.currentTime / audioPlayer.duration) * 100;
        if (playbackFill) playbackFill.style.width = `${percent}%`;
        if (currentTimeLabel)
            currentTimeLabel.textContent = formatTime(audioPlayer.currentTime);
    });

    // Load Metadata (Total Time)
    audioPlayer.addEventListener('loadedmetadata', () => {
        if (totalTimeLabel)
            totalTimeLabel.textContent = formatTime(audioPlayer.duration);
    });

    audioPlayer.addEventListener('ended', () => {
        isPlaying = false;
        if (mainPlayPauseBtn)
            mainPlayPauseBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
        if (playbackFill) playbackFill.style.width = '0%';
        if (currentTimeLabel) currentTimeLabel.textContent = '0:00';
    });

    // --- NEW: SCRUBBING / SEEKING LOGIC ---
    function handlePlaybackDrag(e) {
        if (!playbackContainer || !audioPlayer.duration) return;
        const rect = playbackContainer.getBoundingClientRect();
        let percentage = (e.clientX - rect.left) / rect.width;
        percentage = Math.max(0, Math.min(1, percentage)); // Clamp between 0 and 1

        // Update visual UI instantly
        if (playbackFill) playbackFill.style.width = `${percentage * 100}%`;

        // Calculate the target time, but don't apply it to the audio player yet (prevents stuttering)
        scrubTime = percentage * audioPlayer.duration;
        if (currentTimeLabel)
            currentTimeLabel.textContent = formatTime(scrubTime);
    }

    if (playbackContainer) {
        playbackContainer.addEventListener('mousedown', (e) => {
            isDraggingPlayback = true;
            document.body.classList.add('dragging');
            handlePlaybackDrag(e);
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
                let songToLoad = data.songs[0]; // Default to first song

                // NEW: Check if we have a saved song in local storage!
                if (appSettings.lastPlayedSongId) {
                    const savedSong = data.songs.find(
                        (s) => s.id === appSettings.lastPlayedSongId,
                    );
                    if (savedSong) songToLoad = savedSong;
                }

                loadTrackIntoPlayer(songToLoad);
            }
        } catch (error) {
            console.error('Failed to load database:', error);
        }
    }

    function renderRecentlyAdded(songs) {
        if (!recentlyAddedGrid) return;
        recentlyAddedGrid.innerHTML = '';

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

            card.addEventListener('click', () => {
                loadTrackIntoPlayer(song);
                audioPlayer.play();
                isPlaying = true;
                if (mainPlayPauseBtn)
                    mainPlayPauseBtn.innerHTML =
                        '<i class="fa-solid fa-pause"></i>';
            });

            recentlyAddedGrid.appendChild(card);
        });
    }

    function loadTrackIntoPlayer(song) {
        if (!npTitle || !npArtists || !npArtwork) return;

        npTitle.textContent = song.title;
        npArtwork.style.background = song.artwork;

        let mainArtistsHTML = song.artists
            .map((a) => `<a href="#" class="artist-link">${a}</a>`)
            .join(', ');
        if (song.featuredArtists && song.featuredArtists.length > 0) {
            let featArtistsHTML = song.featuredArtists
                .map((a) => `<a href="#" class="artist-link">${a}</a>`)
                .join(', ');
            npArtists.innerHTML = `${mainArtistsHTML} ft. ${featArtistsHTML}`;
        } else {
            npArtists.innerHTML = mainArtistsHTML;
        }

        if (song.audioFile) {
            audioPlayer.src = song.audioFile;
        }

        // NEW: Save the last played song ID and update local storage!
        appSettings.lastPlayedSongId = song.id;
        saveSettings();
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

        // NEW: Actually change the volume of the Audio Engine!
        if (audioPlayer) audioPlayer.volume = percentage;

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
       GLOBAL MOUSE EVENTS (Drag Handlers)
    ========================================= */
    window.addEventListener('mousemove', (e) => {
        if (isDraggingVolume) setVolumeFromEvent(e);

        if (isDraggingPlayback) {
            handlePlaybackDrag(e); // Updates UI dynamically while dragging
        }
    });

    window.addEventListener('mouseup', () => {
        // Stop Volume Drag
        if (isDraggingVolume) {
            isDraggingVolume = false;
            document.body.classList.remove('dragging');
        }

        // Stop Playback Drag
        if (isDraggingPlayback) {
            isDraggingPlayback = false;
            document.body.classList.remove('dragging');

            // NEW: Apply the new scrubbed time to the actual audio file ONLY when user lets go!
            audioPlayer.currentTime = scrubTime;
        }
    });

    /* =========================================
       SETTINGS EVENTS & INITIALIZATION
    ========================================= */
    if (themeToggle) {
        themeToggle.addEventListener('change', (e) => {
            appSettings.lightMode = e.target.checked;
            applySettings();
            saveSettings();
        });
    }
    if (crossfadeSlider) {
        crossfadeSlider.addEventListener('input', (e) => {
            appSettings.crossfade = e.target.value;
            if (crossfadeVal) crossfadeVal.textContent = e.target.value + 's';
            saveSettings();
        });
    }
    if (explicitToggle) {
        explicitToggle.addEventListener('change', (e) => {
            appSettings.allowExplicit = e.target.checked;
            saveSettings();
        });
    }

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
    document.addEventListener('click', () => {
        if (qualityDropdown) qualityDropdown.classList.remove('open');
    });

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

    // FIRE IT UP
    applySettings();
    updateVolumeUI(0.7); // Set default volume on load
    loadMusicDatabase(); // Boots up the app and loads your last played track
}); // End of DOMContentLoaded
