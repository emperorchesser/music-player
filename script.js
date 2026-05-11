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
    const defaultSettings = {
        lightMode: false,
        audioQuality: 'high',
        crossfade: 0,
        allowExplicit: true,
        lastPlayedSongId: null,
        lastPlayedTime: 0,
        isLyricsHidden: false,
        repeatState: 0,
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
    let isBootingUp = true;
    let crossfadeInterval = null; // NEW: Global crossfade timer tracker

    let currentAlbumData = null;
    let currentTrackIndex = 0;

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

        // NEW: FADE-OUT LOGIC
        if (appSettings.crossfade > 0 && audioPlayer.duration) {
            const timeLeft = audioPlayer.duration - audioPlayer.currentTime;

            // If we are in the final X seconds of the song...
            if (timeLeft <= appSettings.crossfade) {
                // Smoothly calculate the volume going down to 0
                let fadeOutVol =
                    currentVolume * (timeLeft / appSettings.crossfade);
                audioPlayer.volume = Math.max(
                    0,
                    Math.min(currentVolume, fadeOutVol),
                );
            }
            // Make sure the volume stays normal in the middle of the song
            // (Only triggers if the fade-in interval is completely finished)
            else if (!crossfadeInterval) {
                audioPlayer.volume = currentVolume;
            }
        }
    });

    audioPlayer.addEventListener('loadedmetadata', () => {
        if (totalTimeLabel)
            totalTimeLabel.textContent = formatTime(audioPlayer.duration);
        if (isBootingUp && appSettings.lastPlayedTime > 0) {
            audioPlayer.currentTime = appSettings.lastPlayedTime;
            isBootingUp = false;
        }
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
       SKIP, PREVIOUS & REPEAT LOGIC
    ========================================= */
    const btnNext = document.getElementById('btn-next');
    const btnPrev = document.getElementById('btn-prev');
    const btnRepeat = document.getElementById('btn-repeat');

    function updateRepeatUI() {
        if (!btnRepeat) return;
        if (appSettings.repeatState === 0) {
            btnRepeat.innerHTML = '<i class="fa-light fa-repeat icon-sm"></i>';
            btnRepeat.classList.remove('active');
        } else if (appSettings.repeatState === 1) {
            btnRepeat.innerHTML = '<i class="fa-light fa-repeat icon-sm"></i>';
            btnRepeat.classList.add('active');
        } else {
            btnRepeat.innerHTML =
                '<i class="fa-light fa-repeat-1 icon-sm"></i>';
            btnRepeat.classList.add('active');
        }
    }

    if (btnRepeat) {
        btnRepeat.addEventListener('click', () => {
            appSettings.repeatState = (appSettings.repeatState + 1) % 3;
            saveSettings();
            updateRepeatUI();
        });
    }

    updateRepeatUI();

    function playNext(isAutoPlay = false) {
        if (!currentAlbumData) return;

        if (isAutoPlay && appSettings.repeatState === 2) {
            audioPlayer.currentTime = 0;
            audioPlayer.play();
            return;
        }

        let foundValidTrack = false;
        let startIndex = currentTrackIndex;

        // Skips explicit tracks if setting is disabled
        while (!foundValidTrack) {
            currentTrackIndex++;
            if (currentTrackIndex >= currentAlbumData.tracks.length) {
                if (isAutoPlay && appSettings.repeatState === 0) {
                    currentTrackIndex = startIndex;
                    loadTrackIntoPlayer(
                        currentAlbumData.tracks[currentTrackIndex],
                        currentAlbumData,
                    );
                    isPlaying = false;
                    if (mainPlayPauseBtn)
                        mainPlayPauseBtn.innerHTML =
                            '<i class="fa-solid fa-play"></i>';
                    return;
                } else {
                    currentTrackIndex = 0;
                }
            }

            const nextTrack = currentAlbumData.tracks[currentTrackIndex];
            if (appSettings.allowExplicit || !nextTrack.explicit) {
                foundValidTrack = true;
            }

            if (currentTrackIndex === startIndex) break;
        }

        loadTrackIntoPlayer(
            currentAlbumData.tracks[currentTrackIndex],
            currentAlbumData,
        );
        audioPlayer.play();
        isPlaying = true;
        if (mainPlayPauseBtn)
            mainPlayPauseBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
    }

    function playPrev() {
        if (!currentAlbumData) return;

        if (audioPlayer.currentTime > 3) {
            audioPlayer.currentTime = 0;
            return;
        }

        currentTrackIndex--;
        if (currentTrackIndex < 0) {
            currentTrackIndex = currentAlbumData.tracks.length - 1;
        }

        // Ensure the track we skip back to is allowed
        const prevTrack = currentAlbumData.tracks[currentTrackIndex];
        if (!appSettings.allowExplicit && prevTrack.explicit) {
            // Recursively skip back again if this one is explicit
            playPrev();
            return;
        }

        loadTrackIntoPlayer(
            currentAlbumData.tracks[currentTrackIndex],
            currentAlbumData,
        );
        audioPlayer.play();
        isPlaying = true;
        if (mainPlayPauseBtn)
            mainPlayPauseBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
    }

    if (btnNext) btnNext.addEventListener('click', () => playNext(false));
    if (btnPrev) btnPrev.addEventListener('click', playPrev);

    audioPlayer.addEventListener('ended', () => {
        playNext(true);
    });

    /* =========================================
       JSON DATABASE & DATA BINDING
    ========================================= */
    const recentlyAddedGrid = document.getElementById('recently-added-grid');
    const recentlyPlayedGrid = document.getElementById('recently-played-grid');
    const libraryGrid = document.getElementById('library-grid');

    const npTitle = document.getElementById('now-playing-title');
    const npArtists = document.getElementById('now-playing-artists');
    const npArtwork = document.getElementById('now-playing-artwork');

    let activeAlbumColor = '#222222';

    // NEW HELPER: Finds the first non-explicit track in an album (if filter is active)
    function playAlbum(album) {
        let trackIndexToPlay = 0;

        if (!appSettings.allowExplicit) {
            trackIndexToPlay = album.tracks.findIndex((t) => !t.explicit);
            if (trackIndexToPlay === -1) {
                alert(
                    'All tracks in this album contain explicit content, which is currently disabled in your settings.',
                );
                return;
            }
        }

        isBootingUp = false;
        currentAlbumData = album;
        currentTrackIndex = trackIndexToPlay;

        loadTrackIntoPlayer(album.tracks[trackIndexToPlay], album);
        audioPlayer.play();
        isPlaying = true;
        if (mainPlayPauseBtn)
            mainPlayPauseBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
    }

    function loadMusicDatabase() {
        try {
            const data = musicData;
            renderRecentlyAdded(data.albums);
            renderRecentlyPlayed(data.albums);
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
                            currentAlbumData = album;
                            currentTrackIndex =
                                album.tracks.indexOf(foundTrack);
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

    function renderRecentlyPlayed(albums) {
        if (!recentlyPlayedGrid) return;
        recentlyPlayedGrid.innerHTML = '';

        albums.slice(0, 6).forEach((album) => {
            const card = document.createElement('div');
            card.className = 'recent-card';
            card.innerHTML = `
                <div class="recent-art" style="background: ${album.artwork}"></div>
                <div class="recent-info">${album.title}</div>
            `;

            card.addEventListener('mouseenter', () =>
                document.documentElement.style.setProperty(
                    '--album-color',
                    album.primaryColor,
                ),
            );
            card.addEventListener('mouseleave', () =>
                document.documentElement.style.setProperty(
                    '--album-color',
                    activeAlbumColor,
                ),
            );

            // Replaced hardcode with smart playAlbum helper!
            card.addEventListener('click', () => playAlbum(album));
            recentlyPlayedGrid.appendChild(card);
        });
    }

    function renderRecentlyAdded(albums) {
        if (!recentlyAddedGrid) return;
        recentlyAddedGrid.innerHTML = '';

        albums.slice(0, 6).forEach((album) => {
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

            card.addEventListener('mouseenter', () =>
                document.documentElement.style.setProperty(
                    '--album-color',
                    album.primaryColor,
                ),
            );
            card.addEventListener('mouseleave', () =>
                document.documentElement.style.setProperty(
                    '--album-color',
                    activeAlbumColor,
                ),
            );

            // Replaced hardcode with smart playAlbum helper!
            const playBtn = card.querySelector('.card-play-btn');
            if (playBtn) {
                playBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    playAlbum(album);
                });
            }

            card.addEventListener('click', () => openAlbumPage(album));
            recentlyAddedGrid.appendChild(card);
        });
    }

    function renderLibrary(albums) {
        const libraryGrid = document.getElementById('library-grid');
        if (!libraryGrid) return;
        libraryGrid.innerHTML = '';

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

            card.addEventListener('mouseenter', () =>
                document.documentElement.style.setProperty(
                    '--album-color',
                    album.primaryColor,
                ),
            );
            card.addEventListener('mouseleave', () =>
                document.documentElement.style.setProperty(
                    '--album-color',
                    activeAlbumColor,
                ),
            );

            const playBtn = card.querySelector('.card-play-btn');
            if (playBtn) {
                playBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    playAlbum(album);
                });
            }

            card.addEventListener('click', () => openAlbumPage(album));
            libraryGrid.appendChild(card);
        });
    }

    function openAlbumPage(album) {
        document
            .querySelectorAll('.view-section')
            .forEach((v) => v.classList.remove('active'));
        document.getElementById('view-album').classList.add('active');

        document.documentElement.style.setProperty(
            '--album-color',
            album.primaryColor,
        );
        activeAlbumColor = album.primaryColor;

        document.getElementById('album-page-art').style.background =
            album.artwork;
        document.getElementById('album-page-type').textContent = album.type;
        document.getElementById('album-page-title').textContent = album.title;
        document.getElementById('album-page-meta').textContent =
            `${album.artist} • ${album.releaseYear} • ${album.tracks.length} songs`;

        const tracklistContainer = document.getElementById('album-tracklist');
        tracklistContainer.innerHTML = '';

        album.tracks.forEach((track, index) => {
            const row = document.createElement('div');
            row.className = 'tracklist-row';

            const isBlocked = !appSettings.allowExplicit && track.explicit;

            if (isBlocked) {
                row.style.opacity = '0.4';
                row.style.cursor = 'not-allowed';
                row.title = 'Explicit content disabled.';
            }

            row.innerHTML = `
                <div class="track-num">${index + 1}</div>
                <div class="track-details">
                    <span class="track-name">${track.title} ${track.explicit ? '<span style="background:var(--text-secondary); color:var(--bg-main); font-size:10px; padding:2px 4px; border-radius:3px; vertical-align:middle; margin-left:4px;">E</span>' : ''}</span>
                    <span>${track.artists.join(', ')}</span>
                </div>
            `;

            if (!isBlocked) {
                row.addEventListener('click', () => {
                    currentAlbumData = album;
                    currentTrackIndex = index;
                    loadTrackIntoPlayer(track, album);
                    audioPlayer.play();
                    isPlaying = true;
                    if (mainPlayPauseBtn)
                        mainPlayPauseBtn.innerHTML =
                            '<i class="fa-solid fa-pause"></i>';
                });
            }

            tracklistContainer.appendChild(row);
        });

        // Replaced hardcode with smart playAlbum helper!
        const bigPlayBtn = document.getElementById('album-page-play-btn');
        if (bigPlayBtn) {
            bigPlayBtn.onclick = () => playAlbum(album);
        }
    }

    function loadTrackIntoPlayer(track, album) {
        if (!npTitle || !npArtists || !npArtwork) return;

        npTitle.textContent = track.title;
        npArtwork.style.background = album.artwork;

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

        // DETERMINING AUDIO QUALITY
        // Fallback checks just in case the JSON is missing one of the links
        let fileToPlay = track.audioFileHigh || track.audioFileNormal;

        if (appSettings.audioQuality === 'normal' && track.audioFileNormal) {
            fileToPlay = track.audioFileNormal;
        } else if (
            appSettings.audioQuality === 'high' &&
            track.audioFileHigh
        ) {
            fileToPlay = track.audioFileHigh;
        }

        if (fileToPlay) {
            audioPlayer.src = fileToPlay;

            if (crossfadeInterval) {
                clearInterval(crossfadeInterval);
                crossfadeInterval = null;
            }

            if (appSettings.crossfade > 0) {
                audioPlayer.volume = 0;
                let targetVol = currentVolume;
                let steps = appSettings.crossfade * 10;
                let currentStep = 0;

                crossfadeInterval = setInterval(() => {
                    currentStep++;
                    let newVol = (currentStep / steps) * targetVol;
                    audioPlayer.volume = Math.max(0, Math.min(1, newVol));

                    if (currentStep >= steps) {
                        clearInterval(crossfadeInterval);
                        crossfadeInterval = null;
                    }
                }, 100);
            } else {
                audioPlayer.volume = currentVolume;
            }
        }

        appSettings.lastPlayedSongId = track.id;
        saveSettings();
    }

    /* =========================================
       NAVIGATION LOGIC
    ========================================= */
    const navItems = document.querySelectorAll('.nav-item');
    const views = document.querySelectorAll('.view-section');

    if (navItems.length > 0) {
        navItems.forEach((item) => {
            item.addEventListener('click', function () {
                const label = this.textContent.trim();
                views.forEach((v) => v.classList.remove('active'));

                if (label === 'Home') {
                    const homeView = document.getElementById('view-home');
                    if (homeView) {
                        homeView.classList.add('active');
                        document.documentElement.style.setProperty(
                            '--album-color',
                            activeAlbumColor,
                        );
                    }
                } else if (label === 'Your Library') {
                    const libView = document.getElementById('view-library');
                    if (libView) {
                        libView.classList.add('active');
                        document.documentElement.style.setProperty(
                            '--album-color',
                            activeAlbumColor,
                        );
                    }
                }
            });
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
            audioPlayer.currentTime = scrubTime;
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
            if (
                document
                    .getElementById('view-album')
                    .classList.contains('active') &&
                currentAlbumData
            ) {
                openAlbumPage(currentAlbumData);
            }
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
                const newQuality = option.getAttribute('data-value');

                // Only do the heavy lifting if the user ACTUALLY changed the setting
                if (appSettings.audioQuality !== newQuality) {
                    appSettings.audioQuality = newQuality;
                    applySettings();
                    saveSettings();

                    // LIVE SWAP: Instantly change the audio source without losing your place!
                    if (currentAlbumData && audioPlayer.src) {
                        const track =
                            currentAlbumData.tracks[currentTrackIndex];
                        const currentTime = audioPlayer.currentTime; // Save exact timestamp
                        const wasPlaying = isPlaying; // Remember if it was paused or playing

                        // Grab the new file based on the new setting
                        let newFile =
                            appSettings.audioQuality === 'normal'
                                ? track.audioFileNormal || track.audioFileHigh
                                : track.audioFileHigh || track.audioFileNormal;

                        audioPlayer.src = newFile;
                        audioPlayer.currentTime = currentTime; // Jump right back to the timestamp

                        if (wasPlaying) {
                            audioPlayer.play();
                        }
                    }
                }
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
            appSettings.isLyricsHidden = !appSettings.isLyricsHidden;
            applySettings();
            saveSettings();
        });
    }

    // FIRE IT UP
    applySettings();
    updateVolumeUI(0.7);
    loadMusicDatabase();
}); // End of DOMContentLoaded
