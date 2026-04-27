document.addEventListener('DOMContentLoaded', () => {
    /* =========================================
       DOM ELEMENTS
    ========================================= */
    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const closeSettingsBtn = document.getElementById('close-settings-btn');

    const themeToggle = document.getElementById('theme-toggle');
    const crossfadeSlider = document.getElementById('crossfade-slider');
    const crossfadeVal = document.getElementById('crossfade-val');
    const explicitToggle = document.getElementById('explicit-toggle');

    const qualityDropdown = document.getElementById('quality-dropdown');
    const qualityHeader = document.getElementById('quality-header');
    const qualityOptions = document.querySelectorAll('#quality-options li');
    const qualitySelectedText = document.getElementById(
        'quality-selected-text',
    );

    /* =========================================
       SETTINGS & LOCAL STORAGE
    ========================================= */
    // 1. Add "isLyricsHidden" to defaults!
    const defaultSettings = {
        lightMode: false,
        audioQuality: 'high',
        crossfade: 0,
        allowExplicit: true,
        lastPlayedSongId: null,
        lastPlayedTime: 0,
        isLyricsHidden: false, // NEW
    };
    let appSettings = { ...defaultSettings };

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

        const lyricsPanel = document.getElementById('lyrics-panel');
        const lyricsBtn = document.getElementById('btn-lyrics-toggle');
        if (lyricsPanel && lyricsBtn) {
            if (appSettings.isLyricsHidden) {
                lyricsPanel.classList.add('hidden');
                lyricsBtn.classList.remove('active');
            } else {
                lyricsPanel.classList.remove('hidden');
                lyricsBtn.classList.add('active');
            }
        }
    }

    function saveSettings() {
        localStorage.setItem('vibez_settings', JSON.stringify(appSettings));
    }

    // NEW: Save the exact timestamp right before the user closes/refreshes the tab!
    window.addEventListener('beforeunload', () => {
        if (audioPlayer && audioPlayer.currentTime > 0) {
            appSettings.lastPlayedTime = audioPlayer.currentTime;
            saveSettings();
        }
    });

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
    let isDraggingPlayback = false;
    let scrubTime = 0;
    let isBootingUp = true; // Tracks if this is the initial page load

    function formatTime(seconds) {
        if (isNaN(seconds)) return '0:00';
        const min = Math.floor(seconds / 60);
        const sec = Math.floor(seconds % 60);
        return `${min}:${sec < 10 ? '0' : ''}${sec}`;
    }

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

    audioPlayer.addEventListener('timeupdate', () => {
        if (isDraggingPlayback) return;
        const percent = (audioPlayer.currentTime / audioPlayer.duration) * 100;
        if (playbackFill) playbackFill.style.width = `${percent}%`;
        if (currentTimeLabel)
            currentTimeLabel.textContent = formatTime(audioPlayer.currentTime);
    });

    audioPlayer.addEventListener('loadedmetadata', () => {
        if (totalTimeLabel)
            totalTimeLabel.textContent = formatTime(audioPlayer.duration);

        // NEW: If the app just booted up, jump to the saved timestamp!
        if (isBootingUp && appSettings.lastPlayedTime > 0) {
            audioPlayer.currentTime = appSettings.lastPlayedTime;
            isBootingUp = false; // Turn off boot sequence so it doesn't jump around later
        }
    });

    audioPlayer.addEventListener('ended', () => {
        isPlaying = false;
        if (mainPlayPauseBtn)
            mainPlayPauseBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
        if (playbackFill) playbackFill.style.width = '0%';
        if (currentTimeLabel) currentTimeLabel.textContent = '0:00';
    });

    function handlePlaybackDrag(e) {
        if (!playbackContainer || !audioPlayer.duration) return;
        const rect = playbackContainer.getBoundingClientRect();
        let percentage = (e.clientX - rect.left) / rect.width;
        percentage = Math.max(0, Math.min(1, percentage));

        if (playbackFill) playbackFill.style.width = `${percentage * 100}%`;

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
       JSON DATABASE & DATA BINDING (ALBUMS)
    ========================================= */
    const recentlyAddedGrid = document.getElementById('recently-added-grid');
    const recentlyPlayedGrid = document.getElementById('recently-played-grid');
    const libraryGrid = document.getElementById('library-grid');

    const npTitle = document.getElementById('now-playing-title');
    const npArtists = document.getElementById('now-playing-artists');
    const npArtwork = document.getElementById('now-playing-artwork');

    // NEW: Track the currently playing color so we can revert back to it!
    let activeAlbumColor = '#222222';

    function loadMusicDatabase() {
        try {
            const data = musicData;
            renderRecentlyAdded(data.albums);
            renderRecentlyPlayed(data.albums);

            // NEW: Generate the full library!
            renderLibrary(data.albums);

            if (data.albums.length > 0) {
                let albumToLoad = data.albums[0];
                let trackToLoad = albumToLoad.tracks[0];

                if (appSettings.lastPlayedSongId) {
                    for (const album of data.albums) {
                        const foundTrack = album.tracks.find(
                            (t) => t.id === appSettings.lastPlayedSongId,
                        );
                        if (foundTrack) {
                            albumToLoad = album;
                            trackToLoad = foundTrack;
                            break;
                        }
                    }
                }
                loadTrackIntoPlayer(trackToLoad, albumToLoad);
            }
        } catch (error) {
            console.error('Failed to load database:', error);
        }
    }

    // NEW: Render the Wide "Recently Played" Cards
    function renderRecentlyPlayed(albums) {
        if (!recentlyPlayedGrid) return;
        recentlyPlayedGrid.innerHTML = '';

        // Show up to 6 albums
        albums.slice(0, 6).forEach((album) => {
            const card = document.createElement('div');
            card.className = 'recent-card';
            card.innerHTML = `
                <div class="recent-art" style="background: ${album.artwork}"></div>
                <div class="recent-info">${album.title}</div>
            `;

            // Hover Animations!
            card.addEventListener('mouseenter', () => {
                document.documentElement.style.setProperty(
                    '--album-color',
                    album.primaryColor,
                );
            });
            card.addEventListener('mouseleave', () => {
                document.documentElement.style.setProperty(
                    '--album-color',
                    activeAlbumColor,
                );
            });

            card.addEventListener('click', () => {
                isBootingUp = false;
                loadTrackIntoPlayer(album.tracks[0], album);
                audioPlayer.play();
                isPlaying = true;
                if (mainPlayPauseBtn)
                    mainPlayPauseBtn.innerHTML =
                        '<i class="fa-solid fa-pause"></i>';
            });

            recentlyPlayedGrid.appendChild(card);
        });
    }

    // UPDATE: Add hover animations to Recently Added too!
    function renderRecentlyAdded(albums) {
        if (!recentlyAddedGrid) return;
        recentlyAddedGrid.innerHTML = '';

        albums.slice(0, 6).forEach((album) => {
            let artistString = album.artist; // Fallback to album artist
            const card = document.createElement('div');
            card.className = 'album-card';

            card.innerHTML = `
                <div class="album-art-container">
                    <div class="album-art" style="background: ${album.artwork}"></div>
                    <button class="card-play-btn"><i class="fa-solid fa-play"></i></button>
                </div>
                <h4>${album.title}</h4>
                <p>${album.type} • ${artistString}</p>
            `;

            // Hover Animations!
            card.addEventListener('mouseenter', () => {
                document.documentElement.style.setProperty(
                    '--album-color',
                    album.primaryColor,
                );
            });
            card.addEventListener('mouseleave', () => {
                document.documentElement.style.setProperty(
                    '--album-color',
                    activeAlbumColor,
                );
            });

            card.addEventListener('click', () => {
                isBootingUp = false;
                loadTrackIntoPlayer(album.tracks[0], album);
                audioPlayer.play();
                isPlaying = true;
                if (mainPlayPauseBtn)
                    mainPlayPauseBtn.innerHTML =
                        '<i class="fa-solid fa-pause"></i>';
            });

            recentlyAddedGrid.appendChild(card);
        });
    }

    // NEW: Render the entire Library grid
    function renderLibrary(albums) {
        const libraryGrid = document.getElementById('library-grid');
        if (!libraryGrid) return;
        libraryGrid.innerHTML = '';

        // Notice we don't use .slice(0, 6) here! We want ALL albums.
        albums.forEach((album) => {
            const card = document.createElement('div');
            card.className = 'album-card';

            card.innerHTML = `
                <div class="album-art-container">
                    <div class="album-art" style="background: ${album.artwork}"></div>
                    <button class="card-play-btn"><i class="fa-solid fa-play"></i></button>
                </div>
                <h4>${album.title}</h4>
                <p>${album.type} • ${album.artist}</p>
            `;

            // Hover Animations
            card.addEventListener('mouseenter', () => {
                document.documentElement.style.setProperty(
                    '--album-color',
                    album.primaryColor,
                );
            });
            card.addEventListener('mouseleave', () => {
                document.documentElement.style.setProperty(
                    '--album-color',
                    activeAlbumColor,
                );
            });

            // Click to Play
            card.addEventListener('click', () => {
                isBootingUp = false;
                loadTrackIntoPlayer(album.tracks[0], album);
                audioPlayer.play();
                isPlaying = true;
                if (mainPlayPauseBtn)
                    mainPlayPauseBtn.innerHTML =
                        '<i class="fa-solid fa-pause"></i>';
            });

            libraryGrid.appendChild(card);
        });
    }

    function loadTrackIntoPlayer(track, album) {
        if (!npTitle || !npArtists || !npArtwork) return;

        npTitle.textContent = track.title;
        npArtwork.style.background = album.artwork;

        // Update the active color tracker and apply it!
        activeAlbumColor = album.primaryColor;
        document.documentElement.style.setProperty(
            '--album-color',
            activeAlbumColor,
        );

        let mainArtistsHTML = track.artists
            .map((a) => `<a href="#" class="artist-link">${a}</a>`)
            .join(', ');
        if (track.featuredArtists && track.featuredArtists.length > 0) {
            let featArtistsHTML = track.featuredArtists
                .map((a) => `<a href="#" class="artist-link">${a}</a>`)
                .join(', ');
            npArtists.innerHTML = `${mainArtistsHTML} ft. ${featArtistsHTML}`;
        } else {
            npArtists.innerHTML = mainArtistsHTML;
        }

        if (track.audioFile) {
            audioPlayer.src = track.audioFile;
        }

        appSettings.lastPlayedSongId = track.id;
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
       GLOBAL MOUSE EVENTS
    ========================================= */
    window.addEventListener('mousemove', (e) => {
        if (isDraggingVolume) setVolumeFromEvent(e);
        if (isDraggingPlayback) handlePlaybackDrag(e);
    });

    window.addEventListener('mouseup', () => {
        if (isDraggingVolume) {
            isDraggingVolume = false;
            document.body.classList.remove('dragging');
        }
        if (isDraggingPlayback) {
            isDraggingPlayback = false;
            document.body.classList.remove('dragging');

            // Only update the actual audio track if the user scrubbed it
            audioPlayer.currentTime = scrubTime;

            // Update the setting so it saves correctly
            appSettings.lastPlayedTime = scrubTime;
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
    if (lyricsBtn) {
        lyricsBtn.addEventListener('click', () => {
            appSettings.isLyricsHidden = !appSettings.isLyricsHidden;
            applySettings();
            saveSettings();
        });
    }

    // FIRE IT UP
    applySettings();
    updateVolumeUI(0.7);
    loadMusicDatabase();

    /* =========================================
       NAVIGATION LOGIC (With Animations & Fixes!)
    ========================================= */
    const navItems = document.querySelectorAll('.nav-item');
    const views = document.querySelectorAll('.view-section');

    if (navItems.length > 0) {
        navItems.forEach((item) => {
            // Changed from (e) => to function() so we can use 'this' safely
            item.addEventListener('click', function () {
                // 'this' grabs the whole .nav-item text, even if you click the icon!
                const label = this.textContent.trim();

                // Remove 'active' class from ALL views instantly
                views.forEach((v) => v.classList.remove('active'));

                // Add 'active' class to the target view
                if (label === 'Home') {
                    const homeView = document.getElementById('view-home');
                    if (homeView) homeView.classList.add('active');
                } else if (label === 'Your Library') {
                    const libView = document.getElementById('view-library');
                    if (libView) libView.classList.add('active');
                }
            });
        });
    }
}); // End of DOMContentLoaded
